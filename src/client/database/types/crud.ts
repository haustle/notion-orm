/**
 * Parameter types for create / update / delete database operations.
 */

import type { CreatePageParameters } from "@notionhq/client/build/src/api-endpoints";
import type { QueryFilter } from "./query-filter";
import type {
	CreateSchema,
	DatabaseDefinition,
	DatabaseSchema,
	SchemaRecord,
} from "./schema";
import type { QuerySort } from "./sort";

export type Create<Y extends SchemaRecord> = {
	properties: Y;
	icon?: CreatePageParameters["icon"];
	cover?: CreatePageParameters["cover"];
	markdown?: CreatePageParameters["markdown"];
};

export type CreateMany<Y extends SchemaRecord> = ReadonlyArray<Create<Y>>;

export type Update<Y extends SchemaRecord> = {
	where: { id: string };
	properties: Partial<Y>;
};

export type UpdateMany<Definition extends DatabaseDefinition> = {
	where: QueryFilter<Definition>;
	properties: Partial<CreateSchema<Definition>>;
};

export type Upsert<Definition extends DatabaseDefinition> = {
	where: QueryFilter<Definition>;
	create: CreateSchema<Definition>;
	update: Partial<CreateSchema<Definition>>;
	/** When multiple rows match `where`, which row to update (default: oldest by `created_time`). */
	sortBy?: QuerySort<Definition>;
};

export type Delete = {
	where: { id: string };
};

export type DeleteMany<Definition extends DatabaseDefinition> = {
	where: QueryFilter<Definition>;
};
