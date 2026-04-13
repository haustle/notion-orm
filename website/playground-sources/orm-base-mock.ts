// @ts-nocheck — mock module template served to the website playground editor
export type {
	Count,
	Create,
	CreateMany,
	DatabasePropertyValue,
	Delete,
	DeleteMany,
	FindFirst,
	FindMany,
	FindUnique,
	NotionConfigType,
	PaginateResult,
	Projection,
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
