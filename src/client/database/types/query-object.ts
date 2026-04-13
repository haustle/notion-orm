/**
 * Top-level `Query` object and wire-format filter aliases / normalized responses.
 */

import type {
	QueryDataSourceParameters,
	QueryDataSourceResponse,
} from "@notionhq/client/build/src/api-endpoints";
import type { QueryFilter } from "./query-filter";
import type { SchemaRecord, SupportedNotionColumnType } from "./schema";
import type { QuerySort } from "./sort";

type NotionApiFilter = NonNullable<QueryDataSourceParameters["filter"]>;

type QueryBase<
	Y extends SchemaRecord,
	T extends Record<keyof Y, SupportedNotionColumnType>,
> = {
	filter?: QueryFilter<Y, T>;
	sort?: QuerySort<T>;
};

export type QueryWithoutRawResponse<
	Y extends SchemaRecord,
	T extends Record<keyof Y, SupportedNotionColumnType>,
> = QueryBase<Y, T> & {
	includeRawResponse?: false | undefined;
};

export type QueryWithRawResponse<
	Y extends SchemaRecord,
	T extends Record<keyof Y, SupportedNotionColumnType>,
> = QueryBase<Y, T> & {
	includeRawResponse: true;
};

export type Query<
	Y extends SchemaRecord,
	T extends Record<keyof Y, SupportedNotionColumnType>,
> = QueryWithoutRawResponse<Y, T> | QueryWithRawResponse<Y, T>;

export type apiFilterQuery = {
	filter?: apiSingleFilter | apiAndFilter | apiOrFilter;
};

export type apiSingleFilter = Extract<NotionApiFilter, { property: string }>;
export type apiAndFilter = Extract<NotionApiFilter, { and: unknown }>;
export type apiOrFilter = Extract<NotionApiFilter, { or: unknown }>;
export type apiFilterType = QueryDataSourceParameters["filter"];

type QueryBaseResponse<DatabaseSchema> = {
	results: Partial<DatabaseSchema>[];
};

export type QueryResponseWithRawResponse<DatabaseSchema> =
	QueryBaseResponse<DatabaseSchema> & {
		rawResponse: QueryDataSourceResponse;
	};

export type QueryResponseWithoutRawResponse<DatabaseSchema> =
	QueryBaseResponse<DatabaseSchema>;

export type SimpleQueryResponse<DatabaseSchema> =
	| QueryResponseWithoutRawResponse<DatabaseSchema>
	| QueryResponseWithRawResponse<DatabaseSchema>;
