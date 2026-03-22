/**
 * Column types' for all query options
 */

import type {
	CreatePageParameters,
	DataSourceObjectResponse,
	QueryDataSourceParameters,
	QueryDataSourceResponse,
} from "@notionhq/client/build/src/api-endpoints";

type NotionPropertyTypeToConfigMap = DataSourceObjectResponse["properties"];
export type DatabasePropertyType =
	NotionPropertyTypeToConfigMap[keyof NotionPropertyTypeToConfigMap]["type"];

/**
 * Union of all value types a database property can hold (read or write).
 * Used as the base constraint for schema generics throughout the client.
 */
export type DatabasePropertyValue =
	| string
	| number
	| boolean
	| null
	| string[]
	| { name: string; url: string }[]
	| { start: string; end?: string | null };

export const SUPPORTED_PROPERTY_TYPES = {
	formula: true,
	files: true,
	people: true,
	relation: true,
	rollup: false,
	created_by: true,
	last_edited_by: true,
	created_time: true,
	last_edited_time: true,

	// Working property types
	url: true,
	phone_number: true,
	title: true,
	email: true,
	checkbox: true,
	date: true,
	multi_select: true,
	status: true,
	number: true,
	rich_text: true,
	select: true,
	unique_id: true,
} as const satisfies Record<DatabasePropertyType, boolean>;

export function isSupportedPropertyType(
	propertyType: DatabasePropertyType,
): propertyType is SupportedNotionColumnType {
	return SUPPORTED_PROPERTY_TYPES[propertyType];
}

// Extract the keys of the object that are true
export type SupportedNotionColumnType = {
	[K in keyof typeof SUPPORTED_PROPERTY_TYPES]: (typeof SUPPORTED_PROPERTY_TYPES)[K] extends true
		? K
		: never;
}[keyof typeof SUPPORTED_PROPERTY_TYPES];

type NotionApiFilter = NonNullable<QueryDataSourceParameters["filter"]>;
type ApiSingleFilter = Extract<NotionApiFilter, { property: string }>;
type ApiSingleFilterByColumnType = {
	[K in SupportedNotionColumnType]: Extract<
		ApiSingleFilter,
		Record<K, unknown>
	>[K];
};

export const FILTERABLE_PROPERTY_TYPES = {
	formula: false,
	files: true,
	people: true,
	relation: true,
	created_by: true,
	last_edited_by: true,
	created_time: true,
	last_edited_time: true,

	// Supported + filterable
	url: true,
	phone_number: true,
	title: true,
	email: true,
	checkbox: true,
	date: true,
	multi_select: true,
	status: true,
	number: true,
	rich_text: true,
	select: true,
	unique_id: true,
} as const satisfies Record<SupportedNotionColumnType, boolean>;

export type FilterableNotionColumnType = {
	[K in keyof typeof FILTERABLE_PROPERTY_TYPES]: (typeof FILTERABLE_PROPERTY_TYPES)[K] extends true
		? K
		: never;
}[keyof typeof FILTERABLE_PROPERTY_TYPES];

export function isFilterablePropertyType(
	propertyType: SupportedNotionColumnType,
): propertyType is FilterableNotionColumnType {
	return FILTERABLE_PROPERTY_TYPES[propertyType];
}

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

/**
 * Types to build query object user types out
 */

type ColumnNameToNotionColumnType<T> = Record<
	keyof T,
	SupportedNotionColumnType
>;
// T is a column name to column type
// Y is the collection type
export type SingleFilter<
	Y extends Record<string, any>,
	T extends ColumnNameToNotionColumnType<Y>,
> = {
	// Passing the type from collection
	[Property in keyof Y]?: T[Property] extends keyof FilterOptions<Y[Property]>
		? Partial<FilterOptions<Y[Property]>[T[Property]]>
		: never;
};

export type CompoundFilters<
	Y extends Record<string, any>,
	T extends Record<keyof Y, SupportedNotionColumnType>,
