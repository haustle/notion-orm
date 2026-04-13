/**
 * Select/omit projection helpers for `findMany` / `findFirst` / `findUnique`,
 * plus paginated/streaming `find*` argument shapes.
 */

import type { QueryFilter } from "./query-filter";
import type {
	DatabaseDefinition,
	DatabasePropertyValue,
	DatabaseSchema,
	SchemaRecord,
} from "./schema";
import type { QuerySort } from "./sort";

export type ProjectionPropertyName<Schema extends SchemaRecord> = Extract<
	keyof Schema,
	string
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
	Definition extends DatabaseDefinition,
	ProjectionSelection extends
			| Projection<DatabaseSchema<Definition>>
		| undefined = undefined,
> = {
	where?: QueryFilter<Definition>;
	sortBy?: QuerySort<Definition>;
	size?: number;
	stream?: number;
	after?: string | null;
} & ResolvedProjection<DatabaseSchema<Definition>, ProjectionSelection>;

export type FindFirst<
	Definition extends DatabaseDefinition,
	ProjectionSelection extends
			| Projection<DatabaseSchema<Definition>>
		| undefined = undefined,
> = {
	where?: QueryFilter<Definition>;
	sortBy?: QuerySort<Definition>;
} & ResolvedProjection<DatabaseSchema<Definition>, ProjectionSelection>;

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

export type Count<Definition extends DatabaseDefinition> = {
	where?: QueryFilter<Definition>;
};

/** Discriminated `findMany` args: streaming (async iterable). */
export type FindManyStream<
	Definition extends DatabaseDefinition,
	Proj extends Projection<DatabaseSchema<Definition>> | undefined,
> = FindMany<Definition, Proj> & {
	stream: number;
	after?: never;
};

/** Discriminated `findMany` args: cursor pagination. */
export type FindManyPaginated<
	Definition extends DatabaseDefinition,
	Proj extends Projection<DatabaseSchema<Definition>> | undefined,
> = FindMany<Definition, Proj> & {
	after: string | null;
	stream?: never;
};

/** Discriminated `findMany` args: load full list in one response. */
export type FindManyList<
	Definition extends DatabaseDefinition,
	Proj extends Projection<DatabaseSchema<Definition>> | undefined,
> = FindMany<Definition, Proj> & {
	after?: never;
	stream?: never;
};
