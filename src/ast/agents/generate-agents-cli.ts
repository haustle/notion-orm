/**
 * CLI orchestration for agent type generation.
 * Handles metadata management, file generation coordination, and CLI entry point.
 */

import { NotionAgentsClient } from "@notionhq/agents-client";
import fs from "fs";
import path from "path";
import * as ts from "typescript";
import { getNotionConfig } from "../../config/loadConfig";
import { camelize } from "../../helpers";
import {
	type CachedAgentMetadata as DatabaseCachedAgentMetadata,
	readAgentMetadataFromDisk,
	readDatabaseMetadata,
	updateSourceIndexFile,
} from "../database/generate-databases-cli";
import { createNameImport } from "../shared/ast-builders";
import {
	AGENTS_DIR,
	AST_FS_FILENAMES,
	AST_FS_PATHS,
	AST_IMPORT_PATHS,
} from "../shared/constants";
import { findConfigFile } from "../../config/helpers";
import { syncAgentsInConfigWithAST } from "../../cli/helpers";

/**
 * Returns the file path where agent metadata is stored.
 * Metadata contains cached information about generated agents (id, className, displayName).
 */
function getAgentsMetadataFilePath(): string {
	return path.resolve(AGENTS_DIR, "metadata.json");
}

/**
 * Reads cached agent metadata from disk.
 * Returns an empty array if the metadata file doesn't exist or can't be parsed.
 * Used to preserve existing agent metadata during generation.
 */
function readAgentMetadata(): CachedAgentMetadata[] {
	try {
		const metadataFile = getAgentsMetadataFilePath();
		if (!fs.existsSync(metadataFile)) {
			return [];
		}
		const content = fs.readFileSync(metadataFile, "utf-8");
		return JSON.parse(content) as CachedAgentMetadata[];
	} catch (error) {
		return [];
	}
}

/**
 * Writes agent metadata to disk as JSON.
 * Creates the agents directory if it doesn't exist.
 * This metadata is used to track which agents have been generated and their properties.
 */
function writeAgentMetadata(metadata: CachedAgentMetadata[]): void {
	if (!fs.existsSync(AGENTS_DIR)) {
		fs.mkdirSync(AGENTS_DIR, { recursive: true });
	}
	const metadataFile = getAgentsMetadataFilePath();
	fs.writeFileSync(metadataFile, JSON.stringify(metadata, null, 2));
}

type CachedAgentMetadata = DatabaseCachedAgentMetadata;

/**
 * Main entry point for generating agent TypeScript files.
 *
 * Orchestrates the entire agent generation process:
 * 1. Fetches all agents from Notion API (agents shared with the integration)
 * 2. Syncs agents array in config file (adds new ones, removes stale ones)
 * 3. Generates TypeScript files for each agent
 * 4. Creates barrel file (index.ts/js) for agent exports
 * 5. Updates the main source index file with agent imports
 *
 * @returns Array of generated agent display names
 */
export const createAgentTypes = async (): Promise<{ agentNames: string[] }> => {
	const config = await getNotionConfig();

	if (!config.auth) {
		console.error(
			"⚠️ Integration key not found. Inside 'notion.config.js/ts' file, please pass a valid Notion Integration Key",
		);
		process.exit(1);
	}

	const client = new NotionAgentsClient({
		auth: config.auth,
	});

	const agentsList = await client.agents.list({
		page_size: 100,
	});

	// Sync agents in config file
	const configFile = findConfigFile();
	if (configFile) {
		const agentsToSync = agentsList.results.map((a: { id: string; name: string }) => ({
			id: a.id,
			name: a.name,
		}));
		await syncAgentsInConfigWithAST(
			configFile.path,
			agentsToSync,
			configFile.isTS
		);
	}

	// Generate types for all agents from API
	const metadataMap = new Map<string, CachedAgentMetadata>();
	const agentNames: string[] = [];

	for (const agent of agentsList.results) {
		try {
			const normalizedIdForStorage = agent.id.replace(/-/g, "");
			const agentMetaData = await generateAgentTypes(
				normalizedIdForStorage,
				agent.name,
				agent.icon ?? null,
			);
			metadataMap.set(agentMetaData.id, agentMetaData);
			agentNames.push(agentMetaData.displayName);
		} catch (error) {
			console.error(`❌ Error generating types for agent: ${agent.id}`);
			console.error(error);
		}
	}

	const agentsMetadata = Array.from(metadataMap.values());
	writeAgentMetadata(agentsMetadata);

	createAgentBarrelFile({
		agentInfo: agentsMetadata.map((agent) => ({
			className: agent.className,
			displayName: agent.displayName,
		})),
	});

	const databasesMetadata = readDatabaseMetadata();
	updateSourceIndexFile(databasesMetadata, agentsMetadata);

	return { agentNames };
};

