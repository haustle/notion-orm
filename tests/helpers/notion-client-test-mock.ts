/**
 * Shared `@notionhq/client` test doubles for runtime and codegen tests.
 *
 * **Load order:** call `install*` *before* any dynamic `import()` of code that
 * constructs `new Client()` from `@notionhq/client` (e.g. `DatabaseClient`).
 * Do not statically import modules that value-import `@notionhq/client` above
 * these installers.
 */

import { mock, type Mock } from "bun:test";
import type {
	CreatePageParameters,
	CreatePageResponse,
	GetPageParameters,
	GetPageResponse,
	PageObjectResponse,
	PartialPageObjectResponse,
	QueryDataSourceParameters,
	QueryDataSourceResponse,
	UpdatePageParameters,
	UpdatePageResponse,
} from "@notionhq/client/build/src/api-endpoints";
import type { DatabaseClient } from "../../src/client/database/DatabaseClient";
import type { DatabaseColumns, DatabaseDefinition } from "../../src/client/database/types";
import { emptyQueryDataSourceResponse } from "./query-data-source-response";

/**
 * Constructor shape for {@link DatabaseClient} (type-only — avoids loading
 * `@notionhq/client` before `mock.module("@notionhq/client", …)` runs).
 */
export type PrismaApiDatabaseClientCtor = new (args: {
	id: string;
	columns: DatabaseColumns;
	auth: string;
	name: string;
}) => DatabaseClient<DatabaseDefinition>;

export type PrismaApiDataSourceQueryFn = (
	args: QueryDataSourceParameters,
) => Promise<QueryDataSourceResponse>;

export type PrismaApiPagesCreateFn = (
	args: CreatePageParameters,
) => Promise<CreatePageResponse>;

export type PrismaApiPagesUpdateFn = (
	args: UpdatePageParameters,
) => Promise<UpdatePageResponse>;

export type PrismaApiPagesRetrieveFn = (
	args: GetPageParameters,
) => Promise<GetPageResponse>;

/** Default prisma-api fixture database id (matches most runtime tests). */
import { MOCK_DATA_SOURCE_ID } from "./test-mock-ids";

export const PRISMA_API_TEST_DATABASE_ID = MOCK_DATA_SOURCE_ID;

/** Default auth token string for prisma-api tests. */
export const PRISMA_API_TEST_AUTH = "token";

/** Default human-readable database name for prisma-api tests. */
export const PRISMA_API_TEST_DATABASE_NAME = "Coffee Shops";

/**
 * Notion `database_id` required on `parent` when `type` is `data_source_id` on
 * page **responses** (SDK types).
 */
export const PRISMA_API_TEST_NOTION_DATABASE_ID = "notion-database-parent-1";

/** Minimal `PartialPageObjectResponse` for mocks. */
export function prismaApiStubPartialPage(id: string): PartialPageObjectResponse {
	return { object: "page", id };
}

/**
 * Minimal {@link PageObjectResponse} when tests need `pages.create` to return a full page
 * (all fields required by the Notion SDK type).
 */
export function prismaApiStubFullPage(args: {
	id: string;
	dataSourceId: string;
	properties?: PageObjectResponse["properties"];
}): PageObjectResponse {
	const { id, dataSourceId, properties } = args;
	return {
		object: "page",
		id,
		created_time: "2024-01-01T00:00:00.000Z",
		last_edited_time: "2024-01-01T00:00:00.000Z",
		in_trash: false,
		archived: false,
		is_archived: false,
		is_locked: false,
		url: `https://www.notion.so/${id.replace(/-/g, "")}`,
		public_url: null,
		parent: prismaApiDataSourceParent({ dataSourceId }),
		properties: properties ?? {},
		icon: null,
		cover: null,
		created_by: { object: "user", id: "creator-user-id" },
		last_edited_by: { object: "user", id: "editor-user-id" },
	};
}

/** `parent` for mocked `pages.retrieve` / full page responses under a data source. */
export function prismaApiDataSourceParent(args: {
	dataSourceId: string;
	databaseId?: string;
}) {
	return {
		type: "data_source_id" as const,
		data_source_id: args.dataSourceId,
		database_id: args.databaseId ?? PRISMA_API_TEST_NOTION_DATABASE_ID,
	};
}

