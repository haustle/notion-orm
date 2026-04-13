/**
 * Typed sort lists for database queries (property sorts + timestamp sorts).
 */

import type { QueryDataSourceParameters } from "@notionhq/client/build/src/api-endpoints";
import type {
	DatabaseColumnTypes,
	DatabaseDefinition,
} from "./schema";

type NotionApiSort = NonNullable<QueryDataSourceParameters["sorts"]>[number];
type NotionPropertySort = Extract<NotionApiSort, { property: string }>;
type NotionTimestampSort = Extract<NotionApiSort, { timestamp: string }>;

export type QuerySortDirection = NotionPropertySort["direction"];

export type QuerySortPropertyName<Definition extends DatabaseDefinition> = Extract<
	keyof DatabaseColumnTypes<Definition>,
	string
>;

export type QueryPropertySort<Definition extends DatabaseDefinition> = {
	property: QuerySortPropertyName<Definition>;
	direction: QuerySortDirection;
};

export type QueryTimestampSort = NotionTimestampSort;

export type QuerySort<Definition extends DatabaseDefinition> = Array<
	QueryPropertySort<Definition> | QueryTimestampSort
>;
