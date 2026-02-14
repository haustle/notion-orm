import * as babelGenerator from "@babel/generator";
import * as parser from "@babel/parser";
import * as t from "@babel/types";
import fs from "fs";
import path from "path";
import { loadConfig } from "../config/loadConfig";

const generate = babelGenerator.default || babelGenerator;

export function shouldUseTypeScript(): boolean {
	const cwd = process.cwd();
	const tsConfigCandidates = [
		"tsconfig.json",
		"tsconfig.app.json",
		"tsconfig.base.json",
		"tsconfig.build.json",
	];

	for (const candidate of tsConfigCandidates) {
		if (fs.existsSync(path.join(cwd, candidate))) {
			return true;
		}
	}

	return false;
}

export function createConfigTemplate(isTS: boolean): string {
	const lines = [
		"// Be sure to create a .env.local file and add your NOTION_KEY",
		"",
		"// If you don't have an API key, sign up for free ",
		"// [here](https://developers.notion.com)",
		"",
		'const auth = process.env.NOTION_KEY || "your-notion-api-key-here";',
		"const NotionConfig = {",
		"\tauth,",
		"\tdatabases: [",
		"\t\t// Use: notion add <database-id> --type database",
		"\t],",
		"\tagents: [",
		"\t\t// Auto-populated by: notion generate",
		"\t],",
		"};",
		"",
		isTS ? "export default NotionConfig;" : "module.exports = NotionConfig;",
		"",
	];

	return `${lines.join("\n")}\n`;
}

export function showSetupInstructions(): void {
	console.log("\n📚 Setup Instructions:");
	console.log(
		"1. Run: notion init [--ts|--js] (defaults to TypeScript when tsconfig.json is present)",
	);
	console.log("2. Add your Notion integration token and database IDs");
	console.log("3. Run: notion generate (agents are auto-discovered)");

	console.log("\n📝 Example JavaScript config (notion.config.js):");
	console.log(`
// Be sure to create a .env.local file and add your NOTION_KEY

// If you don't have an API key, sign up for free 
// [here](https://developers.notion.com)

const auth = process.env.NOTION_KEY || "your-notion-api-key-here";
const NotionConfig = {
	auth,
	databases: [
		"database-id-1",
		"database-id-2",
	],
	agents: [
		// Auto-populated by: notion generate
	],
};

module.exports = NotionConfig;
	`);

	console.log("📝 Example TypeScript config (notion.config.ts):");
	console.log(`
// Be sure to create a .env.local file and add your NOTION_KEY

// If you don't have an API key, sign up for free 
// [here](https://developers.notion.com)

const auth = process.env.NOTION_KEY || "your-notion-api-key-here";
const NotionConfig = {
	auth,
	databases: [
		"database-id-1",
		"database-id-2",
	],
	agents: [
		// Auto-populated by: notion generate
	],
};

export default NotionConfig;
	`);

	console.log("\n🔗 Need help getting your integration token?");
	console.log(
		"   Visit: https://developers.notion.com/docs/create-a-notion-integration",
	);
}

export function validateAndGetUndashedUuid(id: string): string | undefined {
	const uuidPattern =
		/^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i;
	const undashedUuid = id.replace(/-/g, "");
	const isValidUndashedUuid = uuidPattern.test(undashedUuid);

	if (!isValidUndashedUuid) {
		return undefined;
	}

	return undashedUuid;
}

async function writeConfigFile(args: {
	configPath: string;
	config: unknown;
	isTS: boolean;
}): Promise<void> {
	const { configPath, config, isTS } = args;

	try {
		const configContent = isTS
			? `export default ${JSON.stringify(config, null, 4)};`
			: `module.exports = ${JSON.stringify(config, null, 4)};`;

		fs.writeFileSync(configPath, configContent);
	} catch (error: unknown) {
		console.error("❌ Error writing config file:");
		console.error(error);
		process.exit(1);
	}
}

