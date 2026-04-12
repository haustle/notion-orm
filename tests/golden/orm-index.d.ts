import type { taskDb } from "./databases/taskDb";
import type { mealAgent } from "./agents/mealAgent";
import {
	NotionORMBase,
	AgentClient,
	DatabaseClient,
} from "@haustle/notion-orm/build/src/base";

export type { NotionConfigType } from "@haustle/notion-orm/build/src/base";
export {
	AgentClient,
	DatabaseClient,
} from "@haustle/notion-orm/build/src/base";

export class NotionORM extends NotionORMBase {
	public databases: {
		taskDb: ReturnType<typeof taskDb>;
	};
	public agents: {
		mealAgent: ReturnType<typeof mealAgent>;
	};
	constructor(config: {
		auth: string;
	});
}
