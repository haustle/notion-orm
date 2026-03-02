export type { AgentIcon, ThreadInfo } from "./client/AgentClient";
export { AgentClient } from "./client/AgentClient";
export { DatabaseClient } from "./client/DatabaseClient";
export type { Query } from "./client/queryTypes";
export type { NotionConfigType } from "./config/helpers";

export default class NotionORM {
	constructor(config: { auth: string }) {
		// Database and agent properties are added dynamically in build/src/index.js
	}
}