/**
 * Creates a barrel file (index.ts/js) that exports all generated agent classes.
 *
 * The barrel file contains:
 * - Import statements for each agent class
 * - An exported "agents" object mapping class names to their implementations
 *
 * This allows consumers to access agents via: `import { agents } from './agents'`
 *
 * Example generated barrel file (index.ts):
 * ```ts
 * import { FoodManager } from "./FoodManager";
 * import { BookAssistant } from "./BookAssistant";
 * export const agents = {
 *   FoodManager: FoodManager,
 *   BookAssistant: BookAssistant,
 * };
 * ```
 *
 * @param args - Object containing agent info (className and displayName for each agent)
 */
function createAgentBarrelFile(args: {
	agentInfo: Array<{ className: string; displayName: string }>;
}) {
	const { agentInfo } = args;

	if (agentInfo.length === 0) {
		return;
	}

	// Creates import statements for each agent class
	// Example generated: import { FoodManager } from "./FoodManager";
	const importStatements = agentInfo.map(({ className }) =>
		ts.factory.createImportDeclaration(
			undefined,
			// Creates: { FoodManager }
			ts.factory.createImportClause(
				false,
				undefined,
				// Creates: FoodManager (as a named import)
				ts.factory.createNamedImports([
					ts.factory.createImportSpecifier(
						false,
						undefined,
						ts.factory.createIdentifier(className),
					),
				]),
			),
			ts.factory.createStringLiteral(`./${className}`),
			undefined,
		),
	);

	// Creates property assignments for the agents object
	// Example generated: FoodManager: FoodManager
	const registryProperties = agentInfo.map(({ className }) =>
		ts.factory.createPropertyAssignment(
			// Creates: FoodManager (property name)
			ts.factory.createIdentifier(className),
			// Creates: FoodManager (property value - references the imported class)
			ts.factory.createIdentifier(className),
		),
	);

	// Creates the exported agents object
	// Example generated: export const agents = { FoodManager: FoodManager, ... };
	const registryExport = ts.factory.createVariableStatement(
		[ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)],
		ts.factory.createVariableDeclarationList(
			[
				ts.factory.createVariableDeclaration(
					ts.factory.createIdentifier("agents"),
					undefined,
					undefined,
					// Creates: { FoodManager: FoodManager, ... } (object literal)
					ts.factory.createObjectLiteralExpression(registryProperties, true),
				),
			],
			ts.NodeFlags.Const,
		),
	);

	const allNodes = ts.factory.createNodeArray([
		...importStatements,
		registryExport,
	]);

	const sourceFile = ts.createSourceFile(
		"placeholder.ts",
		"",
		ts.ScriptTarget.ESNext,
		true,
		ts.ScriptKind.TS,
	);
	const printer = ts.createPrinter();

	const typescriptCodeToString = printer.printList(
		ts.ListFormat.MultiLine,
		allNodes,
		sourceFile,
	);

	const transpileToJavaScript = ts.transpile(typescriptCodeToString, {
		module: ts.ModuleKind.ES2020,
		target: ts.ScriptTarget.ES2020,
	});

	if (!fs.existsSync(AGENTS_DIR)) {
		fs.mkdirSync(AGENTS_DIR, { recursive: true });
	}

	const agentsBarrelTs = path.resolve(AGENTS_DIR, "index.ts");
	const agentsBarrelJs = path.resolve(AGENTS_DIR, "index.js");
	fs.writeFileSync(agentsBarrelTs, typescriptCodeToString);
	fs.writeFileSync(agentsBarrelJs, transpileToJavaScript);
}

