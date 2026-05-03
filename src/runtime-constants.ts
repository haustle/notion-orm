/**
 * Runtime-only constants shared by the published package surface, CLI, and
 * generated clients. Keeping these outside `src/ast/` avoids making runtime
 * code look like it depends on codegen internals.
 */

/** Default Notion API base URL origin (no `/v1`). Align with `@notionhq/client` default `baseUrl`. */
export const NOTION_DEFAULT_BASE_URL = "https://api.notion.com" as const;

export const PACKAGE_RUNTIME_CONSTANTS = {
	NOTION_API_VERSION: "2026-03-11",

	NOTION_DEFAULT_BASE_URL,

	PACKAGE_LOG_PREFIX: "[@haustle/notion-orm]",

	CLI_GENERATE_COMMAND: "notion sync",

	SCHEMA_DRIFT_PREFIX: "Schema drift detected",

	SCHEMA_DRIFT_HELP_MESSAGE:
		"To easily fix this, please run `notion sync` to refresh all database schemas.",
} as const;
