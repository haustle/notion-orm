import { beforeEach, describe, expect, mock, test } from "bun:test";
import {
	createPrismaApiTestDatabaseClient,
	installPrismaApiNotionClientMock,
	prismaApiDataSourceParent,
	prismaApiStubPartialPage,
} from "../../helpers/notion-client-test-mock";
import { queryDataSourceListResponse } from "../../helpers/query-data-source-response";
import { databasePropertyValue } from "../../helpers/query-transform-fixtures";
import {
	MOCK_DATA_SOURCE_ID,
	MOCK_PAGE_ID,
} from "../../helpers/test-mock-ids";

const { dataSourceQueryMock, pagesUpdateMock, pagesRetrieveMock } =
	installPrismaApiNotionClientMock({
		pagesUpdateMock: mock(async () => prismaApiStubPartialPage("archived")),
		pagesRetrieveMock: mock(async () => ({
			object: "page" as const,
			id: MOCK_PAGE_ID,
			parent: prismaApiDataSourceParent({ dataSourceId: MOCK_DATA_SOURCE_ID }),
			properties: {
				"Shop Name": databasePropertyValue.title("A"),
				Rating: databasePropertyValue.number(1),
			},
		})),
	});

const { DatabaseClient } = await import("../../../src/client/database/DatabaseClient");

function createClient() {
	return createPrismaApiTestDatabaseClient(DatabaseClient);
}

describe("delete", () => {
	beforeEach(() => {
		pagesUpdateMock.mockReset();
		pagesUpdateMock.mockResolvedValue(prismaApiStubPartialPage("archived"));
		pagesRetrieveMock.mockReset();
		pagesRetrieveMock.mockResolvedValue({
			object: "page",
			id: MOCK_PAGE_ID,
			parent: prismaApiDataSourceParent({ dataSourceId: MOCK_DATA_SOURCE_ID }),
			properties: {
				"Shop Name": databasePropertyValue.title("A"),
				Rating: databasePropertyValue.number(1),
			},
		});
		dataSourceQueryMock.mockReset();
	});

	test("calls pages.update with in_trash: true", async () => {
		const client = createClient();
		await client.delete({ where: { id: MOCK_PAGE_ID } });
		expect(pagesUpdateMock).toHaveBeenCalledWith({
			page_id: MOCK_PAGE_ID,
			in_trash: true,
		});
		expect(pagesRetrieveMock).toHaveBeenCalledWith({ page_id: MOCK_PAGE_ID });
	});

	test("throws when id is missing", async () => {
		const client = createClient();
		await expect(client.delete({ where: { id: "" } })).rejects.toThrow(
			"[@haustle/notion-orm] delete(): where.id must be a non-empty string (Notion page id).",
		);
	});

	test("propagates API errors", async () => {
		pagesUpdateMock.mockRejectedValueOnce(new Error("Not Found"));
		const client = createClient();
		await expect(
			client.delete({ where: { id: MOCK_PAGE_ID } }),
		).rejects.toThrow("Not Found");
	});

	test("throws when the page belongs to another data source", async () => {
		pagesRetrieveMock.mockResolvedValueOnce({
			object: "page",
			id: MOCK_PAGE_ID,
			parent: prismaApiDataSourceParent({ dataSourceId: "other-db" }),
			properties: {
				"Shop Name": databasePropertyValue.title("A"),
				Rating: databasePropertyValue.number(1),
			},
		});
		const client = createClient();
		await expect(client.delete({ where: { id: MOCK_PAGE_ID } })).rejects.toThrow(
			`[@haustle/notion-orm] delete(): page ${MOCK_PAGE_ID} does not belong to database Coffee Shops.`,
		);
		expect(pagesUpdateMock).not.toHaveBeenCalled();
	});
});

describe("deleteMany", () => {
	beforeEach(() => {
		pagesUpdateMock.mockReset();
		pagesUpdateMock.mockResolvedValue(prismaApiStubPartialPage("archived"));
		dataSourceQueryMock.mockReset();
	});

	test("queries matching pages then archives each", async () => {
		dataSourceQueryMock.mockResolvedValueOnce(
			queryDataSourceListResponse([
				{
					object: "page",
					id: "p1",
					properties: {
						"Shop Name": databasePropertyValue.title("A"),
						Rating: databasePropertyValue.number(1),
					},
				},
				{
					object: "page",
					id: "p2",
					properties: {
						"Shop Name": databasePropertyValue.title("B"),
						Rating: databasePropertyValue.number(2),
					},
				},
			]),
		);

		const client = createClient();
		await client.deleteMany({
			where: { rating: { less_than: 3 } },
		});

		expect(pagesUpdateMock).toHaveBeenCalledTimes(2);
		expect(pagesUpdateMock).toHaveBeenCalledWith({
			page_id: "p1",
			in_trash: true,
		});
		expect(pagesUpdateMock).toHaveBeenCalledWith({
			page_id: "p2",
			in_trash: true,
		});
	});
});
