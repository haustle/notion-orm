/**
 * Parameter types for create / update / delete database operations.
 */

import type {
	CreatePageParameters,
	PageObjectResponse,
	PartialPageObjectResponse,
} from "@notionhq/client/build/src/api-endpoints";
import type { QueryFilter } from "./query-filter";
import type {
	CreateSchema,
	DatabaseDefinition,
	DatabaseSchema,
	SchemaRecord,
} from "./schema";
import type { QuerySort } from "./sort";

/**
 * Keys copied from Notion’s {@link PageObjectResponse} onto the object returned by `DatabaseClient#create`
 * when the create response is a full page (see `create-page-result.ts`).
 * Partial create responses only include `id` and `object`.
 *
 * Add or remove keys here to cherry-pick from the SDK page type; the tuple must stay assignable to `keyof PageObjectResponse`.
 */
export const DATABASE_CREATE_PAGE_RESULT_PAGE_KEYS = [
	"id",
	"object",
	"url",
	"properties",
	"created_time",
	"last_edited_time",
] as const satisfies ReadonlyArray<keyof PageObjectResponse>;

/**
 * Payload returned from `DatabaseClient#create` / `upsert` (create branch). Built only from fields Notion actually
 * sent back: either `{ id, object }` or a {@link Pick} of {@link PageObjectResponse} using
 * {@link DATABASE_CREATE_PAGE_RESULT_PAGE_KEYS} — never extra keys from the raw client response.
 * `properties` is Notion’s API shape; use `findUnique` for ORM-normalized {@link DatabaseSchema} rows.
 */
export type DatabaseCreatePageResult =
	| PartialPageObjectResponse
	| Pick<
			PageObjectResponse,
			(typeof DATABASE_CREATE_PAGE_RESULT_PAGE_KEYS)[number]
	  >;

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
