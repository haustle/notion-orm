import {
	DASHED_NOTION_ID_PATTERN,
	UNDASHED_NOTION_ID_PATTERN,
} from "./notion-id-patterns";

/**
 * Returns a random version 4 UUID string using the built-in Web Crypto API
 * (`globalThis.crypto.randomUUID()` — Node 19+ and modern browsers).
 */
export function randomUuidV4(): string {
	const crypto = globalThis.crypto;
	if (crypto?.randomUUID === undefined) {
		throw new Error(
			"globalThis.crypto.randomUUID is not available (requires Node 19+ or a modern browser).",
		);
	}
	return crypto.randomUUID();
}

/** Normalizes arbitrary labels into stable camelCase identifiers for emitted symbols. */
export function camelize(str: string) {
	const tokens = str
		.replace(/[^a-zA-Z0-9]+/g, " ")
		.trim()
		.split(/\s+/)
		.filter((token) => token.length > 0)
		.map((token) => token.toLowerCase());

	if (tokens.length === 0) {
		return "";
	}

	const [firstToken, ...remainingTokens] = tokens;
	return `${firstToken}${remainingTokens
		.map((token) => token[0].toUpperCase() + token.slice(1))
		.join("")}`;
}

/**
 * Capitalizes the first character of an identifier (e.g. camelCase module key → file stem).
 * Used for generated module filenames alongside PascalCase factory exports.
 */
export function toPascalCase(value: string): string {
	if (!value) {
		return value;
	}
	return value[0].toUpperCase() + value.slice(1);
}

/**
 * Accepts dashed or undashed Notion UUIDs and returns the canonical undashed (32 hex) form.
 * - With hyphens: must match dashed 8-4-4-4-12 lowercase hex.
 * - Without hyphens: must be exactly 32 hex characters.
 * Trims ASCII whitespace; empty / invalid shapes throw.
 */
export function toUndashedNotionId(id: string): string {
	const trimmed = id.trim();
	if (trimmed.length === 0) {
		throw new Error(`Invalid Notion ID: expected a non-empty string.`);
	}
	const lowered = trimmed.toLowerCase();
	if (lowered.includes("-")) {
		if (!DASHED_NOTION_ID_PATTERN.test(lowered)) {
			throw new Error(
				`Invalid Notion ID. Expected UUID shape (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx), received '${id}'.`,
			);
		}
		return lowered.replace(/-/g, "");
	}
	if (!UNDASHED_NOTION_ID_PATTERN.test(lowered)) {
		throw new Error(
			`Invalid Notion ID. Expected 32 hexadecimal characters, received '${id}'.`,
		);
	}
	return lowered;
}

/** Formats a canonical Notion id back into dashed UUID form for user-facing output. */
export function toDashedNotionId(id: string): string {
	const normalizedId = toUndashedNotionId(id);
	return `${normalizedId.slice(0, 8)}-${normalizedId.slice(8, 12)}-${normalizedId.slice(12, 16)}-${normalizedId.slice(16, 20)}-${normalizedId.slice(20)}`;
}
