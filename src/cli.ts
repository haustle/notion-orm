#!/usr/bin/env bun

import fs from "fs";
import { createDatabaseTypes } from "./type-generation.js";
import path from "path";
import { findConfigFile, loadConfig, getNotionConfig } from "./config-utils.js";
import * as parser from "@babel/parser";
import * as babelGenerator from "@babel/generator";
import * as t from "@babel/types";

// @ts-ignore - Babel generator has inconsistent exports
const generate = babelGenerator.default || babelGenerator;

// Config validation function
function validateConfig(config: any): void {
	if (!config) {
		console.error("❌ Config file is empty or invalid");
		showSetupInstructions();
		process.exit(1);
	}

	if (!config.auth) {
		console.error("❌ Missing 'auth' field in config");
		console.error("   Please add your Notion integration token");
		showSetupInstructions();
		process.exit(1);
	}

	if (!config.databaseIds) {
		console.error("❌ Missing 'databaseIds' field in config");
		showSetupInstructions();
		process.exit(1);
	}

	if (!Array.isArray(config.databaseIds)) {
		console.error("❌ 'databaseIds' must be an array");
		showSetupInstructions();
		process.exit(1);
	}

	if (config.databaseIds.length === 0) {
		console.error("❌ 'databaseIds' array cannot be empty");
		console.error("   Please add at least one database ID");
		showSetupInstructions();
		process.exit(1);
	}
}

// Show helpful setup instructions
function showSetupInstructions(): void {
	console.log("\n📚 Setup Instructions:");
	console.log("1. Create a notion.config.js file in your project root");
	console.log("2. Add your Notion integration token and database IDs");
	console.log("3. Run: notion generate");
	
	console.log("\n📝 Example JavaScript config (notion.config.js):");
	console.log(`
module.exports = {
    auth: "secret_your-notion-integration-token",
    databaseIds: ["database-id-1", "database-id-2"]
};
	`);

	console.log("📝 Example TypeScript config (notion.config.ts):");
	console.log(`
export default {
    auth: "secret_your-notion-integration-token",
    databaseIds: ["database-id-1", "database-id-2"]
};
	`);

	console.log("\n🔗 Need help getting your integration token?");
	console.log("   Visit: https://developers.notion.com/docs/create-a-notion-integration");
}

// Note: Configuration utilities are now imported from config-utils.ts

function validateDatabaseId(databaseId: string): boolean {
	// Notion database IDs are UUIDs (with or without dashes)
	const uuidPattern = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i;
	const cleanId = databaseId.replace(/-/g, '');
	return uuidPattern.test(databaseId) || (cleanId.length === 32 && /^[0-9a-f]+$/i.test(cleanId));
}

function extractDatabaseIdFromUrl(input: string): string | null {
	// Handle various Notion URL formats:
	// https://www.notion.so/workspace/DATABASE_ID?v=...
	// https://notion.so/workspace/DATABASE_ID?v=...
	// https://www.notion.so/DATABASE_ID?v=...
	
	try {
		const url = new URL(input);
		
		// Check if it's a valid Notion domain
		if (!url.hostname.includes('notion.so')) {
			return null;
		}
		
		// Extract pathname and find the first UUID-like string
		const pathSegments = url.pathname.split('/').filter(segment => segment.length > 0);
		
		for (const segment of pathSegments) {
			// Look for 32-character hex strings (undashed UUIDs)
			if (/^[0-9a-f]{32}$/i.test(segment)) {
				return segment;
			}
			// Also check for dashed UUIDs
			if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment)) {
				return segment.replace(/-/g, ''); // Return undashed version
			}
		}
		
		return null;
	} catch (error) {
		return null; // Not a valid URL
	}
}

function processInputForDatabaseId(input: string): { databaseId: string; wasUrl: boolean } | null {
	// First check if it's a URL
	if (input.startsWith('http://') || input.startsWith('https://')) {
		const extractedId = extractDatabaseIdFromUrl(input);
		if (extractedId) {
			return { databaseId: extractedId, wasUrl: true };
		}
		return null; // Invalid URL or couldn't extract ID
	}
	
	// If not a URL, treat as direct database ID and validate
	if (validateDatabaseId(input)) {
		// Ensure we return undashed format for consistency
		const cleanId = input.replace(/-/g, '');
		return { databaseId: cleanId, wasUrl: false };
	}
	
	return null; // Invalid database ID format
}

