import { beforeEach, describe, expect, mock, test } from "bun:test";
import {
	createPrismaApiTestDatabaseClient,
	installPrismaApiNotionClientMock,
	prismaApiDataSourceParent,
	prismaApiStubPartialPage,
	type PrismaApiPagesRetrieveFn,
	type PrismaApiPagesUpdateFn,
} from "../../helpers/notion-client-test-mock";
import {
	emptyQueryDataSourceResponse,
	queryDataSourceListResponse,
} from "../../helpers/query-data-source-response";
import { databasePropertyValue } from "../../helpers/query-transform-fixtures";
import {
	MOCK_DATA_SOURCE_ID,
	MOCK_PAGE_ID,
} from "../../helpers/test-mock-ids";
import { isRecord } from "../../helpers/type-guards";

const { dataSourceQueryMock, pagesUpdateMock, pagesRetrieveMock } =
	installPrismaApiNotionClientMock({
		pagesUpdateMock: mock<PrismaApiPagesUpdateFn>(async () =>
			prismaApiStubPartialPage("updated-page-id"),
		),
		pagesRetrieveMock: mock<PrismaApiPagesRetrieveFn>(async () => ({
			object: "page" as const,
			id: MOCK_PAGE_ID,
			parent: prismaApiDataSourceParent({ dataSourceId: MOCK_DATA_SOURCE_ID }),
			properties: {
				"Shop Name": databasePropertyValue.title("A"),
				Rating: databasePropertyValue.number(3),
			},
		})),
	});

const { DatabaseClient } = await import("../../../src/client/database/DatabaseClient");

type TestSchema = { shopName: string; rating: number };
type TestColumnTypes = { shopName: "title"; rating: "number" };

function createClient() {
	return createPrismaApiTestDatabaseClient(DatabaseClient);
}

describe("update", () => {
	beforeEach(() => {
		pagesUpdateMock.mockReset();
		pagesUpdateMock.mockResolvedValue(prismaApiStubPartialPage("updated-page-id"));
		pagesRetrieveMock.mockReset();
		pagesRetrieveMock.mockResolvedValue({
			object: "page",
			id: MOCK_PAGE_ID,
			parent: prismaApiDataSourceParent({ dataSourceId: MOCK_DATA_SOURCE_ID }),
			properties: {
				"Shop Name": databasePropertyValue.title("A"),
				Rating: databasePropertyValue.number(3),
			},
		});
		dataSourceQueryMock.mockReset();
	});

	test("calls pages.update with page_id and property patch", async () => {
		const client = createClient();
		await client.update({
			where: { id: MOCK_PAGE_ID },
			properties: { rating: 4 },
		});
		expect(pagesUpdateMock).toHaveBeenCalledWith({
			page_id: MOCK_PAGE_ID,
			properties: { Rating: { number: 4 } },
		});
		expect(pagesRetrieveMock).toHaveBeenCalledWith({ page_id: MOCK_PAGE_ID });
	});

	test("sends only changed fields", async () => {
		const client = createClient();
		await client.update({
			where: { id: MOCK_PAGE_ID },
			properties: { shopName: "New Name" },
		});
		expect(pagesUpdateMock).toHaveBeenCalled();
		const firstCall = pagesUpdateMock.mock.calls[0];
		expect(firstCall).toBeDefined();
		const firstArg = firstCall?.[0];
		expect(isRecord(firstArg)).toBe(true);
		if (isRecord(firstArg)) {
			expect(firstArg.properties).toEqual({
				"Shop Name": { title: [{ text: { content: "New Name" } }] },
			});
			expect(firstArg.properties).not.toHaveProperty("Rating");
		}
	});

	test("throws when id is missing", async () => {
		const client = createClient();
		await expect(
			client.update({ where: { id: "" }, properties: { rating: 1 } }),
		).rejects.toThrow(
			"[@haustle/notion-orm] update(): where.id must be a non-empty string (Notion page id).",
		);
	});

	test("throws when properties is empty", async () => {
		const client = createClient();
		await expect(
			client.update({ where: { id: MOCK_PAGE_ID }, properties: {} }),
		).rejects.toThrow(
			"[@haustle/notion-orm] update(): pass at least one key in properties.",
		);
	});

	test("propagates API errors", async () => {
		pagesUpdateMock.mockRejectedValueOnce(new Error("Forbidden"));
		const client = createClient();
		await expect(
			client.update({ where: { id: MOCK_PAGE_ID }, properties: { rating: 1 } }),
		).rejects.toThrow("Forbidden");
	});

	test("throws when the page belongs to another data source", async () => {
		pagesRetrieveMock.mockResolvedValueOnce({
			object: "page",
			id: MOCK_PAGE_ID,
			parent: prismaApiDataSourceParent({ dataSourceId: "other-db" }),
			properties: {
				"Shop Name": databasePropertyValue.title("A"),
				Rating: databasePropertyValue.number(3),
			},
		});
		const client = createClient();
		await expect(
			client.update({ where: { id: MOCK_PAGE_ID }, properties: { rating: 1 } }),
		).rejects.toThrow(
			`[@haustle/notion-orm] update(): page ${MOCK_PAGE_ID} does not belong to database Coffee Shops.`,
		);
		expect(pagesUpdateMock).not.toHaveBeenCalled();
	});
});

describe("updateMany", () => {
	beforeEach(() => {
		pagesUpdateMock.mockReset();
		pagesUpdateMock.mockResolvedValue(prismaApiStubPartialPage("updated"));
		dataSourceQueryMock.mockReset();
	});

	test("queries matching pages then updates each", async () => {
		dataSourceQueryMock.mockResolvedValueOnce(
			queryDataSourceListResponse([
				{
					object: "page",
					id: "p1",
					properties: {
						"Shop Name": databasePropertyValue.title("A"),
						Rating: databasePropertyValue.number(3),
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
		await client.updateMany({
			where: { rating: { less_than: 4 } },
			properties: { rating: 5 },
		});

		expect(pagesUpdateMock).toHaveBeenCalledTimes(2);
		expect(pagesUpdateMock).toHaveBeenCalledWith(
			expect.objectContaining({ page_id: "p1" }),
		);
		expect(pagesUpdateMock).toHaveBeenCalledWith(
			expect.objectContaining({ page_id: "p2" }),
		);
	});

	test("skips partial query rows when collecting ids for bulk updates", async () => {
		dataSourceQueryMock.mockResolvedValueOnce(
			queryDataSourceListResponse([
				{ object: "page", id: "partial-page" },
				{
					object: "page",
					id: "p1",
					properties: {
						"Shop Name": databasePropertyValue.title("A"),
						Rating: databasePropertyValue.number(3),
					},
				},
			]),
		);

		const client = createClient();
		await client.updateMany({
			where: { rating: { less_than: 4 } },
			properties: { rating: 5 },
		});

		expect(pagesUpdateMock).toHaveBeenCalledTimes(1);
		expect(pagesUpdateMock).toHaveBeenCalledWith(
			expect.objectContaining({ page_id: "p1" }),
		);
	});
});
