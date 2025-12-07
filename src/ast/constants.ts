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
// Only compute if import.meta.url is available (not in Cloudflare Workers)
let __dirname: string | undefined;

try {
	if (typeof import.meta.url !== "undefined") {
		const __filename = fileURLToPath(import.meta.url);
		__dirname = path.dirname(__filename);
	}
} catch (e) {
	// In environments like Cloudflare Workers, import.meta.url may not work
	// This is fine - we only need file system paths at build-time, not runtime
}

/**
 * Databases output directory (build/db/)
 * Centralized here as it's structure-dependent and used across AST modules
 * Only available at build-time, not in runtime environments like Cloudflare Workers
 */
function getDatabasesDir(): string {
	if (!__dirname) {
		throw new Error(
			"DATABASES_DIR is only available at build-time, not in runtime environments like Cloudflare Workers"
		);
	}
	// From build/src/ast/, go up 3 levels to project root, then into build/db/
	return path.join(__dirname, "../../../build", "db");
}

export const DATABASES_DIR = __dirname
	? path.join(__dirname, "../../../build", "db")
	: ""; // Empty string fallback for runtime environments

/**
 * File system paths for AST/CLI output
 * These are only used at build-time, not runtime
 */
export const AST_FS_PATHS = {
	/**
	 * Build directory for index files (build/src/)
	 */
	get BUILD_SRC_DIR(): string {
		if (!__dirname) {
			throw new Error(
				"BUILD_SRC_DIR is only available at build-time, not in runtime environments like Cloudflare Workers"
			);
		}
		return path.resolve(__dirname, "..");
	},

	/**
	 * Databases output directory (build/db/)
	 */
	get DATABASES_DIR(): string {
		return getDatabasesDir();
	},

	/**
	 * Metadata file path
	 */
	get metadataFile(): string {
		return path.resolve(getDatabasesDir(), AST_FS_FILENAMES.METADATA);
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
		return path.resolve(getDatabasesDir(), AST_FS_FILENAMES.INDEX_TS);
	},

	/**
	 * Database barrel file (index.js) path
	 */
	get databaseBarrelJs(): string {
		return path.resolve(getDatabasesDir(), AST_FS_FILENAMES.INDEX_JS);
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
