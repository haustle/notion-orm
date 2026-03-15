/**
 * CLI orchestration for database type generation.
 */

import { Client } from "@notionhq/client";
import fs from "fs";
import path from "path";
import * as ts from "typescript";
import { getNotionConfig } from "../config/loadConfig";
import { DATABASES_DIR, AST_FS_PATHS, AST_FS_FILENAMES, AST_IMPORT_PATHS, AST_RUNTIME_CONSTANTS } from "./constants";
import { createTypescriptFileForDatabase } from "./database-file-writer";

interface CachedDatabaseMetadata {
  id: string;
  className: string;
  displayName: string;
  camelCaseName: string;
}

function readDatabaseMetadata(): CachedDatabaseMetadata[] {
  try {
    if (!fs.existsSync(AST_FS_PATHS.metadataFile)) return [];
    return JSON.parse(fs.readFileSync(AST_FS_PATHS.metadataFile, "utf-8")) as CachedDatabaseMetadata[];
  } catch {
    return [];
  }
}

function writeDatabaseMetadata(metadata: CachedDatabaseMetadata[]): void {
  if (!fs.existsSync(DATABASES_DIR)) fs.mkdirSync(DATABASES_DIR, { recursive: true });
  fs.writeFileSync(AST_FS_PATHS.metadataFile, JSON.stringify(metadata, null, 2));
}

type CreateDatabaseTypesOptions =
  | { type: "all" }
  | { type: "incremental"; id: string };

export const createDatabaseTypes = async (
  options: CreateDatabaseTypesOptions,
): Promise<{ databaseNames: string[] }> => {
  const config = await getNotionConfig();

  if (!config.auth) {
    console.error("⚠️ Integration key not found. Add NOTION_API_KEY to your .env or notion.config.ts");
    process.exit(1);
  }

  const client = new Client({ auth: config.auth, notionVersion: AST_RUNTIME_CONSTANTS.NOTION_API_VERSION });

  const isFullGenerate = options.type === "all";
  const targetIds = isFullGenerate ? config.databaseIds : [options.id];

  if (targetIds.length === 0) {
    console.error("No database IDs configured. Add some to notion.config.ts");
    process.exit(1);
  }

  let metadataMap: Map<string, CachedDatabaseMetadata>;

  if (isFullGenerate) {
    if (fs.existsSync(DATABASES_DIR)) fs.rmSync(DATABASES_DIR, { recursive: true, force: true });
    console.log("🔄 Updating all database schemas...");
    metadataMap = new Map();
  } else {
    metadataMap = prepareIncrementalMetadata(config.databaseIds);
  }

  const databaseNames: string[] = [];

  for (const databaseId of targetIds) {
    try {
      const dbMeta = await generateDatabaseTypes(client, databaseId);
      metadataMap.set(dbMeta.id, dbMeta);
      databaseNames.push(dbMeta.displayName);
    } catch (error) {
      console.error(`❌ Error generating types for: ${databaseId}`);
      console.error(error);
      return { databaseNames: [] };
    }
  }

  const databasesMetadata = Array.from(metadataMap.values());
  writeDatabaseMetadata(databasesMetadata);
  createGeneratedBarrelFile(databasesMetadata);
  updateSourceIndexFile(databasesMetadata);

  return { databaseNames };
};

function createGeneratedBarrelFile(databasesMetadata: CachedDatabaseMetadata[]): void {
  const importStatements = databasesMetadata.map(({ className }) =>
    ts.factory.createImportDeclaration(
      undefined,
      ts.factory.createImportClause(
        false,
        undefined,
        ts.factory.createNamedImports([
          ts.factory.createImportSpecifier(false, undefined, ts.factory.createIdentifier(className)),
        ]),
      ),
      ts.factory.createStringLiteral(`./${className}.ts`),
      undefined,
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
          ts.factory.createObjectLiteralExpression(
            databasesMetadata.map(({ className }) =>
              ts.factory.createShorthandPropertyAssignment(ts.factory.createIdentifier(className), undefined),
            ),
            true,
          ),
        ),
      ],
      ts.NodeFlags.Const,
    ),
  );

  const allNodes = ts.factory.createNodeArray([...importStatements, registryExport]);
  const sourceFile = ts.createSourceFile("placeholder.ts", "", ts.ScriptTarget.ESNext, true, ts.ScriptKind.TS);
  const printer = ts.createPrinter();
  const code = printer.printList(ts.ListFormat.MultiLine, allNodes, sourceFile);

  if (!fs.existsSync(DATABASES_DIR)) fs.mkdirSync(DATABASES_DIR, { recursive: true });
  fs.writeFileSync(AST_FS_PATHS.generatedBarrelTs, code);
}

function updateSourceIndexFile(databasesMetadata: CachedDatabaseMetadata[]): void {
  if (databasesMetadata.length === 0) {
    fs.writeFileSync(
      AST_FS_PATHS.sourceIndexTs,
      `export default class NotionORM {\n  constructor(_config: { auth: string }) {}\n}\n`,
    );
    return;
  }

  const imports = databasesMetadata
    .map(({ camelCaseName, className }) => `import { ${camelCaseName} } from "${AST_IMPORT_PATHS.databaseClass(className)}";`)
    .join("\n");

  const properties = databasesMetadata
    .map(({ camelCaseName }) => `  public ${camelCaseName}: ReturnType<typeof ${camelCaseName}>;`)
    .join("\n");

  const assignments = databasesMetadata
    .map(({ camelCaseName }) => `    this.${camelCaseName} = ${camelCaseName}(config.auth);`)
    .join("\n");

  const code = `${imports}\n\nexport default class NotionORM {\n${properties}\n\n  constructor(config: { auth: string }) {\n${assignments}\n  }\n}\n`;
  fs.writeFileSync(AST_FS_PATHS.sourceIndexTs, code);
}

async function generateDatabaseTypes(client: Client, databaseId: string): Promise<CachedDatabaseMetadata> {
  // Resolve the data_source_id from the database_id.
  // In the new Notion API, databases and data sources are different objects.
  const database = await client.databases.retrieve({ database_id: databaseId });
  const dataSources = (database as { data_sources?: { id: string; name: string }[] }).data_sources;
  if (!dataSources || dataSources.length === 0) throw new Error(`No data sources found for database ${databaseId}`);
  const dataSourceId = dataSources[0].id;

  const databaseObject = await client.dataSources.retrieve({ data_source_id: dataSourceId });
  const { databaseClassName, databaseName, databaseId: id } = await createTypescriptFileForDatabase(databaseObject);
  return {
    id,
    className: databaseClassName,
    displayName: databaseName,
    camelCaseName: databaseClassName.charAt(0).toLowerCase() + databaseClassName.slice(1),
  };
}

function prepareIncrementalMetadata(configDatabaseIds: string[]): Map<string, CachedDatabaseMetadata> {
  const cached = readDatabaseMetadata();
  const configIdsSet = new Set(configDatabaseIds);
  const map = new Map<string, CachedDatabaseMetadata>();
  for (const db of cached) {
    if (configIdsSet.has(db.id)) map.set(db.id, db);
  }
  return map;
}
