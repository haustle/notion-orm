/**
 * Runtime-only constants shared by the published package surface, CLI, and
 * generated clients. Keeping these outside `src/ast/` avoids making runtime
 * code look like it depends on codegen internals.
 */
export const PACKAGE_RUNTIME_CONSTANTS = {
	NOTION_API_VERSION: "2026-03-11",

	PACKAGE_LOG_PREFIX: "[@haustle/notion-orm]",

	CLI_GENERATE_COMMAND: "notion sync",

	SCHEMA_DRIFT_PREFIX: "Schema drift detected",

	SCHEMA_DRIFT_HELP_MESSAGE:
		"To easily fix this, please run `notion sync` to refresh all database schemas.",
} as const;
