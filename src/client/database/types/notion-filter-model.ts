/**
 * Notion API filter shapes and per-column filter option maps (user query DSL ↔ API).
 */

import type { QueryDataSourceParameters } from "@notionhq/client/build/src/api-endpoints";
import type { SupportedNotionColumnType } from "./schema";

type NotionApiFilter = NonNullable<QueryDataSourceParameters["filter"]>;
type ApiSingleFilter = Extract<NotionApiFilter, { property: string }>;
type ApiSingleFilterByColumnType = {
	[K in SupportedNotionColumnType]: Extract<
		ApiSingleFilter,
		Record<K, unknown>
	>[K];
};

type TextPropertyFilters = {
	equals: string;
	does_not_equal: string;
	contains: string;
	does_not_contain: string;
	starts_with: string;
	ends_with: string;
	is_empty: true;
	is_not_empty: true;
};

type NumberPropertyFilters = {
	equals: number;
	does_not_equals: number;
	greater_than: number;
	less_than: number;
	greater_than_or_equal_to: number;
	less_than_or_equal_to: number;
	is_empty: true;
	is_not_empty: true;
};

type CheckBoxPropertyFilters = {
	equals: boolean;
	does_not_equal: boolean;
};

type SchemaOptionUnion<T> = T extends readonly (infer U)[] ? U : T;

type SelectPropertyFilters<T> = {
	equals: SchemaOptionUnion<T> | string;
	does_not_equal: SchemaOptionUnion<T> | string;
	is_empty: true;
	is_not_empty: true;
};

type MultiSelectPropertyFilters<T> = {
	contains: SchemaOptionUnion<T> | string;
	does_not_contain: SchemaOptionUnion<T> | string;
	is_empty: true;
	is_not_empty: true;
};

type StatusPropertyFilters<T> = SelectPropertyFilters<T>;

type ISO8601Date = string;
type DatePropertyFilters = {
	equals: ISO8601Date;
	before: ISO8601Date;
	after: ISO8601Date;
	on_or_before: ISO8601Date;
	is_empty: true;
	is_not_empty: true;
	on_or_after: string;
	past_week: Record<string, never>;
	past_month: Record<string, never>;
	past_year: Record<string, never>;
	this_week: Record<string, never>;
	next_week: Record<string, never>;
	next_month: Record<string, never>;
	next_year: Record<string, never>;
};

type FilesPropertyFilters = ApiSingleFilterByColumnType["files"];
type PeoplePropertyFilters = ApiSingleFilterByColumnType["people"];
type RelationPropertyFilters = ApiSingleFilterByColumnType["relation"];
type CreatedByPropertyFilters = ApiSingleFilterByColumnType["created_by"];
type LastEditedByPropertyFilters =
	ApiSingleFilterByColumnType["last_edited_by"];
type CreatedTimePropertyFilters = ApiSingleFilterByColumnType["created_time"];
type LastEditedTimePropertyFilters =
	ApiSingleFilterByColumnType["last_edited_time"];
type UniqueIdPropertyFilters = ApiSingleFilterByColumnType["unique_id"];

export type FilterOptions<T = []> = {
	rich_text: TextPropertyFilters;
	title: TextPropertyFilters;
	number: NumberPropertyFilters;
	checkbox: CheckBoxPropertyFilters;
	select: SelectPropertyFilters<T>;
	multi_select: MultiSelectPropertyFilters<T>;
	url: TextPropertyFilters;
	date: DatePropertyFilters;
	status: StatusPropertyFilters<T>;
	email: TextPropertyFilters;
	phone_number: TextPropertyFilters;
	files: FilesPropertyFilters;
	people: PeoplePropertyFilters;
	relation: RelationPropertyFilters;
	created_by: CreatedByPropertyFilters;
	last_edited_by: LastEditedByPropertyFilters;
	created_time: CreatedTimePropertyFilters;
	last_edited_time: LastEditedTimePropertyFilters;
	unique_id: UniqueIdPropertyFilters;
};
