/**
 * Typed sort lists for database queries (property sorts + timestamp sorts).
 */

import type { QueryDataSourceParameters } from "@notionhq/client/build/src/api-endpoints";
import type { SupportedNotionColumnType } from "./schema";

type NotionApiSort = NonNullable<QueryDataSourceParameters["sorts"]>[number];
type NotionPropertySort = Extract<NotionApiSort, { property: string }>;
type NotionTimestampSort = Extract<NotionApiSort, { timestamp: string }>;

export type QuerySortDirection = NotionPropertySort["direction"];

export type QuerySortPropertyName<
	ColumnNameToColumnType extends Record<string, SupportedNotionColumnType>,
> = Extract<keyof ColumnNameToColumnType, string>;

export type QueryPropertySort<
	ColumnNameToColumnType extends Record<string, SupportedNotionColumnType>,
> = {
	property: QuerySortPropertyName<ColumnNameToColumnType>;
	direction: QuerySortDirection;
};

export type QueryTimestampSort = NotionTimestampSort;

export type QuerySort<
	ColumnNameToColumnType extends Record<string, SupportedNotionColumnType>,
> = Array<QueryPropertySort<ColumnNameToColumnType> | QueryTimestampSort>;
