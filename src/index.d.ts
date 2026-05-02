import { NotionORMBase } from "./base";

export type { NotionConfigType, NotionORMConfig } from "./base";
export {
	AgentClient,
	DatabaseClient,
	NOTION_BASE_URL_ENV,
	NOTION_LEGACY_REST_BASE_URL_ENV,
	NotionORMBase,
	resolveNotionApiBaseUrl,
	resolveNotionAuth,
} from "./base";
export default class NotionORM extends NotionORMBase {
	public databases: Record<string, never>;
	public agents: Record<string, never>;
	constructor(config: {
		auth?: string;
	});
}
