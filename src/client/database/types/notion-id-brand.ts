/**
 * Shared nominal typing for Notion id strings.
 *
 * **Runtime:** Values are ordinary strings (canonical undashed UUIDs from the `toNotion*`
 * helpers). The brand is compile-time only.
 *
 * **Assignability:** A branded id is a subtype of `string`, so you can pass `NotionPageId`
 * anywhere a `string` is expected. Same for arrays: `NotionPageId[]` assigns to `string[]`.
 * You may still see errors when:
 * - the value is **optional** (`NotionPageId[] | undefined` from a partial row) — use
 *   `ids ?? []`, `NonNullable`, or {@link brandedNotionIdsAsStringArray};
 * - the value is a **readonly** array — TypeScript will not assign `readonly NotionPageId[]`
 *   to a mutable `string[]`; use a copy (`[...ids]`) or {@link brandedNotionIdsAsStringArray}.
 *
 * Distinct brands ({@link NotionPageId} vs {@link NotionDatabaseId} vs {@link NotionUserId})
 * stay separate when you annotate variables or use the matching `toNotion*` helpers.
 */
export type NotionIdKind = "page" | "database" | "user";

export type BrandedNotionId<K extends NotionIdKind> = string & {
	readonly __notionIdKind?: K;
};

/**
 * Same elements at runtime; widens to a mutable `string[]` for APIs that expect plain
 * strings. Treats `null` / `undefined` as `[]` (copies via spread so readonly inputs are OK).
 */
export function brandedNotionIdsAsStringArray<K extends NotionIdKind>(
	ids: readonly BrandedNotionId<K>[] | BrandedNotionId<K>[] | null | undefined,
): string[] {
	return ids == null ? [] : [...ids];
}