export async function writeConfigFileWithAST(
	configPath: string,
	newDatabaseId: string,
	isTS: boolean,
	name?: string,
): Promise<boolean> {
	try {
		const originalContent = fs.readFileSync(configPath, "utf-8");

		const ast = parser.parse(originalContent, {
			sourceType: "module",
			allowImportExportEverywhere: true,
			plugins: isTS ? ["typescript"] : [],
		});

		let modified = false;

		function modifyDatabaseIdsInObject(objExpression: any): void {
			if (!objExpression || !objExpression.properties) return;
			for (const prop of objExpression.properties) {
				if (
					t.isObjectProperty(prop) &&
					t.isIdentifier(prop.key) &&
					prop.key.name === "databases" &&
					t.isArrayExpression(prop.value)
				) {
					const existingIds = prop.value.elements
						.filter((el: any) => {
							if (t.isStringLiteral(el)) return true;
							if (
								t.isExpressionStatement(el) &&
								t.isStringLiteral(el.expression)
							) {
								return true;
							}
							return false;
						})
						.map((el: any) => {
							if (t.isStringLiteral(el)) return el.value;
							if (
								t.isExpressionStatement(el) &&
								t.isStringLiteral(el.expression)
							) {
								return el.expression.value;
							}
							return null;
						})
						.filter((id: string | null) => id !== null);

					if (!existingIds.includes(newDatabaseId)) {
						const stringLiteral = t.stringLiteral(newDatabaseId);
						if (name) {
							t.addComment(stringLiteral, "trailing", ` ${name} `, false);
						}
						prop.value.elements.push(stringLiteral);
						modified = true;
					}
					break;
				}
			}
		}

		function visitNode(node: any): void {
			if (t.isVariableDeclarator(node) && t.isIdentifier(node.id)) {
				let objectExpr = node.init as any;
				if (objectExpr && t.isTSSatisfiesExpression(objectExpr)) {
					objectExpr = objectExpr.expression;
				}
				if (t.isObjectExpression(objectExpr)) {
					modifyDatabaseIdsInObject(objectExpr);
				}
			} else if (
				t.isAssignmentExpression(node) &&
				t.isMemberExpression(node.left) &&
				t.isIdentifier(node.left.property) &&
				node.left.property.name === "exports"
			) {
				let objectExpr = node.right as any;
				if (objectExpr && t.isTSSatisfiesExpression(objectExpr)) {
					objectExpr = objectExpr.expression;
				}
				if (t.isObjectExpression(objectExpr)) {
					modifyDatabaseIdsInObject(objectExpr);
				}
			} else if (t.isExportDefaultDeclaration(node)) {
				let objectExpr = node.declaration as any;
				if (objectExpr && t.isTSSatisfiesExpression(objectExpr)) {
					objectExpr = objectExpr.expression;
				}
				if (t.isObjectExpression(objectExpr)) {
					modifyDatabaseIdsInObject(objectExpr);
				}
			}
		}

		function traverse(node: any): void {
			if (!node || typeof node !== "object") return;

			visitNode(node);

			for (const key in node) {
				if (node[key] && typeof node[key] === "object") {
					if (Array.isArray(node[key])) {
						node[key].forEach(traverse);
					} else {
						traverse(node[key]);
					}
				}
			}
		}

		traverse(ast);

		if (modified) {
			const output = generate(ast, {
				retainLines: true,
				concise: false,
			});

			fs.writeFileSync(configPath, output.code);
			return true;
		}

		return false;
	} catch (error: unknown) {
		console.error("❌ Error updating config file with AST:");
		console.error(error);
		console.log("⚠️  Falling back to simple JSON replacement...");

		const config = await loadConfig(configPath);
		if (!config.databases) {
			config.databases = [];
		}
		if (!config.databases.includes(newDatabaseId)) {
			config.databases.push(newDatabaseId);
			await writeConfigFile({ configPath, config, isTS });
			return true;
		}
		return false;
	}
}

