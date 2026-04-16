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

/** Virtual path from the editor facet (`/notion/...`) — database modules only. */
export function isNotionDatabaseModuleVirtualPath(virtualPath: string): boolean {
	const trimmed = virtualPath.startsWith("/")
		? virtualPath.slice(1)
		: virtualPath;
	return (
		trimmed.startsWith("notion/databases/") && trimmed.endsWith(".ts")
	);
}