async function writeConfigFile(configPath: string, config: any, isTS: boolean): Promise<void> {
	try {
		let configContent: string;
		
		if (isTS) {
			// TypeScript format
			configContent = `export default ${JSON.stringify(config, null, 4)};`;
		} else {
			// JavaScript format
			configContent = `module.exports = ${JSON.stringify(config, null, 4)};`;
		}
		
		fs.writeFileSync(configPath, configContent);
	} catch (error: any) {
		console.error("❌ Error writing config file:");
		console.error(error.message);
		process.exit(1);
	}
}

async function writeConfigFileWithAST(configPath: string, newDatabaseId: string, isTS: boolean): Promise<boolean> {
	try {
		// Read the original file content
		const originalContent = fs.readFileSync(configPath, 'utf-8');
		
		// Parse the file as AST
		const ast = parser.parse(originalContent, {
			sourceType: 'module',
			allowImportExportEverywhere: true,
			plugins: isTS ? ['typescript'] : [],
		});

		// Find and modify the databaseIds array
		let modified = false;
		
		function modifyDatabaseIdsInObject(objExpression: any): void {
			for (const prop of objExpression.properties) {
				if (t.isObjectProperty(prop) && 
					t.isIdentifier(prop.key) && 
					prop.key.name === 'databaseIds' &&
					t.isArrayExpression(prop.value)) {
					
					// Check if the database ID already exists
					const existingIds = prop.value.elements
						.filter((el: any) => t.isStringLiteral(el))
						.map((el: any) => el.value);
					
					if (!existingIds.includes(newDatabaseId)) {
						// Add the new database ID to the array
						prop.value.elements.push(t.stringLiteral(newDatabaseId));
						modified = true;
					}
					break;
				}
			}
		}

		function visitNode(node: any): void {
			if (t.isVariableDeclarator(node) && t.isIdentifier(node.id)) {
				// Handle: const NotionConfig = { ... }
				if (t.isObjectExpression(node.init)) {
					modifyDatabaseIdsInObject(node.init);
				}
			} else if (t.isAssignmentExpression(node) && 
					   t.isMemberExpression(node.left) &&
					   t.isIdentifier(node.left.property) && 
					   node.left.property.name === 'exports') {
				// Handle: module.exports = { ... }
				if (t.isObjectExpression(node.right)) {
					modifyDatabaseIdsInObject(node.right);
				}
			} else if (t.isExportDefaultDeclaration(node)) {
				// Handle: export default { ... }
				if (t.isObjectExpression(node.declaration)) {
					modifyDatabaseIdsInObject(node.declaration);
				}
			}
		}

		// Traverse the AST
		function traverse(node: any): void {
			if (!node || typeof node !== 'object') return;
			
			visitNode(node);
			
			// Recursively traverse child nodes
			for (const key in node) {
				if (node[key] && typeof node[key] === 'object') {
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
			// Generate the code from the modified AST
			const output = generate(ast, {
				retainLines: true,
				concise: false,
			});
			
			// Write the modified content back to the file
			fs.writeFileSync(configPath, output.code);
			return true;
		}
		
		return false; // No modification needed (ID already exists)
		
	} catch (error: any) {
		console.error("❌ Error updating config file with AST:");
		console.error(error.message);
		console.log("⚠️  Falling back to simple JSON replacement...");
		
		// Fallback to loading and re-saving config
		const config = await loadConfig(configPath, isTS);
		if (!config.databaseIds) {
			config.databaseIds = [];
		}
		if (!config.databaseIds.includes(newDatabaseId)) {
			config.databaseIds.push(newDatabaseId);
			await writeConfigFile(configPath, config, isTS);
			return true;
		}
		return false;
	}
}

async function runGenerate(): Promise<void> {
	console.log(`🔍 Looking for config in: ${process.cwd()}`);
	
	try {
		// Use the centralized configuration loading
		const config = await getNotionConfig();
		
		// Validate the config (this validation is now redundant since getNotionConfig does validation)
		validateConfig(config);

		const configFile = await findConfigFile();
		if (configFile) {
			console.log(`✅ Found ${configFile.isTS ? 'notion.config.ts' : 'notion.config.js'}`);
		} else {
			console.log("✅ Using environment variable configuration");
		}

		console.log("🚀 Generating types...");
		
		const { databaseNames } = await createDatabaseTypes();
		
		if (databaseNames.length === 0) {
			console.log("⚠️  Generated no types");
		} else {
			console.log("✅ Generated types for the following databases:");
			for (let x = 0; x < databaseNames.length; x++) {
				console.log(`   ${x + 1}. ${databaseNames[x]}`);
			}
		}
	} catch (error: any) {
		if (error.message.includes("No notion.config.js/ts file found")) {
			console.error("❌ No config file found");
			console.error("   Could not find notion.config.js or notion.config.ts in project root");
			showSetupInstructions();
		} else {
			console.error("❌ Error generating types:");
			console.error(error.message);
		}
		process.exit(1);
	}
}

async function runAdd(input: string): Promise<void> {
	const processed = processInputForDatabaseId(input);
	
	if (!processed) {
		console.error("❌ Invalid input format");
		console.error("   Expected formats:");
		console.error("   • Database ID: 12345678-1234-1234-1234-123456789abc (with or without dashes)");
		console.error("   • Notion URL: https://www.notion.so/workspace/c88c5ccf109f4e71937d5d3b3ddfeade?v=...");
		process.exit(1);
	}
	
	const { databaseId, wasUrl } = processed;
	
	if (wasUrl) {
		console.log(`🔗 Extracted database ID from URL: ${databaseId}`);
	}

	const configFile = await findConfigFile();
	
	if (!configFile) {
		console.error("❌ No config file found");
		console.error("   Could not find notion.config.js or notion.config.ts in project root");
		console.error("   Please create a config file first or run 'notion generate' to see setup instructions");
		process.exit(1);
	}

	console.log(`🔍 Found config: ${configFile.isTS ? 'notion.config.ts' : 'notion.config.js'}`);
	
	const config = await loadConfig(configFile.path, configFile.isTS);
	
	// Ensure databaseIds array exists
	if (!config.databaseIds) {
		config.databaseIds = [];
	}

	// Check if database ID already exists
	if (config.databaseIds.includes(databaseId)) {
		console.log(`⚠️  Database ID ${databaseId} is already in the configuration`);
		console.log("   Skipping addition, running generate...");
	} else {
		// Use AST-based modification to preserve structure
		const wasModified = await writeConfigFileWithAST(configFile.path, databaseId, configFile.isTS);
		
		if (wasModified) {
			console.log(`✅ Added database ID ${databaseId} to configuration`);
			console.log("   Original structure and formatting preserved");
		} else {
			console.log(`⚠️  Database ID ${databaseId} was already in the configuration`);
		}
	}

	// Reload config to get the updated databaseIds count
	const updatedConfig = await loadConfig(configFile.path, configFile.isTS);
	console.log(`📝 Current database IDs: ${updatedConfig.databaseIds.length}`);
	
	// Auto-run generate command
	console.log("🔄 Running generate to fetch schema...");
	await runGenerate();
}

function showUsage(): void {
	console.log("📖 Notion ORM CLI");
	console.log("Usage:");
	console.log("  notion generate                    - Generate types from configured databases");
	console.log("  notion add <database-id-or-url>   - Add database to config and generate types");
	console.log("\nExamples:");
	console.log("  notion add 12345678-1234-1234-1234-123456789abc");
	console.log("  notion add c88c5ccf109f4e71937d5d3b3ddfeade");
	console.log("  notion add https://www.notion.so/workspace/c88c5ccf109f4e71937d5d3b3ddfeade?v=123");
	console.log("  notion generate");
	showSetupInstructions();
}

async function main() {
	const args = process.argv.slice(2);

	if (args.length === 1 && args[0] === "generate") {
		await runGenerate();
	} else if (args.length === 2 && args[0] === "add") {
		await runAdd(args[1]);
	} else {
		showUsage();
	}
}

main().catch((error: any) => {
	console.error("❌ Unexpected error:");
	console.error(error);
	process.exit(1);
});
