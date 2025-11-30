/**
 * Internal constants for AST and db-client modules.
 *
 * This module centralizes structure-dependent strings (paths, filenames, import targets,
 * Notion API versions, log prefixes, and CLI messages) to make refactoring safer.
 *
 * ⚠️ This is an internal-only module and is NOT part of the public API.
 */

import path from "path";
import { fileURLToPath } from "url";

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Databases output directory (build/db/)
 * Centralized here as it's structure-dependent and used across AST modules
 */
export const DATABASES_DIR = path.join(__dirname, "../../build", "db");

/**
 * File system paths for AST/CLI output
 */
export const AST_FS_PATHS = {
  /**
   * Build directory for index files (build/src/)
   */
  BUILD_SRC_DIR: path.resolve(__dirname, ".."),

  /**
   * Databases output directory (build/db/)
   */
  DATABASES_DIR,

  /**
   * Metadata file path
   */
  get metadataFile(): string {
    return path.resolve(DATABASES_DIR, AST_FS_FILENAMES.METADATA);
  },

  /**
   * Build index.js file path
   */
  get buildIndexJs(): string {
    return path.resolve(AST_FS_PATHS.BUILD_SRC_DIR, AST_FS_FILENAMES.INDEX_JS);
  },

  /**
   * Build index.d.ts file path
   */
  get buildIndexDts(): string {
    return path.resolve(AST_FS_PATHS.BUILD_SRC_DIR, AST_FS_FILENAMES.INDEX_DTS);
  },

  /**
   * Build index.d.ts.map file path
   */
  get buildIndexDtsMap(): string {
    return path.resolve(
      AST_FS_PATHS.BUILD_SRC_DIR,
      AST_FS_FILENAMES.INDEX_DTS_MAP
    );
  },

  /**
   * Database barrel file (index.ts) path
   */
  get databaseBarrelTs(): string {
    return path.resolve(DATABASES_DIR, AST_FS_FILENAMES.INDEX_TS);
  },

  /**
   * Database barrel file (index.js) path
   */
  get databaseBarrelJs(): string {
    return path.resolve(DATABASES_DIR, AST_FS_FILENAMES.INDEX_JS);
  },
} as const;

/**
 * Filename constants
 */
export const AST_FS_FILENAMES = {
  METADATA: "metadata.json",
  INDEX_TS: "index.ts",
  INDEX_JS: "index.js",
  INDEX_DTS: "index.d.ts",
  INDEX_DTS_MAP: "index.d.ts.map",
} as const;

/**
 * Import path strings used when generating TypeScript code
 */
export const AST_IMPORT_PATHS = {
  /**
   * Import path for DatabaseClient
   */
  DATABASE_CLIENT: "../src/db-client/DatabaseClient",

  /**
   * Import path for queryTypes
   */
  QUERY_TYPES: "../src/db-client/queryTypes",

  /**
   * Import path for zod package
   */
  ZOD: "zod",

  /**
   * Generate import path for a database class
   * @param className - The database class name (e.g., "BookTracker")
   */
  databaseClass(className: string): string {
    return `../db/${className}`;
  },
} as const;

/**
 * Runtime constants shared across modules
 */
export const AST_RUNTIME_CONSTANTS = {
  /**
   * Notion API version
   */
  NOTION_API_VERSION: "2025-09-03",

  /**
   * Package log prefix
   */
  PACKAGE_LOG_PREFIX: "[@haustle/notion-orm]",

  /**
   * CLI command to generate database types
   */
  CLI_GENERATE_COMMAND: "notion generate",

  /**
   * Schema drift error message prefix
   */
  SCHEMA_DRIFT_PREFIX: "Schema drift detected",

  /**
   * Help message for fixing schema drift
   */
  SCHEMA_DRIFT_HELP_MESSAGE:
    "To easily fix this, please run `notion generate` to refresh all database schemas.",
} as const;

/**
 * Type name constants used in generated code
 */
export const AST_TYPE_NAMES = {
  DATABASE_SCHEMA_TYPE: "DatabaseSchemaType",
  COLUMN_NAME_TO_COLUMN_TYPE: "ColumnNameToColumnType",
  QUERY_SCHEMA_TYPE: "QuerySchemaType",
  PROPERTY_VALUES_SUFFIX: "PropertyValues",
} as const;