/**
 * Creates a metadata object for an agent.
 *
 * Metadata is used to track agent information across generation cycles:
 * - id: Normalized agent ID (without dashes)
 * - className: CamelCase class name (e.g., "FoodManager")
 * - displayName: Human-readable agent name
 * - camelCaseName: Lowercase first letter version (e.g., "foodManager")
 *
 * @param id - Normalized agent ID
 * @param className - CamelCase class name
 * @param displayName - Human-readable display name
 * @returns CachedAgentMetadata object
 */
function createMetadata(
	id: string,
	className: string,
	displayName: string,
): CachedAgentMetadata {
	return {
		id,
		className,
		displayName,
		camelCaseName: className.charAt(0).toLowerCase() + className.slice(1),
	};
}

/**
 * Generates TypeScript files for a single agent and returns its metadata.
 *
 * This function:
 * 1. Converts the agent name to a camelCase className
 * 2. Creates the TypeScript/JavaScript files for the agent
 * 3. Returns metadata for tracking purposes
 *
 * @param agentId - Normalized agent ID (without dashes)
 * @param agentName - Human-readable agent name from Notion
 * @param agentIcon - Icon data from Notion API (can be null)
 * @returns CachedAgentMetadata for the generated agent
 */
async function generateAgentTypes(
	agentId: string,
	agentName: string,
	agentIcon: { type: string; [key: string]: unknown } | null,
): Promise<CachedAgentMetadata> {
	const agentClassName = camelize(agentName);
	const agentDisplayName = agentName;

	await createTypescriptFileForAgent(agentId, agentName, agentClassName, agentIcon);

	const agentMetaData = createMetadata(
		agentId,
		agentClassName,
		agentDisplayName,
	);
	return agentMetaData;
}

/**
 * Creates the actual TypeScript and JavaScript files for an agent.
 *
 * Generates a file that exports a factory function which creates an AgentClient instance.
 * The generated file structure:
 * - Imports AgentClient from the package
 * - Defines constants for agent id, name, and icon
 * - Exports a function that takes `auth` and returns a new AgentClient instance
 *
 * Example generated code:
 * ```ts
 * import { AgentClient } from "@haustle/notion-orm/build/src/client/AgentClient";
 * const id = "agent-id-here";
 * const name = "Agent Name";
 * const icon = { type: "emoji", emoji: "🤖" };
 * export const FoodManager = (auth: string) => new AgentClient({ auth, id, name, icon });
 * ```
 *
 * @param agentId - Normalized agent ID (without dashes)
 * @param agentName - Human-readable agent name
 * @param agentClassName - CamelCase class name (e.g., "FoodManager")
 * @param agentIcon - Icon data from Notion API (can be null)
 */
