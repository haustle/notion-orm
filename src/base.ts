/**
 * Base exports for @haustle/notion-orm
 * This file contains the stable base classes that generated code extends.
 * The main index.ts is generated and re-exports from here plus adds generated types.
 */

import type { NotionORMConfig } from "./config/resolveNotionAuth";
import { resolveNotionAuth } from "./config/resolveNotionAuth";

export { AgentClient } from "./client/agent/AgentClient";
export { DatabaseClient } from "./client/database/DatabaseClient";
export type {
	ColumnTypeMap,
	Count,
	Create,
	CreateMany,
	DatabasePropertyType,
	DatabasePropertyValue,
	Delete,
	DeleteMany,
	FindFirst,
	FindMany,
	FindUnique,
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

export class NotionORMBase {
	protected readonly notionAuth: string;

	constructor(config: NotionORMConfig) {
		this.notionAuth = resolveNotionAuth(config);
		// Database and agent properties are added by the generated NotionORM class
	}
}
