/**
 * Top-level `Query` object and wire-format filter aliases / normalized responses.
 */

import type {
	QueryDataSourceParameters,
	QueryDataSourceResponse,
} from "@notionhq/client/build/src/api-endpoints";
import type { QueryFilter } from "./query-filter";
import type { DatabaseDefinition } from "./schema";
import type { QuerySort } from "./sort";

type NotionApiFilter = NonNullable<QueryDataSourceParameters["filter"]>;

type QueryBase<Definition extends DatabaseDefinition> = {
	filter?: QueryFilter<Definition>;
	sort?: QuerySort<Definition>;
};

export type QueryWithoutRawResponse<Definition extends DatabaseDefinition> =
	QueryBase<Definition> & {
	includeRawResponse?: false | undefined;
};

export type QueryWithRawResponse<Definition extends DatabaseDefinition> =
	QueryBase<Definition> & {
	includeRawResponse: true;
};

export type Query<Definition extends DatabaseDefinition> =
	| QueryWithoutRawResponse<Definition>
	| QueryWithRawResponse<Definition>;

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
