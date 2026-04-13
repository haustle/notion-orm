/**
 * Base exports for @haustle/notion-orm
 * This file contains the stable base classes that generated code extends.
 * The main index.ts is generated and re-exports from here plus adds generated types.
 */

import type { NotionORMConfig } from "./config/resolveNotionAuth";
import { resolveNotionAuth } from "./config/resolveNotionAuth";

export { AgentClient } from "./client/agent/AgentClient";
export { DatabaseClient } from "./client/database/DatabaseClient";
export { buildZodFromColumns } from "./client/database/schema-builder";
export { isColumnTypesWithOptions } from "./client/database/types";
export type {
	ColumnDefinition,
	ColumnDefinitionBase,
	ColumnTypesWithOptions,
	MultiSelectColumnDefinition,
	NotionPropertyTypeToColumnDefinitionMap,
	PlainColumnDefinition,
	RelationColumnDefinition,
	SelectColumnDefinition,
	StatusColumnDefinition,
	ColumnTypeMap,
	Count,
	Create,
	CreateMany,
	DatabaseColumns,
	DatabaseColumnTypes,
	DatabaseDefinition,
	DatabasePropertyType,
	DatabasePropertyValue,
	DatabaseSchema,
	Delete,
	DeleteMany,
	FindFirst,
	FindMany,
	FindUnique,
	InferDatabaseSchema,
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
export type { NotionConfigType } from "./config/helpers";
export type { NotionORMConfig } from "./config/resolveNotionAuth";
export { resolveNotionAuth } from "./config/resolveNotionAuth";
export type { Simplify } from "./typeUtils";

export class NotionORMBase {
	protected readonly notionAuth: string;

	constructor(config: NotionORMConfig) {
		this.notionAuth = resolveNotionAuth(config);
		// Database and agent properties are added by the generated NotionORM class
	}
}