export async function syncAgentsInConfigWithAST(
	configPath: string,
	agents: Array<{ id: string; name: string }>,
	isTS: boolean,
): Promise<boolean> {
	try {
		const originalContent = fs.readFileSync(configPath, "utf-8");

		const ast = parser.parse(originalContent, {
			sourceType: "module",
			allowImportExportEverywhere: true,
			plugins: isTS ? ["typescript"] : [],
		});

		let modified = false;

		// Normalize agent IDs (remove dashes) for comparison
		const normalizedAgentIds = new Set(
			agents.map((a) => a.id.replace(/-/g, "")),
		);

		function modifyAgentsInObject(objExpression: any): void {
			if (!objExpression || !objExpression.properties) return;

			// Find the agents property
			let agentsProp: any = null;
			for (const prop of objExpression.properties) {
				if (
					t.isObjectProperty(prop) &&
					t.isIdentifier(prop.key) &&
					prop.key.name === "agents"
				) {
					agentsProp = prop;
					break;
				}
			}

			// Create agents array if it doesn't exist
			if (!agentsProp) {
				const newElements = agents.map((agent) => {
					const normalizedId = agent.id.replace(/-/g, "");
					const stringLiteral = t.stringLiteral(normalizedId);
					t.addComment(stringLiteral, "trailing", ` ${agent.name} `, false);
					return stringLiteral;
				});

				const agentsArray = t.arrayExpression(newElements);
				const newAgentsProp = t.objectProperty(
					t.identifier("agents"),
					agentsArray,
				);
				objExpression.properties.push(newAgentsProp);
				modified = true;
				return;
			}

			// Update existing agents array
			if (t.isArrayExpression(agentsProp.value)) {
				// Extract existing agent IDs from config
				const existingElements = agentsProp.value.elements.filter((el: any) =>
					t.isStringLiteral(el),
				);
				const existingIds = existingElements.map((el: any) => el.value);

				// Check if we need to update
				const existingIdsSet = new Set(existingIds);
				const needsUpdate =
					agents.length !== existingIds.length ||
					agents.some((a) => !existingIdsSet.has(a.id.replace(/-/g, ""))) ||
					existingIds.some((id: string) => !normalizedAgentIds.has(id));

				if (needsUpdate) {
					// Replace entire array with new agents
					const newElements = agents.map((agent) => {
						const normalizedId = agent.id.replace(/-/g, "");
						const stringLiteral = t.stringLiteral(normalizedId);
						t.addComment(stringLiteral, "trailing", ` ${agent.name} `, false);
						return stringLiteral;
					});

					agentsProp.value.elements = newElements;
					modified = true;
				}
			}
		}

		function visitNode(node: any): void {
			if (t.isVariableDeclarator(node) && t.isIdentifier(node.id)) {
				let objectExpr = node.init as any;
				if (objectExpr && t.isTSSatisfiesExpression(objectExpr)) {
					objectExpr = objectExpr.expression;
				}
				if (t.isObjectExpression(objectExpr)) {
					modifyAgentsInObject(objectExpr);
				}
			} else if (
				t.isAssignmentExpression(node) &&
				t.isMemberExpression(node.left) &&
				t.isIdentifier(node.left.property) &&
				node.left.property.name === "exports"
			) {
				let objectExpr = node.right as any;
				if (objectExpr && t.isTSSatisfiesExpression(objectExpr)) {
					objectExpr = objectExpr.expression;
				}
				if (t.isObjectExpression(objectExpr)) {
					modifyAgentsInObject(objectExpr);
				}
			} else if (t.isExportDefaultDeclaration(node)) {
				let objectExpr = node.declaration as any;
				if (objectExpr && t.isTSSatisfiesExpression(objectExpr)) {
					objectExpr = objectExpr.expression;
				}
				if (t.isObjectExpression(objectExpr)) {
					modifyAgentsInObject(objectExpr);
				}
			}
		}

		function traverse(node: any): void {
			if (!node || typeof node !== "object") return;

			visitNode(node);

			for (const key in node) {
				if (node[key] && typeof node[key] === "object") {
					if (Array.isArray(node[key])) {
						node[key].forEach(traverse);
					} else {
						traverse(node[key]);
					}
				}
			}
		}

		traverse(ast);

		if (modified) {
			const output = generate(ast, {
				retainLines: true,
				concise: false,
			});

			fs.writeFileSync(configPath, output.code);
			return true;
		}

		return false;
	} catch (error: unknown) {
		console.error("❌ Error updating config file with AST:");
		console.error(error);
		console.log("⚠️  Falling back to simple JSON replacement...");

		const config = await loadConfig(configPath);
		config.agents = agents.map((a) => a.id.replace(/-/g, ""));
		await writeConfigFile({ configPath, config, isTS });
		return true;
	}
}

export function isHelpCommand(args: string[]): boolean {
	const possibleArgument = args.length >= 1 ? args[0] : null;
	if (!possibleArgument) {
		return false;
	}
	switch (possibleArgument) {
		case "help":
		case "--help":
		case "-h":
			return true;
		default:
			return false;
	}
}
