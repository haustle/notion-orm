import NotionORMBase from "./base";

export type { NotionConfigType } from "./base";
export { AgentClient, DatabaseClient } from "./base";
export default class NotionORM extends NotionORMBase {
	public databases: Record<string, never>;
	public agents: Record<string, never>;
	constructor(config: {
		auth: string;
	});
}
