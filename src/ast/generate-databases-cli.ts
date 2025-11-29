/**
 * CLI orchestration for database type generation.
 * Handles metadata management, file generation coordination, and CLI entry point.
 */

import { Client } from "@notionhq/client";
import fs from "fs";
import path from "path";
import * as ts from "typescript";
import { fileURLToPath } from "url";
import { getNotionConfig } from "../config/loadConfig";
import { DATABASES_DIR } from "../helpers";
import { createTypescriptFileForDatabase } from "./database-file-writer";

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Build directory for index files (build/src/)
const BUILD_SRC_DIR = path.resolve(__dirname, "..");

function getMetadataFilePath(): string {
  return path.resolve(DATABASES_DIR, "metadata.json");
}

// Read existing database metadata from disk
function readDatabaseMetadata(): CachedDatabaseMetadata[] {
  try {
    const metadataFile = getMetadataFilePath();
    if (!fs.existsSync(metadataFile)) {
      return [];
    }
    const content = fs.readFileSync(metadataFile, "utf-8");
    return JSON.parse(content) as CachedDatabaseMetadata[];
  } catch (error) {
    // If metadata file is corrupted or invalid, return empty array
    return [];
  }
}

// Write database metadata to disk
function writeDatabaseMetadata(metadata: CachedDatabaseMetadata[]): void {
  // Ensure DATABASES_DIR exists
  if (!fs.existsSync(DATABASES_DIR)) {
    fs.mkdirSync(DATABASES_DIR, { recursive: true });
  }
  const metadataFile = getMetadataFilePath();
  fs.writeFileSync(metadataFile, JSON.stringify(metadata, null, 2));
}

interface CachedDatabaseMetadata {
  id: string; // UUID of the database
  className: string; // "BookTracker"
  displayName: string; // "Book Tracker"
  camelCaseName: string; // "bookTracker"
}

type CreateDatabaseTypesOptions =
  | { type: "all" } // Refresh all databases
  | { type: "incremental"; id: string }; // Refresh a single database

export const createDatabaseTypes = async (
  options: CreateDatabaseTypesOptions
): Promise<{ databaseNames: string[] }> => {
  const config = await getNotionConfig();

  if (!config.auth) {
    console.error(
      "⚠️ Integration key not found. Inside 'notion.config.js/ts' file, please pass a valid Notion Integration Key"
    );
    process.exit(1);
  }

  const client = new Client({
    auth: config.auth,
    notionVersion: "2025-09-03",
  });

  // Determine target database IDs and generation mode
  const isFullGenerate = options.type === "all";
  const targetIds = isFullGenerate ? config.databaseIds : [options.id];

  if (targetIds.length === 0) {
    console.error("Please pass some database Ids");
    process.exit(1);
  }

  // Prepare for full or incremental generation
  let metadataMap: Map<string, CachedDatabaseMetadata>;

  if (isFullGenerate) {
    // Full: delete existing files and start fresh
    if (fs.existsSync(DATABASES_DIR)) {
      fs.rmSync(DATABASES_DIR, { recursive: true, force: true });
    }
    console.log("🔄 Updating all database schemas...");
    metadataMap = new Map();
  } else {
    // Incremental: load existing metadata (filtered by config)
    metadataMap = prepareIncrementalMetadata(config.databaseIds);
  }

  // Generate types for target databases
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
            ts.factory.createIdentifier(className)
          ),
        ])
      ),
      ts.factory.createStringLiteral(`./${className}`),
      undefined
    )
  );

  // Create the database registry object
  const registryProperties = databaseInfo.map(({ className, displayName }) =>
    ts.factory.createPropertyAssignment(
      ts.factory.createIdentifier(className),
      ts.factory.createIdentifier(className)
    )
  );

  const registryExport = ts.factory.createVariableStatement(
    [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)],
    ts.factory.createVariableDeclarationList(
      [
        ts.factory.createVariableDeclaration(
          ts.factory.createIdentifier("databases"),
          undefined,
          undefined,
          ts.factory.createObjectLiteralExpression(registryProperties, true)
        ),
      ],
      ts.NodeFlags.Const
    )
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
    ts.ScriptKind.TS
  );
  const printer = ts.createPrinter();

  const typescriptCodeToString = printer.printList(
    ts.ListFormat.MultiLine,
    allNodes,
    sourceFile
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
    typescriptCodeToString
  );
  fs.writeFileSync(
    path.resolve(DATABASES_DIR, "index.js"),
    transpileToJavaScript
  );
}

