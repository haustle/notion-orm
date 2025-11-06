/**
 * Column types' for all query options
 */
// import { PageObjectResponse }

import {
	PageObjectResponse,
	QueryDatabaseResponse,
} from "@notionhq/client/build/src/api-endpoints";

type columnDiscriminatedUnionTypes = PageObjectResponse["properties"];
export type NotionColumnTypes =
	columnDiscriminatedUnionTypes[keyof columnDiscriminatedUnionTypes]["type"];
// type SupportedQueryableNotionColumnTypes = Exclude<NotionColumnTypes, "created_by" | >

export type SupportedNotionColumnTypes = Exclude<
	NotionColumnTypes,
	| "formula"
	| "files"
	| "people"
	| "relation"
	| "rollup"
	| "created_by"
	| "last_edited_by"
	| "created_time"
	| "last_edited_time"
>;

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

//
type SelectPropertyFilters<T> = {
	equals: (T extends Array<any> ? T[number] : T) | (string & {});
	does_not_equal: (T extends Array<any> ? T[number] : T) | (string & {});
	is_empty: true;
	is_not_empty: true;
};

// pay in array --> need to turn into union
type MultiSelectPropertyFilters<T> = {
	contains: (T extends Array<any> ? T[number] : T) | (string & {});
	does_not_contain: (T extends Array<any> ? T[number] : T) | (string & {});
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
	past_week: {};
	past_month: {};
	past_year: {};
	this_week: {};
	next_week: {};
	next_month: {};
	next_year: {};
};

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
};

/**
 * Types to build query object user types out
 */

type ColumnNameToNotionColumnType<T> = Record<
	keyof T,
	SupportedNotionColumnTypes
>;
type ColumnNameToPossibleValues = Record<string, any>;
// T is a column name to column type
// Y is the collection type
export type SingleFilter<
	Y extends Record<string, any>,
	T extends ColumnNameToNotionColumnType<Y>
> = {
	// Passing the type from collection
	[Property in keyof Y]?: T[Property] extends keyof FilterOptions<Y[Property]> 
		? Partial<FilterOptions<Y[Property]>[T[Property]]>
		: never;
};

export type CompoundFilters<
	Y extends Record<string, any>,
	T extends Record<keyof Y, SupportedNotionColumnTypes>
> =
	| { and: Array<SingleFilter<Y, T> | CompoundFilters<Y, T>> }
	| { or: Array<SingleFilter<Y, T> | CompoundFilters<Y, T>> };

export type QueryFilter<
	Y extends Record<string, any>,
	T extends Record<keyof Y, SupportedNotionColumnTypes>
> = SingleFilter<Y, T> | CompoundFilters<Y, T>;

export type Query<
	Y extends Record<string, any>,
	T extends Record<keyof Y, SupportedNotionColumnTypes>
> = {
	filter?: QueryFilter<Y, T>;
	sort?: [];
};

export type apiFilterQuery = {
	filter?: apiSingleFilter | apiAndFilter | apiOrFilter;
};

/**
 * Transform the types above to build types to
 * actually build schema for query request
 */

type apiColumnTypeToOptions = {
	[prop in keyof FilterOptions]?: Partial<FilterOptions[prop]>;
};
export interface apiSingleFilter extends apiColumnTypeToOptions {
	property: string;
}

export type apiFilterType =
	| apiSingleFilter
	| apiAndFilter
	| apiOrFilter
	| undefined;
type apiAndFilter = {
	and: Array<apiFilterType>;
};

type apiOrFilter = {
	or: Array<apiFilterType>;
};

export type SimpleQueryResponse<DatabaseSchema> = {
	results: Partial<DatabaseSchema>[];
	rawResponse: QueryDatabaseResponse;
};
