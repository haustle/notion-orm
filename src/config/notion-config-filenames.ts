/**
 * Single source of truth for user project `notion.config.*` filenames (CLI
 * discovery, init, and tests). Keep this dumb: one basename plus the few
 * concrete filenames we support.
 */

/** Basename (no extension) for the Notion ORM config module in consuming apps. */
export const NOTION_CONFIG_BASENAME = "notion.config" as const;

export const NOTION_CONFIG_FILENAMES = {
	js: `${NOTION_CONFIG_BASENAME}.js`,
	ts: `${NOTION_CONFIG_BASENAME}.ts`,
	mjs: `${NOTION_CONFIG_BASENAME}.mjs`,
} as const;

/**
 * Supported filenames probed by {@link findConfigFile} in discovery order.
 * `.js` stays ahead of `.ts` for legacy compatibility when both exist.
 */
export const NOTION_CONFIG_CANDIDATE_FILENAMES = [
	NOTION_CONFIG_FILENAMES.js,
	NOTION_CONFIG_FILENAMES.ts,
	NOTION_CONFIG_FILENAMES.mjs,
] as const;

/** Human-readable fragment for diagnostics (e.g. `js/ts/mjs`), derived from candidates. */
export const NOTION_CONFIG_EXTENSION_LABELS = NOTION_CONFIG_CANDIDATE_FILENAMES.map(
	(filename) => filename.slice(NOTION_CONFIG_BASENAME.length + 1),
).join("/");
