/**
 * Base exports for @haustle/notion-orm
 * This file contains the stable base classes that generated code extends.
 * The main index.ts is generated and re-exports from here plus adds generated types.
 */

export { AgentClient } from "./client/AgentClient";
export { DatabaseClient } from "./client/DatabaseClient";
export type {
	CountArgs,
	CreateArgs,
	CreateManyArgs,
	DatabasePropertyValue,
	DeleteArgs,
	DeleteManyArgs,
	FindFirstArgs,
	FindManyArgs,
	FindUniqueArgs,
	PaginateResult,
	Query,
	UpdateArgs,
	UpdateManyArgs,
	UpsertArgs,
} from "./client/queryTypes";
export type { NotionConfigType } from "./config/helpers";

export default class NotionORMBase {
	constructor(config: { auth: string }) {
		// Database and agent properties are added by the generated NotionORM class
	}
}
