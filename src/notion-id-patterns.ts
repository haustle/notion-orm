/**
 * Canonical Notion UUID string shapes (lowercase hex). Callers should
 * {@link String.prototype.toLowerCase toLowerCase} user input before testing.
 */

/** Undashed 32-char hex (canonical Notion id storage form). */
export const UNDASHED_NOTION_ID_PATTERN = /^[0-9a-f]{32}$/;

/** Dashed form: 8-4-4-4-12 lowercase hex. */
export const DASHED_NOTION_ID_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
