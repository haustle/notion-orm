/**
 * Environment-driven REST **origin** for `@notionhq/client` (`DatabaseClient`, CLI codegen, `notion add`).
 *
 * Override with `{@link NOTION_BASE_URL_KEY}`. When unset or blank, `{@link NOTION_DEFAULT_BASE_URL}` applies.
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
 * REST origin for `@notionhq/client` (no `/v1` suffix). Uses env when set; otherwise {@link NOTION_DEFAULT_BASE_URL}.
 */
export function resolveNotionApiBaseUrl(): string {
	loadDotEnvFromCwd();
	const raw = process.env[NOTION_BASE_URL_KEY];
	return normalizeRestOrigin(raw) ?? NOTION_DEFAULT_BASE_URL;
}
