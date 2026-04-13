import { NotionORMBase } from "./base";

export {
	AgentClient,
	DatabaseClient,
	NotionORMBase,
	resolveNotionAuth,
} from "./base";
export { objectEntries, objectKeys } from "./typeUtils";

class NotionORM extends NotionORMBase {
	constructor(config) {
		super(config);
		this.databases = {};
		this.agents = {};
	}
}
export default NotionORM;
