// @ts-nocheck — mock module template served to the website playground editor
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
	NotionConfigType,
	PaginateResult,
	UpdateArgs,
	UpdateManyArgs,
	UpsertArgs,
} from "../../index.ts";
export { AgentClient, DatabaseClient } from "../../index.ts";

export class NotionORMBase {
	constructor(_config: { auth: string }) {}
}
