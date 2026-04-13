import { beforeEach, describe, expect, mock, test } from "bun:test";
import {
	createPrismaApiTestDatabaseClient,
	installPrismaApiNotionClientMock,
	prismaApiDataSourceParent,
	prismaApiStubPartialPage,
} from "../../helpers/notion-client-test-mock";
import { queryDataSourceListResponse } from "../../helpers/query-data-source-response";
import { databasePropertyValue } from "../../helpers/query-transform-fixtures";

const { dataSourceQueryMock, pagesUpdateMock, pagesRetrieveMock } =
	installPrismaApiNotionClientMock({
		pagesUpdateMock: mock(async () => prismaApiStubPartialPage("archived")),
		pagesRetrieveMock: mock(async () => ({
			object: "page" as const,
			id: "page-1",
			parent: prismaApiDataSourceParent({ dataSourceId: "db-1" }),
			properties: {
				"Shop Name": databasePropertyValue.title("A"),
				Rating: databasePropertyValue.number(1),
			},
		})),
	});

const { DatabaseClient } = await import("../../../src/client/database/DatabaseClient");

type TestSchema = { shopName: string; rating: number };
type TestColumnTypes = { shopName: "title"; rating: "number" };

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
			id: "page-1",
			parent: prismaApiDataSourceParent({ dataSourceId: "db-1" }),
			properties: {
				"Shop Name": databasePropertyValue.title("A"),
				Rating: databasePropertyValue.number(1),
			},
		});
		dataSourceQueryMock.mockReset();
	});

	test("calls pages.update with in_trash: true", async () => {
		const client = createClient();
		await client.delete({ where: { id: "page-1" } });
		expect(pagesUpdateMock).toHaveBeenCalledWith({
			page_id: "page-1",
			in_trash: true,
		});
		expect(pagesRetrieveMock).toHaveBeenCalledWith({ page_id: "page-1" });
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
			client.delete({ where: { id: "page-1" } }),
		).rejects.toThrow("Not Found");
	});

	test("throws when the page belongs to another data source", async () => {
		pagesRetrieveMock.mockResolvedValueOnce({
			object: "page",
			id: "page-1",
			parent: prismaApiDataSourceParent({ dataSourceId: "other-db" }),
			properties: {
				"Shop Name": databasePropertyValue.title("A"),
				Rating: databasePropertyValue.number(1),
			},
		});
		const client = createClient();
		await expect(client.delete({ where: { id: "page-1" } })).rejects.toThrow(
			"[@haustle/notion-orm] delete(): page page-1 does not belong to database Coffee Shops.",
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
