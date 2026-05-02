/**
 * Environment-driven REST **origin** for `@notionhq/client` (`DatabaseClient`, CLI codegen, `notion add`).
 *
 * Prefer `{@link NOTION_BASE_URL_ENV}`. **`NOTION_API_BASE_URL`** remains a legacy fallback when unset.
 *
 * **`@notionhq/agents-client`** is wired with **`auth`** only in this package; it does not read these vars here.
 */

import { loadDotEnvFromCwd } from "./loadDotEnvFromCwd";

export const NOTION_BASE_URL_ENV = "NOTION_BASE_URL" as const;

/** Legacy env key; still read after {@link NOTION_BASE_URL_ENV} when the latter is absent. */
export const NOTION_LEGACY_REST_BASE_URL_ENV = "NOTION_API_BASE_URL" as const;

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
 * Returns the optional REST origin (no `/v1` suffix). `undefined` means `@notionhq/client` keeps its built-in host.
 */
export function resolveNotionApiBaseUrl(): string | undefined {
	loadDotEnvFromCwd();
	const raw =
		process.env[NOTION_BASE_URL_ENV] ??
		process.env[NOTION_LEGACY_REST_BASE_URL_ENV];
	return normalizeRestOrigin(raw);
}
