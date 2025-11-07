/**
 * Internal module for type generation - used only by CLI
 */

import { Client } from "@notionhq/client";
import type { GetDataSourceResponse } from "@notionhq/client/build/src/api-endpoints.js";
import fs from "fs";
import path from "path";
import * as ts from "typescript";
import { fileURLToPath } from "url";
import { getNotionConfig } from "./config-utils.js";
import { DATABASES_DIR } from "./constants.js";
import { createTypescriptFileForDatabase } from "./GenerateTypes.js";
import type { NotionConfigType } from "./types.js";

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface DatabaseMetadata {
	className: string; // "BookTracker"
	displayName: string; // "Book Tracker"
	camelCaseName: string; // "bookTracker"
	schemaTypeName: string; // "DatabaseSchemaType"
	columnTypeName: string; // "ColumnNameToColumnType"
}

export const createDatabaseTypes = async (args?: NotionConfigType) => {
	// Use new lazy configuration loading if no args provided
	const config = args || (await getNotionConfig());
	const { auth, databaseIds } = config;

	// Making sure the user is passing valid arguments
	if (!auth) {
		console.error("Please pass a valid Notion Integration Key");
		process.exit(1);
	}

	if (databaseIds.length < 0) {
		console.error("Please pass some database Ids");
		process.exit(1);
	}

	// Initialize client
	const NotionClient = new Client({
		auth: auth,
		notionVersion: "2025-09-03",
	});

	const databaseNames: string[] = [];
	const databasesMetadata: DatabaseMetadata[] = [];

	// Remove the previous databases, so they can call get updated
	fs.rmdir(DATABASES_DIR, () =>
		console.log("Deleting current database types..."),
	);

	for (const database_id of databaseIds) {
		let databaseObject: GetDataSourceResponse;

		try {
			// Get the database schema
			databaseObject = await NotionClient.dataSources.retrieve({
				data_source_id: database_id,
			});

			// Create typescript file based on schema
			const { databaseClassName, databaseName } =
				await createTypescriptFileForDatabase(databaseObject);

			databaseNames.push(databaseName);

			// Create comprehensive metadata for each database
			const metadata: DatabaseMetadata = {
				className: databaseClassName,
				displayName: databaseName,
				camelCaseName:
					databaseClassName.charAt(0).toLowerCase() +
					databaseClassName.slice(1),
				schemaTypeName: "DatabaseSchemaType",
				columnTypeName: "ColumnNameToColumnType",
			};

			databasesMetadata.push(metadata);
		} catch (e) {
			console.error(e);
			return { databaseNames: [] };
		}
	}

	// Create a file that exports all databases in a registry format for runtime loading
	createDatabaseBarrelFile({
		databaseInfo: databasesMetadata.map((db) => ({
			className: db.className,
			displayName: db.displayName,
		})),
	});

	// Update the source index.ts file with static imports and NotionORM class
	updateSourceIndexFile(databasesMetadata);

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

	// Create the database registry object
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
		fs.mkdirSync(DATABASES_DIR);
	}

	// Create TypeScript and JavaScript file
	fs.writeFileSync(
		path.resolve(DATABASES_DIR, "index.ts"),
		typescriptCodeToString,
	);
	fs.writeFileSync(
		path.resolve(DATABASES_DIR, "index.js"),
		transpileToJavaScript,
	);
}

// Updates src/index.ts with static imports and NotionORM class
function updateSourceIndexFile(databasesMetadata: DatabaseMetadata[]): void {
	if (databasesMetadata.length === 0) {
		// Create empty class when no databases
		createEmptySourceIndexFile();
		return;
	}

	// Create import statements for each database
	const imports = databasesMetadata
		.map((db) => `import { ${db.camelCaseName} } from "../db/${db.className}";`)
		.join("\n");

	// Create the NotionORM class with proper typing
	const notionORMClass = `
/**
 * Main NotionORM class that provides access to all generated database types
 */
export default class NotionORM {
${databasesMetadata.map((db) => `    public ${db.camelCaseName}: ReturnType<typeof ${db.camelCaseName}>;`).join("\n")}

    constructor(config: { auth: string }) {
${databasesMetadata.map((db) => `        this.${db.camelCaseName} = ${db.camelCaseName}(config.auth);`).join("\n")}
    }
}
`;

	const completeCode = `${imports}\n${notionORMClass}`;

	// Write TypeScript file
	const indexPath = path.resolve(__dirname, "index.ts");
	fs.writeFileSync(indexPath, completeCode);

	// Compile and write JavaScript file
	compileAndWriteIndexJS(completeCode);
}

// Dedicated function for compiling the main index file
function compileAndWriteIndexJS(typescriptCode: string): void {
	try {
		// Compile TypeScript to JavaScript
		const compiledJS = ts.transpile(typescriptCode, {
			module: ts.ModuleKind.ES2020,
			target: ts.ScriptTarget.ES2020,
			esModuleInterop: true,
			allowSyntheticDefaultImports: true,
		});

		// Ensure build/src directory exists
		const buildSrcDir = path.resolve(__dirname, "../../build/src");
		if (!fs.existsSync(buildSrcDir)) {
			fs.mkdirSync(buildSrcDir, { recursive: true });
		}

		// Write compiled JavaScript
		const buildIndexPath = path.resolve(buildSrcDir, "index.js");
		fs.writeFileSync(buildIndexPath, compiledJS);

		console.log("✅ Compiled src/index.ts → build/src/index.js");
	} catch (error) {
		console.error("❌ Failed to compile index.ts:");
		console.error(error);
		throw error;
	}
}

// Creates an empty NotionORM class in src/index.ts when no databases are available
function createEmptySourceIndexFile(): void {
	const emptyClass = `
/**
 * Main NotionORM class - no databases configured
 */
export default class NotionORM {
    constructor(config: { auth: string }) {
        console.warn("⚠️  No databases found. Please run 'npx notion generate' to generate database types.");
    }
}
`;

	// Write TypeScript file
	const indexPath = path.resolve(__dirname, "index.ts");
	fs.writeFileSync(indexPath, emptyClass);

	// Compile and write JavaScript file
	compileAndWriteIndexJS(emptyClass);
}
