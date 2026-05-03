/**
 * Optional REST API origin for `@notionhq/client` (`DatabaseClient`, CLI codegen, `notion add`).
 *
 * Set the `NOTION_BASE_URL` environment variable to override ({@link NOTION_BASE_URL_KEY}). When unset or blank, the default Notion API origin is used.
 *
 * **`@notionhq/agents-client`** is wired with **`auth`** only in this package; it does not read this var here.
 */

import { loadDotEnvFromCwd } from "./loadDotEnvFromCwd";
import { NOTION_DEFAULT_BASE_URL } from "../runtime-constants";

export { NOTION_DEFAULT_BASE_URL };

export const NOTION_BASE_URL_KEY = "NOTION_BASE_URL" as const;

function normalizeRestOrigin(raw: string | undefined): string | undefined {
	if (raw === undefined) {
		return undefined;
	}
	const trimmed = raw.trim();
	if (trimmed.length === 0) {
		return undefined;
	}
	return trimmed.replace(/\/+$/, "");
}

/**
 * REST origin for `@notionhq/client` (no `/v1` suffix). Uses `NOTION_BASE_URL` when set; otherwise the default Notion API origin.
 */
export function resolveNotionApiBaseUrl(): string {
	loadDotEnvFromCwd();
	const raw = process.env[NOTION_BASE_URL_KEY];
	return normalizeRestOrigin(raw) ?? NOTION_DEFAULT_BASE_URL;
}
