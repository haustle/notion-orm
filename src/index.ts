import { NotionORMBase } from "./base";

export type {
	BrandedNotionId,
	DatabaseColumns,
	DatabaseColumnTypes,
	CreateSchema,
	DatabaseCreatePageResult,
	DatabaseDefinition,
	DatabasePropertyType,
	DatabaseSchema,
	InferDatabaseColumns,
	InferCreateSchema,
	InferDatabaseSchema,
	NotWritableDatabaseColumnType,
	NotionConfigType,
	NotionDatabaseId,
	NotionIdKind,
	NotionORMConfig,
	NotionPageId,
	NotionUserId,
	Query,
} from "./base";
export {
	AgentClient,
	brandedNotionIdsAsStringArray,
	buildZodFromColumns,
	DatabaseClient,
	DATABASE_CREATE_PAGE_RESULT_PAGE_KEYS,
	NOTION_BASE_URL_ENV,
	NOTION_LEGACY_REST_BASE_URL_ENV,
	NotionORMBase,
	resolveNotionApiBaseUrl,
	resolveNotionAuth,
	toNotionDatabaseId,
	toNotionPageId,
	toNotionUserId,
} from "./base";
export type { ObjectEntry, Simplify } from "./typeUtils";
export { objectEntries, objectKeys } from "./typeUtils";
export { randomUuidV4 } from "./helpers";
export {
	DASHED_NOTION_ID_PATTERN,
	UNDASHED_NOTION_ID_PATTERN,
} from "./notion-id-patterns";

class NotionORM extends NotionORMBase {
	public databases: Record<string, never>;
	public agents: Record<string, never>;
	constructor(config: {
		auth?: string;
	}) {
		super(config);
		this.databases = {};
		this.agents = {};
	}
}
export default NotionORM;
