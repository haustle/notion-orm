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
	formula: false,
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
type NotionApiSort = NonNullable<QueryDataSourceParameters["sorts"]>[number];
type NotionTimestampSort = Extract<NotionApiSort, { timestamp: string }>;
type NotionPropertySort = Extract<NotionApiSort, { property: string }>;
type ApiSingleFilterByColumnType = {
	[K in SupportedNotionColumnType]: Extract<
		ApiSingleFilter,
		Record<K, unknown>
	>[K];
};

export const FILTERABLE_PROPERTY_TYPES = {
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

type ColumnNameToNotionColumnType<Schema extends Record<string, unknown>> =
	Record<keyof Schema, SupportedNotionColumnType>;

type FilterValueForColumnType<
	PropertyValue,
	ColumnType extends SupportedNotionColumnType,
> = ColumnType extends "rich_text"
	? Partial<TextPropertyFilters>
	: ColumnType extends "title"
		? Partial<TextPropertyFilters>
		: ColumnType extends "number"
			? Partial<NumberPropertyFilters>
			: ColumnType extends "checkbox"
				? Partial<CheckBoxPropertyFilters>
				: ColumnType extends "select"
					? Partial<SelectPropertyFilters<NonNullable<PropertyValue>>>
					: ColumnType extends "multi_select"
						? Partial<MultiSelectPropertyFilters<NonNullable<PropertyValue>>>
						: ColumnType extends "url"
							? Partial<TextPropertyFilters>
							: ColumnType extends "date"
								? Partial<DatePropertyFilters>
								: ColumnType extends "status"
									? Partial<StatusPropertyFilters<NonNullable<PropertyValue>>>
									: ColumnType extends "email"
										? Partial<TextPropertyFilters>
										: ColumnType extends "phone_number"
											? Partial<TextPropertyFilters>
											: ColumnType extends "files"
												? Partial<FilesPropertyFilters>
												: ColumnType extends "people"
													? Partial<PeoplePropertyFilters>
													: ColumnType extends "relation"
														? Partial<RelationPropertyFilters>
														: ColumnType extends "created_by"
															? Partial<CreatedByPropertyFilters>
															: ColumnType extends "last_edited_by"
																? Partial<LastEditedByPropertyFilters>
																: ColumnType extends "created_time"
																	? Partial<CreatedTimePropertyFilters>
																	: ColumnType extends "last_edited_time"
																		? Partial<LastEditedTimePropertyFilters>
																		: ColumnType extends "unique_id"
																			? Partial<UniqueIdPropertyFilters>
																			: never;

type FilterValueForProperty<
	Schema extends Record<string, unknown>,
	ColumnNameToColumnType extends ColumnNameToNotionColumnType<Schema>,
	PropertyName extends keyof Schema,
> = FilterValueForColumnType<
	Schema[PropertyName],
	ColumnNameToColumnType[PropertyName]
>;

export type SingleFilter<
		Schema extends Record<string, unknown>,
		ColumnNameToColumnType extends ColumnNameToNotionColumnType<Schema>,
	> = {
		[PropertyName in keyof Schema]?: FilterValueForProperty<
			Schema,
			ColumnNameToColumnType,
			PropertyName
		>;
	};

export type CompoundFilters<
		Schema extends Record<string, unknown>,
		ColumnNameToColumnType extends Record<
			keyof Schema,
			SupportedNotionColumnType
		>,
	> =
		| {
				and: Array<
					| SingleFilter<Schema, ColumnNameToColumnType>
					| CompoundFilters<Schema, ColumnNameToColumnType>
				>;
		  }
		| {
				or: Array<
					| SingleFilter<Schema, ColumnNameToColumnType>
					| CompoundFilters<Schema, ColumnNameToColumnType>
				>;
		  };

export type QueryFilter<
	Schema extends Record<string, unknown>,
	ColumnNameToColumnType extends Record<
		keyof Schema,
		SupportedNotionColumnType
	>,
> =
	| SingleFilter<Schema, ColumnNameToColumnType>
	| CompoundFilters<Schema, ColumnNameToColumnType>;

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

type QueryBase<
	Y extends Record<string, any>,
	T extends Record<keyof Y, SupportedNotionColumnType>,
> = {
	filter?: QueryFilter<Y, T>;
	sort?: QuerySort<T>;
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

export type ProjectionPropertyName<Schema extends Record<string, any>> =
	Extract<keyof Schema, string | number>;

export type ProjectionPropertyList<Schema extends Record<string, any>> =
	readonly ProjectionPropertyName<Schema>[];

export type ProjectionArgs<Schema extends Record<string, any>> =
	| {
			select: ProjectionPropertyList<Schema>;
			omit?: never;
	  }
	| {
			omit: ProjectionPropertyList<Schema>;
			select?: never;
	  }
	| {
			select?: undefined;
			omit?: undefined;
	  };

type ResolvedProjectionArgs<
	Schema extends Record<string, any>,
	ProjectionSelection extends ProjectionArgs<Schema> | undefined,
> = [ProjectionSelection] extends [undefined]
	? ProjectionArgs<Schema>
	: ProjectionSelection extends ProjectionArgs<Schema>
		? ProjectionSelection
		: ProjectionArgs<Schema>;

/** Row shape after projection; tuple-wrapped checks avoid distributing over `ProjectionArgs<Schema>` when inference yields that union (e.g. find with only `where`), which would collapse `keyof` to `never`. */
export type ProjectedFromArgs<
	Schema extends Record<string, any>,
	ProjectionSelection extends ProjectionArgs<Schema> | undefined = undefined,
> = [ProjectionSelection] extends [undefined]
	? Partial<Schema>
	: [ProjectionSelection] extends [
				{
					select: infer SelectedPropertyNames extends
						ProjectionPropertyList<Schema>;
				},
			]
		? Partial<Pick<Schema, SelectedPropertyNames[number]>>
		: [ProjectionSelection] extends [
					{
						omit: infer OmittedPropertyNames extends
							ProjectionPropertyList<Schema>;
					},
				]
			? Partial<Omit<Schema, OmittedPropertyNames[number]>>
			: Partial<Schema>;

type ProjectionSelectionFromPropertyLists<
	Schema extends Record<string, any>,
	SelectedPropertyNames extends ProjectionPropertyList<Schema> | undefined,
	OmittedPropertyNames extends ProjectionPropertyList<Schema> | undefined,
> = SelectedPropertyNames extends ProjectionPropertyList<Schema>
	? { select: SelectedPropertyNames }
	: OmittedPropertyNames extends ProjectionPropertyList<Schema>
		? { omit: OmittedPropertyNames }
		: undefined;

export type ProjectedRow<
	Schema extends Record<string, any>,
	SelectedPropertyNames extends
		| ProjectionPropertyList<Schema>
		| undefined = undefined,
	OmittedPropertyNames extends
		| ProjectionPropertyList<Schema>
		| undefined = undefined,
> = ProjectedFromArgs<
	Schema,
	ProjectionSelectionFromPropertyLists<
		Schema,
		SelectedPropertyNames,
		OmittedPropertyNames
	>
>;

export type FindManyArgs<
		Schema extends Record<string, any>,
		ColumnNameToColumnType extends Record<
			keyof Schema,
			SupportedNotionColumnType
		>,
		ProjectionSelection extends ProjectionArgs<Schema> | undefined = undefined,
	> = {
		where?: QueryFilter<Schema, ColumnNameToColumnType>;
		sortBy?: QuerySort<ColumnNameToColumnType>;
		size?: number;
		stream?: number;
		after?: string | null;
	} & ResolvedProjectionArgs<Schema, ProjectionSelection>;

export type FindFirstArgs<
		Schema extends Record<string, any>,
		ColumnNameToColumnType extends Record<
			keyof Schema,
			SupportedNotionColumnType
		>,
		ProjectionSelection extends ProjectionArgs<Schema> | undefined = undefined,
	> = {
		where?: QueryFilter<Schema, ColumnNameToColumnType>;
		sortBy?: QuerySort<ColumnNameToColumnType>;
	} & ResolvedProjectionArgs<Schema, ProjectionSelection>;

export type FindUniqueArgs<
	Schema extends Record<string, any>,
	ProjectionSelection extends ProjectionArgs<Schema> | undefined = undefined,
> = {
	where: { id: string };
} & ResolvedProjectionArgs<Schema, ProjectionSelection>;

export type PaginateResult<Row extends object> = {
	data: Row[];
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
		markdown?: CreatePageParameters["markdown"];
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
