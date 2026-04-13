// @ts-nocheck — mock module template served to the website playground editor
export type {
	ColumnDefinition,
	Count,
	Create,
	CreateMany,
	DatabaseColumns,
	DatabaseColumnTypes,
	DatabaseDefinition,
	DatabasePropertyValue,
	DatabaseSchema,
	Delete,
	DeleteMany,
	FindFirst,
	FindMany,
	FindUnique,
	InferDatabaseSchema,
	NotionConfigType,
	PaginateResult,
	Projection,
	Query,
	ResultProjection,
	Update,
	UpdateMany,
	Upsert,
} from "../../index.ts";
export { AgentClient, DatabaseClient } from "../../index.ts";

export class NotionORMBase {
	protected readonly notionAuth: string;

	constructor(_config: { auth?: string }) {
		this.notionAuth = "";
	}
}
