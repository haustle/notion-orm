import NotionORMBase, {
	AgentClient,
	DatabaseClient,
} from "@haustle/notion-orm/build/src/base";
import type { mealAgent } from "../agents/mealAgent";
import type { taskDb } from "../db/taskDb";

export type { NotionConfigType } from "@haustle/notion-orm/build/src/base";
export {
	AgentClient,
	DatabaseClient,
} from "@haustle/notion-orm/build/src/base";
export default class NotionORM extends NotionORMBase {
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