// Writes directly to build/src/index.js with database imports
// Note: src/index.ts is kept as simple boilerplate and not modified
function updateSourceIndexFile(
  databasesMetadata: CachedDatabaseMetadata[]
): void {
  if (databasesMetadata.length === 0) {
    createEmptySourceIndexFile();
    return;
  }

  const imports = databasesMetadata
    .map((db) => `import { ${db.camelCaseName} } from "../db/${db.className}";`)
    .join("\n");

  const notionORMClass = `
/**
 * Main NotionORM class that provides access to all generated database types
 */
export default class NotionORM {
${databasesMetadata
  .map(
    (db) =>
      `    public ${db.camelCaseName}: ReturnType<typeof ${db.camelCaseName}>;`
  )
  .join("\n")}

    constructor(config: { auth: string }) {
${databasesMetadata
  .map(
    (db) =>
      `        this.${db.camelCaseName} = ${db.camelCaseName}(config.auth);`
  )
  .join("\n")}
    }
}
`;

  const completeCode = `${imports}\n${notionORMClass}`;

  writeIndexFiles(completeCode, databasesMetadata);
}

// Writes both index.js and index.d.ts files
function writeIndexFiles(
  typescriptCode: string,
  databasesMetadata: CachedDatabaseMetadata[]
): void {
  // Ensure build directory exists
  if (!fs.existsSync(BUILD_SRC_DIR)) {
    fs.mkdirSync(BUILD_SRC_DIR, { recursive: true });
  }

  // Compile TypeScript to JavaScript
  const compiledJS = ts.transpile(typescriptCode, {
    module: ts.ModuleKind.ES2020,
    target: ts.ScriptTarget.ES2020,
    esModuleInterop: true,
    allowSyntheticDefaultImports: true,
  });

  // Write JavaScript file
  fs.writeFileSync(path.resolve(BUILD_SRC_DIR, "index.js"), compiledJS);

  // Generate and write declaration file
  const declarationCode = generateDeclarationFile(databasesMetadata);
  fs.writeFileSync(path.resolve(BUILD_SRC_DIR, "index.d.ts"), declarationCode);

  // Remove the declaration map that points back to src/index.ts
  // This ensures "Go to Definition" stays in the generated build/src/index.d.ts
  const declarationMapPath = path.resolve(BUILD_SRC_DIR, "index.d.ts.map");
  if (fs.existsSync(declarationMapPath)) {
    fs.unlinkSync(declarationMapPath);
  }
}

// Generates the TypeScript declaration file content
function generateDeclarationFile(
  databasesMetadata: CachedDatabaseMetadata[]
): string {
  if (databasesMetadata.length === 0) {
    return `export default class NotionORM {
    constructor(config: { auth: string });
}`;
  }

  // Generate class properties with inline ReturnType references
  // This ensures "Go to Definition" navigates directly to the database files
  const classProperties = databasesMetadata
    .map(
      (db) =>
        `    public ${db.camelCaseName}: ReturnType<typeof import("../db/${db.className}").${db.camelCaseName}>;`
    )
    .join("\n");

  return `
export default class NotionORM {
${classProperties}
    constructor(config: { auth: string });
}`;
}

// Creates an empty NotionORM class in build/src/index.js when no databases are available
// Note: src/index.ts is kept as simple boilerplate and not modified
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

  const completeCode = `${emptyClass}`;
  writeIndexFiles(completeCode, []);
}

/**
 * Creates metadata object from database generation result
 */
function createMetadata(
  id: string,
  className: string,
  displayName: string
): CachedDatabaseMetadata {
  return {
    id,
    className,
    displayName,
    camelCaseName: className.charAt(0).toLowerCase() + className.slice(1),
  };
}

/**
 * Fetches database schema and generates TypeScript files for a single database
 */
async function generateDatabaseTypes(
  client: Client,
  databaseId: string
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

/**
 * Prepares metadata map for incremental generation
 */
function prepareIncrementalMetadata(
  configDatabaseIds: string[]
): Map<string, CachedDatabaseMetadata> {
  const cachedDatabaseMetadata = readDatabaseMetadata();
  const metadataMap = new Map<string, CachedDatabaseMetadata>();

  // Only include existing metadata for databases still in config
  const configIdsSet = new Set(configDatabaseIds);
  for (const dbMetadata of cachedDatabaseMetadata) {
    if (configIdsSet.has(dbMetadata.id)) {
      metadataMap.set(dbMetadata.id, dbMetadata);
    }
  }

  return metadataMap;
}