async function createTypescriptFileForAgent(
	agentId: string,
	agentName: string,
	agentClassName: string,
	agentIcon: { type: string; [key: string]: unknown } | null,
) {
	// Creates: import { AgentClient } from "@haustle/notion-orm/build/src/client/AgentClient";
	const agentClientImport = createNameImport({
		namedImport: "AgentClient",
		path: AST_IMPORT_PATHS.AGENT_CLIENT,
	});

	// Creates: const id = "2c3c495da03c8078b95500927f02d213";
	const idVariable = ts.factory.createVariableStatement(
		undefined,
		ts.factory.createVariableDeclarationList(
			[
				ts.factory.createVariableDeclaration(
					ts.factory.createIdentifier("id"),
					undefined,
					undefined,
					ts.factory.createStringLiteral(agentId),
				),
			],
			ts.NodeFlags.Const,
		),
	);

	// Creates: const name = "Food Manager";
	const nameVariable = ts.factory.createVariableStatement(
		undefined,
		ts.factory.createVariableDeclarationList(
			[
				ts.factory.createVariableDeclaration(
					ts.factory.createIdentifier("name"),
					undefined,
					undefined,
					ts.factory.createStringLiteral(agentName),
				),
			],
			ts.NodeFlags.Const,
		),
	);

	// Creates: const icon = { type: "emoji", emoji: "🤖" } | null;
	const iconValue = agentIcon
		? (() => {
				switch (agentIcon.type) {
					case "emoji":
						return ts.factory.createObjectLiteralExpression(
							[
								ts.factory.createPropertyAssignment(
									ts.factory.createIdentifier("type"),
									ts.factory.createStringLiteral("emoji"),
								),
								ts.factory.createPropertyAssignment(
									ts.factory.createIdentifier("emoji"),
									ts.factory.createStringLiteral(
										(agentIcon.emoji as string) ?? "",
									),
								),
							],
							false,
						);
					case "file":
						return ts.factory.createObjectLiteralExpression(
							[
								ts.factory.createPropertyAssignment(
									ts.factory.createIdentifier("type"),
									ts.factory.createStringLiteral("file"),
								),
								ts.factory.createPropertyAssignment(
									ts.factory.createIdentifier("file"),
									ts.factory.createObjectLiteralExpression(
										[
											ts.factory.createPropertyAssignment(
												ts.factory.createIdentifier("url"),
												ts.factory.createStringLiteral(
													((agentIcon.file as { url: string })?.url) ?? "",
												),
											),
											ts.factory.createPropertyAssignment(
												ts.factory.createIdentifier("expiry_time"),
												ts.factory.createStringLiteral(
													((agentIcon.file as { expiry_time: string })
														?.expiry_time) ?? "",
												),
											),
										],
										false,
									),
								),
							],
							false,
						);
					case "external":
						return ts.factory.createObjectLiteralExpression(
							[
								ts.factory.createPropertyAssignment(
									ts.factory.createIdentifier("type"),
									ts.factory.createStringLiteral("external"),
								),
								ts.factory.createPropertyAssignment(
									ts.factory.createIdentifier("external"),
									ts.factory.createObjectLiteralExpression(
										[
											ts.factory.createPropertyAssignment(
												ts.factory.createIdentifier("url"),
												ts.factory.createStringLiteral(
													((agentIcon.external as { url: string })?.url) ??
														"",
												),
											),
										],
										false,
									),
								),
							],
							false,
						);
					case "custom_emoji":
						return ts.factory.createObjectLiteralExpression(
							[
								ts.factory.createPropertyAssignment(
									ts.factory.createIdentifier("type"),
									ts.factory.createStringLiteral("custom_emoji"),
								),
								ts.factory.createPropertyAssignment(
									ts.factory.createIdentifier("custom_emoji"),
									ts.factory.createObjectLiteralExpression(
										[
											ts.factory.createPropertyAssignment(
												ts.factory.createIdentifier("id"),
												ts.factory.createStringLiteral(
													((agentIcon.custom_emoji as { id: string })
														?.id) ?? "",
												),
											),
											ts.factory.createPropertyAssignment(
												ts.factory.createIdentifier("name"),
												ts.factory.createStringLiteral(
													((agentIcon.custom_emoji as { name: string })
														?.name) ?? "",
												),
											),
											ts.factory.createPropertyAssignment(
												ts.factory.createIdentifier("url"),
												ts.factory.createStringLiteral(
													((agentIcon.custom_emoji as { url: string })
														?.url) ?? "",
												),
											),
										],
										false,
									),
								),
							],
							false,
						);
					case "custom_agent_avatar":
						return ts.factory.createObjectLiteralExpression(
							[
								ts.factory.createPropertyAssignment(
									ts.factory.createIdentifier("type"),
									ts.factory.createStringLiteral("custom_agent_avatar"),
								),
								ts.factory.createPropertyAssignment(
									ts.factory.createIdentifier("custom_agent_avatar"),
									ts.factory.createObjectLiteralExpression(
										[
											ts.factory.createPropertyAssignment(
												ts.factory.createIdentifier("static_url"),
												ts.factory.createStringLiteral(
													((agentIcon.custom_agent_avatar as {
														static_url: string
													})?.static_url) ?? "",
												),
											),
											ts.factory.createPropertyAssignment(
												ts.factory.createIdentifier("animated_url"),
												ts.factory.createStringLiteral(
													((agentIcon.custom_agent_avatar as {
														animated_url: string
													})?.animated_url) ?? "",
												),
											),
										],
										false,
									),
								),
							],
							false,
						);
					default:
						return ts.factory.createNull();
				}
		  })()
		: ts.factory.createNull();

	const iconVariable = ts.factory.createVariableStatement(
		undefined,
		ts.factory.createVariableDeclarationList(
			[
				ts.factory.createVariableDeclaration(
					ts.factory.createIdentifier("icon"),
					undefined,
					undefined,
					iconValue,
				),
			],
			ts.NodeFlags.Const,
		),
	);

	// Creates: export const FoodManager = (auth: string) => new AgentClient({ auth, id, name, icon });
	const agentClientFunction = ts.factory.createVariableStatement(
		[ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)],
		ts.factory.createVariableDeclarationList(
			[
				ts.factory.createVariableDeclaration(
					// Creates: FoodManager (variable name)
					ts.factory.createIdentifier(agentClassName),
					undefined,
					undefined,
					// Creates: (auth: string) => new AgentClient({ auth, id, name })
					ts.factory.createArrowFunction(
						undefined,
						undefined,
						[
							// Creates: auth: string (parameter)
							ts.factory.createParameterDeclaration(
								undefined,
								undefined,
								ts.factory.createIdentifier("auth"),
								undefined,
								// Creates: string (type annotation)
								ts.factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword),
								undefined,
							),
						],
						undefined,
						undefined,
						// Creates: new AgentClient({ auth, id, name })
						ts.factory.createNewExpression(
							ts.factory.createIdentifier("AgentClient"),
							undefined,
							[
								// Creates: { auth, id, name, icon } (object literal argument)
								ts.factory.createObjectLiteralExpression(
									[
										ts.factory.createPropertyAssignment(
											ts.factory.createIdentifier("auth"),
											ts.factory.createIdentifier("auth"),
										),
										ts.factory.createPropertyAssignment(
											ts.factory.createIdentifier("id"),
											ts.factory.createIdentifier("id"),
										),
										ts.factory.createPropertyAssignment(
											ts.factory.createIdentifier("name"),
											ts.factory.createIdentifier("name"),
										),
										ts.factory.createPropertyAssignment(
											ts.factory.createIdentifier("icon"),
											ts.factory.createIdentifier("icon"),
										),
									],
									false,
								),
							],
						),
					),
				),
			],
			ts.NodeFlags.Const,
		),
	);

	const allNodes = ts.factory.createNodeArray([
		agentClientImport,
		idVariable,
		nameVariable,
		iconVariable,
		agentClientFunction,
	]);

	const sourceFile = ts.createSourceFile(
		"placeholder.ts",
		"",
		ts.ScriptTarget.ESNext,
		true,
		ts.ScriptKind.TS,
	);
	const printer = ts.createPrinter();

	const typescriptCodeToString = printer.printList(
		ts.ListFormat.MultiLine,
		allNodes,
		sourceFile,
	);

	const transpileToJavaScript = ts.transpile(typescriptCodeToString, {
		module: ts.ModuleKind.None,
		target: ts.ScriptTarget.ESNext,
	});

	if (!fs.existsSync(AGENTS_DIR)) {
		fs.mkdirSync(AGENTS_DIR, { recursive: true });
	}

	const tsFilePath = path.resolve(AGENTS_DIR, `${agentClassName}.ts`);
	const jsFilePath = path.resolve(AGENTS_DIR, `${agentClassName}.js`);

	fs.writeFileSync(tsFilePath, typescriptCodeToString);
	fs.writeFileSync(jsFilePath, transpileToJavaScript);
}

