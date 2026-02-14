/**
 * CLI orchestration for database type generation.
 * Handles metadata management, file generation coordination, and CLI entry point.
 */

import { Client } from "@notionhq/client";
import fs from "fs";
import path from "path";
import * as ts from "typescript";
import { getNotionConfig } from "../../config/loadConfig";
import {
	AGENTS_DIR,
	AST_FS_FILENAMES,
	AST_FS_PATHS,
	AST_IMPORT_PATHS,
	AST_RUNTIME_CONSTANTS,
	DATABASES_DIR,
} from "../shared/constants";
import { createTypescriptFileForDatabase } from "./database-file-writer";

function getMetadataFilePath(): string {
	return AST_FS_PATHS.metadataFile;
}

export function readDatabaseMetadata(): CachedDatabaseMetadata[] {
	try {
		const metadataFile = getMetadataFilePath();
		if (!fs.existsSync(metadataFile)) {
			return [];
		}
		const content = fs.readFileSync(metadataFile, "utf-8");
		return JSON.parse(content) as CachedDatabaseMetadata[];
	} catch (error) {
		return [];
	}
}

function writeDatabaseMetadata(metadata: CachedDatabaseMetadata[]): void {
	if (!fs.existsSync(DATABASES_DIR)) {
		fs.mkdirSync(DATABASES_DIR, { recursive: true });
	}
	const metadataFile = getMetadataFilePath();
	fs.writeFileSync(metadataFile, JSON.stringify(metadata, null, 2));
}

interface CachedDatabaseMetadata {
	id: string;
	className: string;
	displayName: string;
	camelCaseName: string;
}

type CreateDatabaseTypesOptions =
	| { type: "all" }
	| { type: "incremental"; id: string };

export const createDatabaseTypes = async (
	options: CreateDatabaseTypesOptions,
): Promise<{ databaseNames: string[] }> => {
	const config = await getNotionConfig();

	if (!config.auth) {
		console.error(
			"⚠️ Integration key not found. Inside 'notion.config.js/ts' file, please pass a valid Notion Integration Key",
		);
		process.exit(1);
	}

	const client = new Client({
		auth: config.auth,
		notionVersion: AST_RUNTIME_CONSTANTS.NOTION_API_VERSION,
	});

	// Determine target database IDs and generation mode
	const isFullGenerate = options.type === "all";
	const targetIds = isFullGenerate ? config.databases : [options.id];

	if (targetIds.length === 0) {
		console.error("Please pass some database Ids");
		process.exit(1);
	}

	// Prepare for full or incremental generation
	let metadataMap: Map<string, CachedDatabaseMetadata>;

	if (isFullGenerate) {
		if (fs.existsSync(DATABASES_DIR)) {
			const files = fs.readdirSync(DATABASES_DIR);
			for (const file of files) {
				const filePath = path.join(DATABASES_DIR, file);
				try {
					if (fs.statSync(filePath).isFile()) {
						fs.unlinkSync(filePath);
					}
				} catch (e) {
					// Ignore errors
				}
			}
		}
		console.log("🔄 Updating all database schemas...");
		metadataMap = new Map();
	} else {
		metadataMap = prepareIncrementalMetadata(config.databases);
	}

	const databaseNames: string[] = [];

	for (const databaseId of targetIds) {
		try {
			const dbMetaData = await generateDatabaseTypes(client, databaseId);
			metadataMap.set(dbMetaData.id, dbMetaData);
			databaseNames.push(dbMetaData.displayName);
		} catch (error) {
			console.error(`❌ Error generating types for: ${databaseId}`);
			console.error(error);
			return { databaseNames: [] };
		}
	}

	// Convert map to array and persist metadata
	const databasesMetadata = Array.from(metadataMap.values());
	writeDatabaseMetadata(databasesMetadata);

	// Update barrel file and source index
	createDatabaseBarrelFile({
		databaseInfo: databasesMetadata.map((db) => ({
			className: db.className,
			displayName: db.displayName,
		})),
	});

	const agentsMetadata = readAgentMetadataFromDisk();
	updateSourceIndexFile(databasesMetadata, agentsMetadata);

	return { databaseNames };
};

