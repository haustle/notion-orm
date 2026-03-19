/**
 * CLI orchestration for database type generation.
 */

import { Client, LogLevel, APIResponseError, APIErrorCode } from "@notionhq/client";
import fs from "fs";
import path from "path";
import * as ts from "typescript";
import { getNotionConfig } from "../config/loadConfig";
import { getDatabasesDir, getFSPaths, AST_FS_FILENAMES, AST_RUNTIME_CONSTANTS } from "./constants";
import { createTypescriptFileForDatabase } from "./database-file-writer";

interface CachedDatabaseMetadata {
  id: string;
  className: string;
  displayName: string;
  camelCaseName: string;
}

export type GenerateProgress = {
  onDbStart?(name: string): void;
  onDbSuccess?(name: string): void;
  onDbError?(name: string, error: unknown): void;
};

function readDatabaseMetadata(databasesDirPath: string): CachedDatabaseMetadata[] {
  try {
    const metadataFile = path.join(databasesDirPath, AST_FS_FILENAMES.METADATA);
    if (!fs.existsSync(metadataFile)) return [];
    return JSON.parse(fs.readFileSync(metadataFile, "utf-8")) as CachedDatabaseMetadata[];
  } catch {
    return [];
  }
}

function writeDatabaseMetadata(databasesDirPath: string, metadata: CachedDatabaseMetadata[]): void {
  if (!fs.existsSync(databasesDirPath)) fs.mkdirSync(databasesDirPath, { recursive: true });
  fs.writeFileSync(path.join(databasesDirPath, AST_FS_FILENAMES.METADATA), JSON.stringify(metadata, null, 2));
}

type CreateDatabaseTypesOptions =
  | { type: "all" }
  | { type: "incremental"; name: string; id: string };

export const createDatabaseTypes = async (
  options: CreateDatabaseTypesOptions,
  progress: GenerateProgress = {},
): Promise<{ databaseNames: string[] }> => {
  const config = await getNotionConfig();

  if (!config.auth) throw new Error("Integration key not found. Add NOTION_API_KEY to your env or notion.config.ts");

  const databasesDirPath = getDatabasesDir(config.outputDir);
  const client = new Client({ auth: config.auth, notionVersion: AST_RUNTIME_CONSTANTS.NOTION_API_VERSION });

  const isFullGenerate = options.type === "all";
  const targets: [name: string, id: string][] = isFullGenerate
    ? Object.entries(config.databases)
    : [[options.name, options.id]];

  if (targets.length === 0) throw new Error("No databases configured. Add some to notion.config.ts");

  let metadataMap: Map<string, CachedDatabaseMetadata>;
  if (isFullGenerate) {
    if (fs.existsSync(databasesDirPath)) fs.rmSync(databasesDirPath, { recursive: true, force: true });
    metadataMap = new Map();
  } else {
    metadataMap = prepareIncrementalMetadata(databasesDirPath, config.databases);
  }

  const databaseNames: string[] = [];

  for (const [name, databaseId] of targets) {
    progress.onDbStart?.(name);
    try {
      const dbMeta = await generateDatabaseTypes(client, config.auth, name, databaseId, databasesDirPath);
      metadataMap.set(dbMeta.id, dbMeta);
      databaseNames.push(dbMeta.className);
      progress.onDbSuccess?.(name);
    } catch (error) {
      progress.onDbError?.(name, error);
      return { databaseNames: [] };
    }
  }

  const databasesMetadata = Array.from(metadataMap.values());
  writeDatabaseMetadata(databasesDirPath, databasesMetadata);
  writeNotionORMFile(databasesDirPath, databasesMetadata);

  return { databaseNames };
};

function writeWithJs(tsPath: string, tsCode: string): void {
  fs.writeFileSync(tsPath, tsCode);
  fs.writeFileSync(
    tsPath.replace(".ts", ".js"),
    ts.transpile(tsCode, { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ESNext }),
  );
}

function writeNotionORMFile(databasesDirPath: string, databasesMetadata: CachedDatabaseMetadata[]): void {
  const { notionORMFile } = getFSPaths(databasesDirPath);

  if (!fs.existsSync(databasesDirPath)) fs.mkdirSync(databasesDirPath, { recursive: true });

  if (databasesMetadata.length === 0) {
    writeWithJs(notionORMFile, `export class NotionORM {\n  constructor(_auth: string) {}\n}\n`);
    return;
  }

  const imports = databasesMetadata
    .map(({ camelCaseName, className }) => `import { ${camelCaseName} } from "./${className}.ts";`)
    .join("\n");

  const properties = databasesMetadata
    .map(({ camelCaseName }) => `  public ${camelCaseName}: ReturnType<typeof ${camelCaseName}>;`)
    .join("\n");

  const assignments = databasesMetadata
    .map(({ camelCaseName }) => `    this.${camelCaseName} = ${camelCaseName}(auth);`)
    .join("\n");

  const tsCode = `${imports}\n\nexport class NotionORM {\n${properties}\n\n  constructor(auth: string) {\n${assignments}\n  }\n}\n`;
  writeWithJs(notionORMFile, tsCode);
}

async function resolveDataSourceId(auth: string, id: string): Promise<string> {
  const probeClient = new Client({ auth, notionVersion: AST_RUNTIME_CONSTANTS.NOTION_API_VERSION, logLevel: LogLevel.ERROR });
  try {
    const database = await probeClient.databases.retrieve({ database_id: id });
    const dataSources = (database as { data_sources?: { id: string }[] }).data_sources;
    if (dataSources && dataSources.length > 0) return dataSources[0].id;
  } catch (error) {
    if (!(APIResponseError.isAPIResponseError(error) && error.code === APIErrorCode.ObjectNotFound)) throw error;
    // not a database_id — try treating it as a data_source_id
  }
  await probeClient.dataSources.retrieve({ data_source_id: id });
  return id;
}

async function generateDatabaseTypes(
  client: Client,
  auth: string,
  name: string,
  databaseId: string,
  databasesDirPath: string,
): Promise<CachedDatabaseMetadata> {
  const dataSourceId = await resolveDataSourceId(auth, databaseId);
  const databaseObject = await client.dataSources.retrieve({ data_source_id: dataSourceId });
  const { databaseClassName, databaseId: id } = await createTypescriptFileForDatabase(databaseObject, name, databasesDirPath);
  return { id, className: databaseClassName, displayName: databaseClassName, camelCaseName: databaseClassName };
}

function prepareIncrementalMetadata(databasesDirPath: string, databases: Record<string, string>): Map<string, CachedDatabaseMetadata> {
  const cached = readDatabaseMetadata(databasesDirPath);
  const configNames = new Set(Object.keys(databases));
  const map = new Map<string, CachedDatabaseMetadata>();
  for (const db of cached) {
    if (configNames.has(db.className)) map.set(db.id, db);
  }
  return map;
}
