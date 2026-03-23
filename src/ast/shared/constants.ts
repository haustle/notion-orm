/**
 * Internal constants shared by the AST emitters and generated client layer.
 * Centralizing these paths and string literals makes refactors safer because
 * emitters do not need to duplicate structure-sensitive values.
 */
import path from "path";

/**
 * Resolve generated artifact paths from the current project root, not from the
 * installed package location. This keeps `bun notion sync` writing into the
 * consuming app when the package is linked locally.
 */
function getProjectBuildDir(): string {
	return path.resolve(process.cwd(), "build");
}

/** Canonical output directory for generated database modules (`build/db/*`). */
function getDatabasesDir(): string {
	return path.join(getProjectBuildDir(), "db");
}

/** Canonical output directory for generated agent modules (`build/agents/*`). */
function getAgentsDir(): string {
	return path.join(getProjectBuildDir(), "agents");
}

export const DATABASES_DIR = getDatabasesDir();
export const AGENTS_DIR = getAgentsDir();

/** Filesystem targets used by emitters. Getters stay lazy for testability. */
export const AST_FS_PATHS = {
	get BUILD_SRC_DIR(): string {
		return path.join(getProjectBuildDir(), "src");
	},

	get DATABASES_DIR(): string {
		return getDatabasesDir();
	},

	get metadataFile(): string {
		return path.resolve(getDatabasesDir(), AST_FS_FILENAMES.METADATA);
	},

	get agentMetadataFile(): string {
		return path.resolve(getAgentsDir(), AST_FS_FILENAMES.METADATA);
	},

	get buildIndexTs(): string {
		return path.resolve(AST_FS_PATHS.BUILD_SRC_DIR, AST_FS_FILENAMES.INDEX_TS);
	},

	get buildIndexJs(): string {
		return path.resolve(AST_FS_PATHS.BUILD_SRC_DIR, AST_FS_FILENAMES.INDEX_JS);
	},

	get buildIndexDts(): string {
		return path.resolve(AST_FS_PATHS.BUILD_SRC_DIR, AST_FS_FILENAMES.INDEX_DTS);
	},

	get buildIndexDtsMap(): string {
		return path.resolve(
			AST_FS_PATHS.BUILD_SRC_DIR,
			AST_FS_FILENAMES.INDEX_DTS_MAP,
		);
	},

	get databaseBarrelTs(): string {
		return path.resolve(getDatabasesDir(), AST_FS_FILENAMES.INDEX_TS);
	},

	get databaseBarrelJs(): string {
		return path.resolve(getDatabasesDir(), AST_FS_FILENAMES.INDEX_JS);
	},
} as const;

/** Shared filenames used across emitted artifacts. */
export const AST_FS_FILENAMES = {
	METADATA: "metadata.json",
	INDEX_TS: "index.ts",
	INDEX_JS: "index.js",
	INDEX_DTS: "index.d.ts",
	INDEX_DTS_MAP: "index.d.ts.map",
} as const;

/** Import paths used while generating TypeScript source. */
export const AST_IMPORT_PATHS = {
	DATABASE_CLIENT: "@haustle/notion-orm",
	AGENT_CLIENT: "@haustle/notion-orm",
	QUERY_TYPES: "@haustle/notion-orm",
	ORM_BASE: "@haustle/notion-orm/build/src/base",

	ZOD: "zod",

	databaseClass(name: string): string {
		return `../db/${name}`;
	},

	agentClass(name: string): string {
		return `../agents/${name}`;
	},
} as const;

/** Runtime constants shared by emitted clients and CLI flows. */
export const AST_RUNTIME_CONSTANTS = {
	NOTION_API_VERSION: "2026-03-11",

	PACKAGE_LOG_PREFIX: "[@haustle/notion-orm]",

	CLI_GENERATE_COMMAND: "notion sync",

	SCHEMA_DRIFT_PREFIX: "Schema drift detected",

	SCHEMA_DRIFT_HELP_MESSAGE:
		"To easily fix this, please run `notion sync` to refresh all database schemas.",
} as const;

/** Canonical generated type names referenced across emitters. */
export const AST_TYPE_NAMES = {
	DATABASE_SCHEMA_TYPE: "DatabaseSchemaType",
	COLUMN_NAME_TO_COLUMN_TYPE: "ColumnNameToColumnType",
	QUERY_SCHEMA_TYPE: "QuerySchemaType",
	PROPERTY_VALUES_SUFFIX: "PropertyValues",
} as const;

/**
 * Relative virtual-filesystem paths used by the demo playground builder.
 * Matches the directory layout of a real consuming project so the
 * browser-based TypeScript environment resolves imports correctly.
 *
 * Kept here alongside the production path constants so both stay in sync
 * when the build layout changes.
 */
export const PLAYGROUND_PATHS = {
	BUILD_INDEX: "build/src/index.ts",

	databaseModule(name: string): string {
		return `build/db/${name}.ts`;
	},
	agentModule(name: string): string {
		return `build/agents/${name}.ts`;
	},

	databaseImport(name: string): string {
		return `../db/${name}.ts`;
	},
	agentImport(name: string): string {
		return `../agents/${name}.ts`;
	},

	MOCK_PACKAGE_INDEX: "playground_modules/haustle-notion-orm/index.ts",
	MOCK_PACKAGE_BASE: "playground_modules/haustle-notion-orm/build/src/base.ts",
	MOCK_PACKAGE_PREFIX: "playground_modules/",

	DEMO_AUTH_PLACEHOLDER: "my-notion-api-key",
} as const;
