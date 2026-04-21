/**
 * Internal constants shared by the AST emitters and generated client layer.
 * Centralizing these paths and string literals makes refactors safer because
 * emitters do not need to duplicate structure-sensitive values.
 */
import path from "path";
import { toPascalCase } from "../../helpers";
import {
	codegenArtifactFileName,
	type CodegenEnvironment,
} from "./codegen-environment";

/**
 * Top-level directory name for CLI-generated artifacts in consuming projects
 * (`notion/` entry + `databases/`, `agents/`). Prefer **`import { NotionORM } from "./notion/"`**
 * in apps (directory import resolves to `index` — no need to spell `index`). Distinct from this package's
 * npm `outDir` (`build/`), which is hidden behind stable package exports such as
 * `@haustle/notion-orm/base`.
 */
const PROJECT_CODEGEN_DIR_NAME = "notion" as const;

/** Subdirectory under the codegen root for generated database modules. */
const PROJECT_DATABASES_DIR_NAME = "databases" as const;

/**
 * Resolve generated artifact paths from the current project root, not from the
 * installed package location. This keeps `bun notion sync` writing into the
 * consuming app when the package is linked locally.
 */
function getProjectBuildDir(): string {
	return path.resolve(process.cwd(), PROJECT_CODEGEN_DIR_NAME);
}

/** Canonical output directory for generated database modules (`notion/databases/*`). */
function getDatabasesDir(): string {
	return path.join(getProjectBuildDir(), PROJECT_DATABASES_DIR_NAME);
}

/** Canonical output directory for generated agent modules (`notion/agents/*`). */
function getAgentsDir(): string {
	return path.join(getProjectBuildDir(), "agents");
}

export const AGENTS_DIR = getAgentsDir();

/** Filesystem targets used by emitters. Getters stay lazy for testability. */
export const AST_FS_PATHS = {
	/** Codegen root (`notion/`): index entrypoint lives here alongside `databases/` and `agents/`. */
	get CODEGEN_ROOT_DIR(): string {
		return getProjectBuildDir();
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

	get buildIndexDts(): string {
		return path.resolve(AST_FS_PATHS.CODEGEN_ROOT_DIR, AST_FS_FILENAMES.INDEX_DTS);
	},

	get buildIndexDtsMap(): string {
		return path.resolve(
			AST_FS_PATHS.CODEGEN_ROOT_DIR,
			AST_FS_FILENAMES.INDEX_DTS_MAP,
		);
	},
} as const;

/**
 * Named locations where an environment-specific `index.ts` / `index.js` is emitted.
 * Scopes are the keys of `CODEGEN_INDEX_DIR_RESOLVERS` only (AGENTS.md: derive unions from maps).
 */
const CODEGEN_INDEX_DIR_RESOLVERS = {
	codegenRoot: getProjectBuildDir,
	databases: getDatabasesDir,
	agents: getAgentsDir,
} as const satisfies Record<string, () => string>;

type CodegenIndexScope = keyof typeof CODEGEN_INDEX_DIR_RESOLVERS;

/**
 * Canonical filesystem path for a generated `index.{ts,js}` source file.
 * Centralizes the "where does the environment-specific barrel live" rule so
 * callers never branch on TS vs JS filenames directly.
 */
export function codegenIndexSourcePath(args: {
	scope: CodegenIndexScope;
	environment: CodegenEnvironment;
}): string {
	const { scope, environment } = args;
	const dir = CODEGEN_INDEX_DIR_RESOLVERS[scope]();
	return path.join(dir, codegenArtifactFileName("index", environment));
}

/** Shared filenames used across emitted artifacts. */
const AST_FS_FILENAMES = {
	METADATA: "metadata.json",
	INDEX_DTS: "index.d.ts",
	INDEX_DTS_MAP: "index.d.ts.map",
} as const;

/** Import paths used while generating TypeScript source. */
export const AST_IMPORT_PATHS = {
	DATABASE_CLIENT: "@haustle/notion-orm",
	AGENT_CLIENT: "@haustle/notion-orm",
	QUERY_TYPES: "@haustle/notion-orm",
	ORM_BASE: "@haustle/notion-orm/base",

	ZOD: "zod",

	databaseClass(name: string): string {
		return `./${PROJECT_DATABASES_DIR_NAME}/${toPascalCase(name)}.js`;
	},

	agentClass(name: string): string {
		return `./agents/${toPascalCase(name)}.js`;
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
	PAGE_SCHEMA: "PageSchema",
	CREATE_SCHEMA: "CreateSchema",
	COLUMN_NAME_TO_COLUMN_TYPE: "ColumnNameToColumnType",
	QUERY_SCHEMA: "QuerySchema",
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
	/** Virtual file path for the generated index module. */
	BUILD_INDEX: `${PROJECT_CODEGEN_DIR_NAME}/index.ts`,

	/**
	 * Recommended import path segment for consumer code (`./notion/` → `index.ts`).
	 * Keeps demo snippets aligned with the same pattern we document in README.
	 */
	BUILD_INDEX_DIR: `${PROJECT_CODEGEN_DIR_NAME}/`,

	databaseModule(name: string): string {
		return `${PROJECT_CODEGEN_DIR_NAME}/${PROJECT_DATABASES_DIR_NAME}/${toPascalCase(name)}.ts`;
	},
	agentModule(name: string): string {
		return `${PROJECT_CODEGEN_DIR_NAME}/agents/${toPascalCase(name)}.ts`;
	},

	databaseImport(name: string): string {
		return `./${PROJECT_DATABASES_DIR_NAME}/${toPascalCase(name)}.ts`;
	},
	agentImport(name: string): string {
		return `./agents/${toPascalCase(name)}.ts`;
	},

	MOCK_PACKAGE_INDEX: "playground_modules/haustle-notion-orm/index.ts",
	MOCK_PACKAGE_NOTION_ID_PATTERNS:
		"playground_modules/haustle-notion-orm/notion-id-patterns.ts",
	MOCK_PACKAGE_BASE: "playground_modules/haustle-notion-orm/base.ts",
	MOCK_PACKAGE_PREFIX: "playground_modules/",

	DEMO_AUTH_PLACEHOLDER: "my-notion-api-key",
} as const;
