import { toUndashedNotionId } from "../../../helpers";
import type { BrandedNotionId } from "./notion-id-brand";

/**
 * Notion **database** id (canonical undashed UUID) for relation column
 * `relatedDatabaseId` metadata.
 * Plain strings assign; explicit `NotionDatabaseId` annotations preserve nominal typing vs
 * {@link NotionPageId}.
 */
export type NotionDatabaseId = BrandedNotionId<"database">;

/**
 * Accepts dashed or undashed Notion ids; validates UUID length/segment shape (see
 * {@link toUndashedNotionId}), then returns the canonical undashed form, branded.
 */
export function toNotionDatabaseId(id: string): NotionDatabaseId {
	return toUndashedNotionId(id);
}