// Creates file that exports all generated databases in a registry format
function createDatabaseBarrelFile(args: {
	databaseInfo: Array<{ className: string; displayName: string }>;
}) {
	const { databaseInfo } = args;

	// Create import statements for each database
	const importStatements = databaseInfo.map(({ className }) =>
		ts.factory.createImportDeclaration(
			undefined,
			ts.factory.createImportClause(
				false,
				undefined,
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

	const registryProperties = databaseInfo.map(({ className, displayName }) =>
		ts.factory.createPropertyAssignment(
			ts.factory.createIdentifier(className),
			ts.factory.createIdentifier(className),
		),
	);

	const registryExport = ts.factory.createVariableStatement(
		[ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)],
		ts.factory.createVariableDeclarationList(
			[
				ts.factory.createVariableDeclaration(
					ts.factory.createIdentifier("databases"),
					undefined,
					undefined,
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

	if (!fs.existsSync(DATABASES_DIR)) {
		fs.mkdirSync(DATABASES_DIR, { recursive: true });
	}

	fs.writeFileSync(AST_FS_PATHS.databaseBarrelTs, typescriptCodeToString);
	fs.writeFileSync(AST_FS_PATHS.databaseBarrelJs, transpileToJavaScript);
}

export interface CachedAgentMetadata {
		id: string;
		className: string;
		displayName: string;
		camelCaseName: string;
	}

export function readAgentMetadataFromDisk(): CachedAgentMetadata[] {
	try {
		const metadataFile = path.resolve(AGENTS_DIR, "metadata.json");
		if (!fs.existsSync(metadataFile)) {
			return [];
		}
		const content = fs.readFileSync(metadataFile, "utf-8");
		return JSON.parse(content) as CachedAgentMetadata[];
	} catch (error) {
		return [];
	}
}

export function updateSourceIndexFile(
		databasesMetadata: CachedDatabaseMetadata[],
		agentsMetadata: CachedAgentMetadata[],
	): void {
		if (databasesMetadata.length === 0 && agentsMetadata.length === 0) {
			createEmptySourceIndexFile();
			return;
		}

		const databaseImports = databasesMetadata
			.map(
				(db) =>
					`import { ${db.camelCaseName} } from "${AST_IMPORT_PATHS.databaseClass(
						db.className,
					)}";`,
			)
			.join("\n");

		const agentImports = agentsMetadata
			.map(
				(agent) =>
					`import { ${agent.camelCaseName} } from "${AST_IMPORT_PATHS.agentClass(
						agent.className,
					)}";`,
			)
			.join("\n");

		const imports = [databaseImports, agentImports].filter(Boolean).join("\n");

		const databasesTypeProps =
			databasesMetadata.length > 0
				? databasesMetadata
						.map(
							(db) =>
								`        ${db.camelCaseName}: ReturnType<typeof ${db.camelCaseName}>;`,
						)
						.join("\n")
				: "";

		const agentsTypeProps =
			agentsMetadata.length > 0
				? agentsMetadata
						.map(
							(agent) =>
								`        ${agent.camelCaseName}: ReturnType<typeof ${agent.camelCaseName}>;`,
						)
						.join("\n")
				: "";

		const databasesInitCode =
			databasesMetadata.length > 0
				? databasesMetadata
						.map(
							(db) =>
								`            ${db.camelCaseName}: ${db.camelCaseName}(config.auth),`,
						)
						.join("\n")
				: "";

		const agentsInitCode =
			agentsMetadata.length > 0
				? agentsMetadata
						.map(
							(agent) =>
								`            ${agent.camelCaseName}: ${agent.camelCaseName}(config.auth),`,
						)
						.join("\n")
				: "";

		const notionORMClass = `
import NotionORMBase, { AgentClient, DatabaseClient } from "./base";
export type { NotionConfigType, Query } from "./base";
export { AgentClient, DatabaseClient };

/**
 * Extended NotionORM class with generated database and agent implementations
 * This class extends the base NotionORM and adds the generated databases and agents properties.
 */
class NotionORM extends NotionORMBase {
    public databases: {
${databasesTypeProps || "        // No databases configured"}
    };
    public agents: {
${agentsTypeProps || "        // No agents configured"}
    };

    constructor(config: { auth: string }) {
        super(config);
        this.databases = {
${databasesInitCode || ""}
        };
        this.agents = {
${agentsInitCode || ""}
        };
    }
}

export default NotionORM;
`;

		const completeCode = `${imports}\n${notionORMClass}`;

		writeIndexFiles(completeCode, databasesMetadata, agentsMetadata);
	}

function writeIndexFiles(
	typescriptCode: string,
	databasesMetadata: CachedDatabaseMetadata[],
	agentsMetadata: CachedAgentMetadata[],
): void {
	if (!fs.existsSync(AST_FS_PATHS.BUILD_SRC_DIR)) {
		fs.mkdirSync(AST_FS_PATHS.BUILD_SRC_DIR, { recursive: true });
	}

	const compiledJS = ts.transpile(typescriptCode, {
		module: ts.ModuleKind.ES2020,
		target: ts.ScriptTarget.ES2020,
		esModuleInterop: true,
		allowSyntheticDefaultImports: true,
	});

	fs.writeFileSync(AST_FS_PATHS.buildIndexJs, compiledJS);

	const declarationCode = generateDeclarationFile(
		databasesMetadata,
		agentsMetadata,
	);
	fs.writeFileSync(AST_FS_PATHS.buildIndexDts, declarationCode);

	if (fs.existsSync(AST_FS_PATHS.buildIndexDtsMap)) {
		fs.unlinkSync(AST_FS_PATHS.buildIndexDtsMap);
	}
}

function generateDeclarationFile(
	databasesMetadata: CachedDatabaseMetadata[],
	agentsMetadata: CachedAgentMetadata[],
): string {
	if (databasesMetadata.length === 0 && agentsMetadata.length === 0) {
		return `export default class NotionORM {
    constructor(config: { auth: string });
}`;
	}

	const databasesProperties = databasesMetadata
		.map(
			(db) =>
				`        ${
					db.camelCaseName
				}: ReturnType<typeof import("${AST_IMPORT_PATHS.databaseClass(
					db.className,
				)}").${db.camelCaseName}>;`,
		)
		.join("\n");

	const agentsProperties = agentsMetadata
		.map(
			(agent) =>
				`        ${
					agent.camelCaseName
				}: ReturnType<typeof import("${AST_IMPORT_PATHS.agentClass(
					agent.className,
				)}").${agent.camelCaseName}>;`,
		)
		.join("\n");

	return `
import NotionORMBase, { AgentClient, DatabaseClient } from "./base";
export type { NotionConfigType, Query } from "./base";
export { AgentClient, DatabaseClient };

export default class NotionORM extends NotionORMBase {
    public databases: {
${databasesProperties || "        // No databases configured"}
    };
    public agents: {
${agentsProperties || "        // No agents configured"}
    };
    constructor(config: { auth: string });
}`;
}

function createEmptySourceIndexFile(): void {
	const emptyClass = `
import NotionORMBase, { AgentClient, DatabaseClient } from "./base";
export type { NotionConfigType, Query } from "./base";
export { AgentClient, DatabaseClient };

/**
 * Extended NotionORM class - no databases configured
 */
class NotionORM extends NotionORMBase {
    public databases: {} = {};
    public agents: {} = {};

    constructor(config: { auth: string }) {
        super(config);
        console.warn("⚠️  No databases found. Please run '${AST_RUNTIME_CONSTANTS.CLI_GENERATE_COMMAND}' to generate database types.");
    }
}

export default NotionORM;
`;

	const completeCode = `${emptyClass}`;
	writeIndexFiles(completeCode, [], []);
}

function createMetadata(
	id: string,
	className: string,
	displayName: string,
): CachedDatabaseMetadata {
	return {
		id,
		className,
		displayName,
		camelCaseName: className.charAt(0).toLowerCase() + className.slice(1),
	};
}

async function generateDatabaseTypes(
	client: Client,
	databaseId: string,
): Promise<CachedDatabaseMetadata> {
	const databaseObject = await client.dataSources.retrieve({
		data_source_id: databaseId,
	});

	const {
		databaseClassName,
		databaseName,
		databaseId: id,
	} = await createTypescriptFileForDatabase(databaseObject);

	const databaseMetaData = createMetadata(id, databaseClassName, databaseName);
	return databaseMetaData;
}

function prepareIncrementalMetadata(
	configDatabaseIds: string[],
): Map<string, CachedDatabaseMetadata> {
	const cachedDatabaseMetadata = readDatabaseMetadata();
	const metadataMap = new Map<string, CachedDatabaseMetadata>();

	const configIdsSet = new Set(configDatabaseIds);
	for (const dbMetadata of cachedDatabaseMetadata) {
		if (configIdsSet.has(dbMetadata.id)) {
			metadataMap.set(dbMetadata.id, dbMetadata);
		}
	}

	return metadataMap;
}
