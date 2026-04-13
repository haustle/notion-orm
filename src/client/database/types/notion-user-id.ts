import { toUndashedNotionId } from "../../../helpers";
import type { BrandedNotionId } from "./notion-id-brand";

/**
 * Notion **user** id (UUID) for `people` property payloads and similar.
 * Plain strings assign; explicit `NotionUserId` annotations preserve nominal typing vs
 * {@link NotionPageId} / {@link NotionDatabaseId}.
 */
export type NotionUserId = BrandedNotionId<"user">;

/** Accepts dashed or undashed Notion ids; returns the canonical undashed form, branded. */
export function toNotionUserId(id: string): NotionUserId {
	return toUndashedNotionId(id);
}