/** Two-column schema shared by most prisma-api tests (title + number). */
export const PRISMA_API_MINIMAL_COLUMNS = {
	shopName: { columnName: "Shop Name", type: "title" },
	rating: { columnName: "Rating", type: "number" },
} as const satisfies DatabaseColumns;

/** create.test.ts schema: adds checkbox. */
export const PRISMA_API_CREATE_COLUMNS = {
	...PRISMA_API_MINIMAL_COLUMNS,
	hasWifi: { columnName: "Has WiFi", type: "checkbox" },
} as const satisfies DatabaseColumns;

/** find-many tests: rich_text notes column. */
export const PRISMA_API_FIND_MANY_COLUMNS = {
	shopName: { columnName: "Shop Name", type: "title" },
	rating: { columnName: "Rating", type: "number" },
	hasWifi: { columnName: "Has WiFi", type: "checkbox" },
	notes: { columnName: "Notes", type: "rich_text" },
} as const satisfies DatabaseColumns;

export type PrismaApiNotionClientMocks = {
	dataSourceQueryMock: Mock<PrismaApiDataSourceQueryFn>;
	pagesCreateMock: Mock<PrismaApiPagesCreateFn>;
	pagesUpdateMock: Mock<PrismaApiPagesUpdateFn>;
	pagesRetrieveMock: Mock<PrismaApiPagesRetrieveFn>;
};

export type InstallPrismaApiNotionClientMockOptions = Partial<
	Pick<
		PrismaApiNotionClientMocks,
		| "dataSourceQueryMock"
		| "pagesCreateMock"
		| "pagesUpdateMock"
		| "pagesRetrieveMock"
	>
>;

/**
 * Registers `mock.module("@notionhq/client", …)` with a fake `Client` that
 * exposes `pages.create|update|retrieve` and `dataSources.query`.
 */
export function installPrismaApiNotionClientMock(
	options: InstallPrismaApiNotionClientMockOptions = {},
): PrismaApiNotionClientMocks {
	const dataSourceQueryMock =
		options.dataSourceQueryMock ??
		mock<PrismaApiDataSourceQueryFn>(async () =>
			emptyQueryDataSourceResponse(),
		);
	const pagesCreateMock =
		options.pagesCreateMock ??
		mock<PrismaApiPagesCreateFn>(async () =>
			prismaApiStubPartialPage("created-page-id"),
		);
	const pagesUpdateMock =
		options.pagesUpdateMock ??
		mock<PrismaApiPagesUpdateFn>(async () =>
			prismaApiStubPartialPage("updated-page-id"),
		);
	const pagesRetrieveMock =
		options.pagesRetrieveMock ??
		mock<PrismaApiPagesRetrieveFn>(async () =>
			prismaApiStubPartialPage("retrieved-page-id"),
		);

	mock.module("@notionhq/client", () => ({
		Client: class NotionClientMock {
			public pages = {
				create: pagesCreateMock,
				update: pagesUpdateMock,
				retrieve: pagesRetrieveMock,
			};
			public dataSources = { query: dataSourceQueryMock };
			constructor(_args: unknown) {}
		},
	}));

	return {
		dataSourceQueryMock,
		pagesCreateMock,
		pagesUpdateMock,
		pagesRetrieveMock,
	};
}

/**
 * Builds a {@link DatabaseClient} with standard prisma-api test ids and optional
 * column map (defaults to {@link PRISMA_API_MINIMAL_COLUMNS}).
 */
export function createPrismaApiTestDatabaseClient(
	Client: PrismaApiDatabaseClientCtor,
	columns: DatabaseColumns = PRISMA_API_MINIMAL_COLUMNS,
): InstanceType<PrismaApiDatabaseClientCtor> {
	return new Client({
		id: PRISMA_API_TEST_DATABASE_ID,
		auth: PRISMA_API_TEST_AUTH,
		name: PRISMA_API_TEST_DATABASE_NAME,
		columns,
	});
}

export type CodegenRetrieveMock = Mock<
	(args: { data_source_id: string }) => Promise<unknown>
>;

/**
 * Codegen CLI tests only need `dataSources.retrieve`. Call **before** dynamically
 * importing modules that value-import `Client` from `@notionhq/client`.
 */
export function installCodegenRetrieveOnlyNotionClientMock(
	retrieveMock: CodegenRetrieveMock,
): void {
	mock.module("@notionhq/client", () => ({
		Client: class {
			public dataSources = { retrieve: retrieveMock };
			constructor(_args: unknown) {}
		},
	}));
}
