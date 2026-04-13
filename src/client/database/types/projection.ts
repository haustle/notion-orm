/**
 * Select/omit projection helpers for `findMany` / `findFirst` / `findUnique`,
 * plus paginated/streaming `find*` argument shapes.
 */

import type { QueryFilter } from "./query-filter";
import type {
	ColumnTypeMap,
	DatabasePropertyValue,
	SchemaRecord,
	SupportedNotionColumnType,
} from "./schema";
import type { QuerySort } from "./sort";

export type ProjectionPropertyName<Schema extends SchemaRecord> = Extract<
	keyof Schema,
	string | number
>;

export type ProjectionPropertyList<Schema extends SchemaRecord> =
	readonly ProjectionPropertyName<Schema>[];

export type Projection<Schema extends SchemaRecord> =
	| {
			select: ProjectionPropertyList<Schema>;
			omit?: never;
	  }
	| {
			select?: never;
			omit: ProjectionPropertyList<Schema>;
	  }
	| {
			select?: undefined;
			omit?: undefined;
	  };

export type ProjectionSelection<Schema extends SchemaRecord> =
	| Projection<Schema>
	| undefined;

type ResolvedProjection<
	Schema extends SchemaRecord,
	ProjectionSelection extends Projection<Schema> | undefined,
> = [ProjectionSelection] extends [undefined]
	? Projection<Schema>
	: ProjectionSelection extends Projection<Schema>
		? ProjectionSelection
		: Projection<Schema>;

/** Row type implied by a select/omit `Projection`; tuple form avoids `keyof` collapsing when `Projection` is a union. */
export type ResultProjection<
	Schema extends SchemaRecord,
	ProjectionSelection extends Projection<Schema> | undefined = undefined,
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
	Schema extends SchemaRecord,
	SelectedPropertyNames extends ProjectionPropertyList<Schema> | undefined,
	OmittedPropertyNames extends ProjectionPropertyList<Schema> | undefined,
> = SelectedPropertyNames extends ProjectionPropertyList<Schema>
	? { select: SelectedPropertyNames }
	: OmittedPropertyNames extends ProjectionPropertyList<Schema>
		? { omit: OmittedPropertyNames }
		: undefined;

export type ProjectedRow<
	Schema extends SchemaRecord,
	SelectedPropertyNames extends
		| ProjectionPropertyList<Schema>
		| undefined = undefined,
	OmittedPropertyNames extends
		| ProjectionPropertyList<Schema>
		| undefined = undefined,
> = ResultProjection<
	Schema,
	ProjectionSelectionFromPropertyLists<
		Schema,
		SelectedPropertyNames,
		OmittedPropertyNames
	>
>;

export type FindMany<
	Schema extends SchemaRecord,
	ColumnNameToColumnType extends ColumnTypeMap<Schema>,
	ProjectionSelection extends Projection<Schema> | undefined = undefined,
> = {
	where?: QueryFilter<Schema, ColumnNameToColumnType>;
	sortBy?: QuerySort<ColumnNameToColumnType>;
	size?: number;
	stream?: number;
	after?: string | null;
} & ResolvedProjection<Schema, ProjectionSelection>;

export type FindFirst<
	Schema extends SchemaRecord,
	ColumnNameToColumnType extends ColumnTypeMap<Schema>,
	ProjectionSelection extends Projection<Schema> | undefined = undefined,
> = {
	where?: QueryFilter<Schema, ColumnNameToColumnType>;
	sortBy?: QuerySort<ColumnNameToColumnType>;
} & ResolvedProjection<Schema, ProjectionSelection>;

export type FindUnique<
	Schema extends SchemaRecord,
	ProjectionSelection extends Projection<Schema> | undefined = undefined,
> = {
	where: { id: string };
} & ResolvedProjection<Schema, ProjectionSelection>;

export type PaginateResult<Row extends object> = {
	data: Row[];
	nextCursor: string | null;
	hasMore: boolean;
};

export type Count<
	Y extends SchemaRecord,
	T extends Record<keyof Y, SupportedNotionColumnType>,
> = {
	where?: QueryFilter<Y, T>;
};

/** Discriminated `findMany` args: streaming (async iterable). */
export type FindManyStream<
	DatabaseSchemaType extends Record<string, DatabasePropertyValue>,
	ColumnNameToColumnType extends Record<
		keyof DatabaseSchemaType,
		SupportedNotionColumnType
	>,
	Proj extends Projection<DatabaseSchemaType> | undefined,
> = FindMany<DatabaseSchemaType, ColumnNameToColumnType, Proj> & {
	stream: number;
	after?: never;
};

/** Discriminated `findMany` args: cursor pagination. */
export type FindManyPaginated<
	DatabaseSchemaType extends Record<string, DatabasePropertyValue>,
	ColumnNameToColumnType extends Record<
		keyof DatabaseSchemaType,
		SupportedNotionColumnType
	>,
	Proj extends Projection<DatabaseSchemaType> | undefined,
> = FindMany<DatabaseSchemaType, ColumnNameToColumnType, Proj> & {
	after: string | null;
	stream?: never;
};

/** Discriminated `findMany` args: load full list in one response. */
export type FindManyList<
	DatabaseSchemaType extends Record<string, DatabasePropertyValue>,
	ColumnNameToColumnType extends Record<
		keyof DatabaseSchemaType,
		SupportedNotionColumnType
	>,
	Proj extends Projection<DatabaseSchemaType> | undefined,
> = FindMany<DatabaseSchemaType, ColumnNameToColumnType, Proj> & {
	after?: never;
	stream?: never;
};
