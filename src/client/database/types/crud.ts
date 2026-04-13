/**
 * Parameter types for create / update / delete database operations.
 */

import type { CreatePageParameters } from "@notionhq/client/build/src/api-endpoints";
import type { QueryFilter } from "./query-filter";
import type { SchemaRecord, SupportedNotionColumnType } from "./schema";

export type Create<Y extends SchemaRecord> = {
	properties: Y;
	icon?: CreatePageParameters["icon"];
	cover?: CreatePageParameters["cover"];
	markdown?: CreatePageParameters["markdown"];
};

export type CreateMany<Y extends SchemaRecord> = {
	properties: Y[];
};

export type Update<Y extends SchemaRecord> = {
	where: { id: string };
	properties: Partial<Y>;
};

export type UpdateMany<
	Y extends SchemaRecord,
	T extends Record<keyof Y, SupportedNotionColumnType>,
> = {
	where: QueryFilter<Y, T>;
	properties: Partial<Y>;
};

export type Upsert<
	Y extends SchemaRecord,
	T extends Record<keyof Y, SupportedNotionColumnType>,
> = {
	where: QueryFilter<Y, T>;
	create: Y;
	update: Partial<Y>;
};

export type Delete = {
	where: { id: string };
};

export type DeleteMany<
	Y extends SchemaRecord,
	T extends Record<keyof Y, SupportedNotionColumnType>,
> = {
	where: QueryFilter<Y, T>;
};