> =
	| { and: Array<SingleFilter<Y, T> | CompoundFilters<Y, T>> }
	| { or: Array<SingleFilter<Y, T> | CompoundFilters<Y, T>> };

export type QueryFilter<
	Y extends Record<string, any>,
	T extends Record<keyof Y, SupportedNotionColumnType>,
> = SingleFilter<Y, T> | CompoundFilters<Y, T>;

type QueryBase<
	Y extends Record<string, any>,
	T extends Record<keyof Y, SupportedNotionColumnType>,
> = {
	filter?: QueryFilter<Y, T>;
	sort?: QueryDataSourceParameters["sorts"];
};

export type QueryWithoutRawResponse<
	Y extends Record<string, any>,
	T extends Record<keyof Y, SupportedNotionColumnType>,
> = QueryBase<Y, T> & {
	includeRawResponse?: false | undefined;
};

export type QueryWithRawResponse<
	Y extends Record<string, any>,
	T extends Record<keyof Y, SupportedNotionColumnType>,
> = QueryBase<Y, T> & {
	includeRawResponse: true;
};

export type Query<
	Y extends Record<string, any>,
	T extends Record<keyof Y, SupportedNotionColumnType>,
> = QueryWithoutRawResponse<Y, T> | QueryWithRawResponse<Y, T>;

export type apiFilterQuery = {
	filter?: apiSingleFilter | apiAndFilter | apiOrFilter;
};

/**
 * Transform the types above to build types to
 * actually build schema for query request
 */

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

export type FindManyArgs<
		Y extends Record<string, any>,
		T extends Record<keyof Y, SupportedNotionColumnType>,
	> = {
		where?: QueryFilter<Y, T>;
		sortBy?: QueryDataSourceParameters["sorts"];
		size?: number;
		select?: { [K in keyof Y]?: true };
		omit?: { [K in keyof Y]?: true };
		stream?: number;
		after?: string | null;
	};

export type FindFirstArgs<
	Y extends Record<string, any>,
	T extends Record<keyof Y, SupportedNotionColumnType>,
> = {
	where?: QueryFilter<Y, T>;
	sortBy?: QueryDataSourceParameters["sorts"];
	select?: { [K in keyof Y]?: true };
	omit?: { [K in keyof Y]?: true };
};

export type FindUniqueArgs = {
	where: { id: string };
};

export type PaginateResult<DatabaseSchema> = {
	data: Partial<DatabaseSchema>[];
	nextCursor: string | null;
	hasMore: boolean;
};

export type CountArgs<
	Y extends Record<string, any>,
	T extends Record<keyof Y, SupportedNotionColumnType>,
> = {
	where?: QueryFilter<Y, T>;
};

export type CreateArgs<Y extends Record<string, DatabasePropertyValue>> = {
	properties: Y;
	icon?: CreatePageParameters["icon"];
	cover?: CreatePageParameters["cover"];
};

export type CreateManyArgs<Y extends Record<string, DatabasePropertyValue>> = {
	properties: Y[];
};

export type UpdateArgs<Y extends Record<string, DatabasePropertyValue>> = {
	where: { id: string };
	properties: Partial<Y>;
};

export type UpdateManyArgs<
	Y extends Record<string, any>,
	T extends Record<keyof Y, SupportedNotionColumnType>,
> = {
	where: QueryFilter<Y, T>;
	properties: Partial<Y>;
};

export type UpsertArgs<
	Y extends Record<string, any>,
	T extends Record<keyof Y, SupportedNotionColumnType>,
> = {
	where: QueryFilter<Y, T>;
	create: Y;
	update: Partial<Y>;
};

export type DeleteArgs = {
	where: { id: string };
};

export type DeleteManyArgs<
	Y extends Record<string, any>,
	T extends Record<keyof Y, SupportedNotionColumnType>,
> = {
	where: QueryFilter<Y, T>;
};
