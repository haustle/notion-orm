/**
 * Base exports for @haustle/notion-orm
 * This file contains the stable base classes that generated code extends.
 * Consumer-local `notion/index.ts` is generated and extends the classes exported here.
 */

import type { NotionORMConfig } from "./config/resolveNotionAuth";
import { resolveNotionAuth } from "./config/resolveNotionAuth";

export { AgentClient } from "./client/agent/AgentClient";
export { DatabaseClient } from "./client/database/DatabaseClient";
export { buildZodFromColumns } from "./client/database/schema-builder";
export { isColumnTypesWithOptions } from "./client/database/types";
export type {
	BrandedNotionId,
	ColumnDefinition,
	ColumnDefinitionBase,
	ColumnTypesWithOptions,
	MultiSelectColumnDefinition,
	NotionDatabaseId,
	NotionIdKind,
	NotionPageId,
	NotionUserId,
	NotionPropertyTypeToColumnDefinitionMap,
	PlainColumnDefinition,
	RelationColumnDefinition,
	SelectColumnDefinition,
	StatusColumnDefinition,
	ColumnTypeMap,
	Count,
	Create,
	CreateMany,
	DatabaseCreatePageResult,
	DatabaseColumns,
	DatabaseColumnTypes,
	CreateSchema,
	DatabaseDefinition,
	DatabasePropertyType,
	DatabasePropertyValue,
	DatabaseSchema,
	Delete,
	DeleteMany,
	FindFirst,
	FindMany,
	FindUnique,
	InferDatabaseColumns,
	InferCreateSchema,
	InferDatabaseSchema,
	NotWritableDatabaseColumnType,
	PaginateResult,
	ProjectedRow,
	Projection,
	ProjectionPropertyList,
	Query,
	ResultProjection,
	SchemaRecord,
	Update,
	UpdateMany,
	Upsert,
} from "./client/database/types";
export {
	brandedNotionIdsAsStringArray,
	DATABASE_CREATE_PAGE_RESULT_PAGE_KEYS,
	toNotionDatabaseId,
	toNotionPageId,
	toNotionUserId,
} from "./client/database/types";
export type { NotionConfigType } from "./config/types";
export type { NotionORMConfig } from "./config/resolveNotionAuth";
export {
	NOTION_BASE_URL_KEY,
	NOTION_DEFAULT_BASE_URL,
	resolveNotionApiBaseUrl,
} from "./config/notionHqRestEnv";
export { resolveNotionAuth } from "./config/resolveNotionAuth";
export type { Simplify } from "./typeUtils";

export class NotionORMBase {
	protected readonly notionAuth: string;

	constructor(config: NotionORMConfig) {
		this.notionAuth = resolveNotionAuth(config);
		// Database and agent properties are added by the generated NotionORM class
	}
}
