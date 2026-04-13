import { toUndashedNotionId } from "../../../helpers";
import type { BrandedNotionId } from "./notion-id-brand";

/**
 * Notion **page** id (UUID) for relation property values and similar.
 * Plain strings assign; explicit `NotionPageId` annotations preserve nominal typing vs
 * {@link NotionDatabaseId}.
 */
export type NotionPageId = BrandedNotionId<"page">;

/** Accepts dashed or undashed Notion ids; returns the canonical undashed form, branded. */
export function toNotionPageId(id: string): NotionPageId {
	return toUndashedNotionId(id);
}
