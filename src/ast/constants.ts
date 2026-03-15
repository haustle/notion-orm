/**
 * Internal constants for AST and db-client modules.
 */

import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Package root: src/ast/ → src/ → package root
const PACKAGE_ROOT = path.resolve(__dirname, "../../");

// When running in development (cwd is the package itself), use relative import paths.
// When installed externally, use the package name so generated files resolve correctly.
const IS_DEV = process.cwd() === PACKAGE_ROOT;

/** Default output directory for generated files, relative to consuming project root */
export const DEFAULT_OUTPUT_DIR = "generated/notion-orm";

/** Resolve the absolute path to the databases output directory */
export function getDatabasesDir(outputDir?: string): string {
  return path.join(process.cwd(), outputDir ?? DEFAULT_OUTPUT_DIR);
}

/** File system paths for CLI output */
export function getFSPaths(databasesDirPath: string) {
  return {
    /** metadata.json inside the output directory */
    metadataFile: path.join(databasesDirPath, AST_FS_FILENAMES.METADATA),
    /** index.ts — the NotionORM class written to the output directory */
    notionORMFile: path.join(databasesDirPath, AST_FS_FILENAMES.INDEX_TS),
  } as const;
}

export const AST_FS_FILENAMES = {
  METADATA: "metadata.json",
  INDEX_TS: "index.ts",
} as const;

/** Import path strings used when generating TypeScript code inside a given output directory */
export function getImportPaths(databasesDirPath: string) {
  if (IS_DEV) {
    const relTo = (target: string) =>
      path.relative(databasesDirPath, path.join(PACKAGE_ROOT, target)).replace(/\\/g, "/");
    return {
      DATABASE_CLIENT: relTo("src/db-client/client"),
      QUERY_TYPES: relTo("src/db-client/types"),
      ZOD: "zod",
    } as const;
  }
  return {
    DATABASE_CLIENT: "@elumixor/notion-orm",
    QUERY_TYPES: "@elumixor/notion-orm",
    ZOD: "zod",
  } as const;
}

export const AST_RUNTIME_CONSTANTS = {
  NOTION_API_VERSION: "2025-09-03",
  PACKAGE_LOG_PREFIX: "[@elumixor/notion-orm]",
  CLI_GENERATE_COMMAND: "notion generate",
  SCHEMA_DRIFT_PREFIX: "Schema drift detected",
  SCHEMA_DRIFT_HELP_MESSAGE: "Run `notion generate` to refresh all database schemas.",
} as const;

export const AST_TYPE_NAMES = {
  DATABASE_SCHEMA_TYPE: "DatabaseSchemaType",
  COLUMN_NAME_TO_COLUMN_TYPE: "ColumnNameToColumnType",
  QUERY_SCHEMA_TYPE: "QuerySchemaType",
  PROPERTY_VALUES_SUFFIX: "PropertyValues",
} as const;
