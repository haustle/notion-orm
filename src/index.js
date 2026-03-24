import { NotionORMBase } from "./base";

export { AgentClient, DatabaseClient, NotionORMBase } from "./base";

class NotionORM extends NotionORMBase {
	constructor(config) {
		super(config);
		this.databases = {};
		this.agents = {};
	}
}
export default NotionORM;
