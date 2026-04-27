import { objectKeys } from "../../../../src/typeUtils";
import { playgroundFiles } from "./playgroundFiles";

/**
 * Single generated database module shown in **Schema** mode.
 * Derived from the playground workspace (`notion/databases/*.ts`).
 */
const notionDatabaseModuleKeys = objectKeys(playgroundFiles)
	.filter(
		(k) => k.startsWith("notion/databases/") && k.endsWith(".ts"),
	)
	.sort((a, b) => a.localeCompare(b));

const firstDbModule = notionDatabaseModuleKeys[0];
if (!firstDbModule) {
	throw new Error(
		"Demo playground: expected at least one notion/databases/*.ts module.",
	);
}

export const NOTION_SCHEMA_VIEW_FILE_KEY: keyof typeof playgroundFiles =
	firstDbModule;

/**
 * Shown in the Databases panel switch. Derived from
 * `NOTION_SCHEMA_VIEW_FILE_KEY` (under `notion/databases/`).
 */
export const NOTION_SCHEMA_VIEW_FILE_BASENAME: string =
	NOTION_SCHEMA_VIEW_FILE_KEY.slice(
		NOTION_SCHEMA_VIEW_FILE_KEY.lastIndexOf("/") + 1,
	);

/**
 * Shown in the Databases panel for **example** mode. The VFS file is
 * `databaseEntryFile` (e.g. `demo-databases.ts` in the workspace). The label is a
 * short `index.ts` hint aligned with importing from `notion/` in real apps, not the
 * demo filename.
 */
export const DEMO_DATABASES_EXAMPLE_FILE_LABEL = "index.ts" as const;

/** Virtual path from the editor facet (`/notion/...`) — database modules only. */
export function isNotionDatabaseModuleVirtualPath(virtualPath: string): boolean {
	const trimmed = virtualPath.startsWith("/")
		? virtualPath.slice(1)
		: virtualPath;
	return (
		trimmed.startsWith("notion/databases/") && trimmed.endsWith(".ts")
	);
}
