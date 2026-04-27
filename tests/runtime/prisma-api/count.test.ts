import { beforeEach, describe, expect, test } from "bun:test";
import {
	createPrismaApiTestDatabaseClient,
	installPrismaApiNotionClientMock,
} from "../../helpers/notion-client-test-mock";
import {
	emptyQueryDataSourceResponse,
	queryDataSourceListResponse,
	stubQueryPageResult,
} from "../../helpers/query-data-source-response";
import { databasePropertyValue } from "../../helpers/query-transform-fixtures";

const { dataSourceQueryMock } = installPrismaApiNotionClientMock();

const { DatabaseClient } = await import("../../../src/client/database/DatabaseClient");

function createClient() {
	return createPrismaApiTestDatabaseClient(DatabaseClient);
}

describe("count", () => {
	beforeEach(() => {
		dataSourceQueryMock.mockReset();
	});

	test("counts all rows across pages", async () => {
		dataSourceQueryMock
			.mockResolvedValueOnce(
				queryDataSourceListResponse(
					Array.from({ length: 100 }, (_, index) => ({
						object: "page" as const,
						id: `p-${index}`,
						properties: {
							"Shop Name": databasePropertyValue.title(`Shop ${index}`),
							Rating: databasePropertyValue.number(index),
						},
					})),
					{ next_cursor: "c1", has_more: true },
				),
			)
			.mockResolvedValueOnce(
				queryDataSourceListResponse(
					Array.from({ length: 42 }, (_, index) => ({
						object: "page" as const,
						id: `q-${index}`,
						properties: {
							"Shop Name": databasePropertyValue.title(`Cafe ${index}`),
							Rating: databasePropertyValue.number(index),
						},
					})),
					{ next_cursor: null, has_more: false },
				),
			);

		const client = createClient();
		const total = await client.count();
		expect(total).toBe(142);
		expect(dataSourceQueryMock).toHaveBeenCalledTimes(2);
	});

	test("counts with filter", async () => {
		dataSourceQueryMock.mockResolvedValueOnce(
			queryDataSourceListResponse([
				{
					object: "page",
					id: "p1",
					properties: {
						"Shop Name": databasePropertyValue.title("A"),
						Rating: databasePropertyValue.number(5),
					},
				},
			]),
		);

		const client = createClient();
		const total = await client.count({
			where: { rating: { greater_than: 4 } },
		});
		expect(total).toBe(1);
		expect(dataSourceQueryMock).toHaveBeenCalledWith(
			expect.objectContaining({
				filter: { property: "Rating", number: { greater_than: 4 } },
			}),
		);
	});

	test("skips partial query results so count matches normalized row semantics", async () => {
		dataSourceQueryMock.mockResolvedValueOnce(
			queryDataSourceListResponse([
				stubQueryPageResult("partial"),
				{
					object: "page",
					id: "full",
					properties: {
						"Shop Name": databasePropertyValue.title("A"),
						Rating: databasePropertyValue.number(5),
					},
				},
			]),
		);

		const client = createClient();
		const total = await client.count();
		expect(total).toBe(1);
	});

	test("returns zero when no results", async () => {
		dataSourceQueryMock.mockResolvedValueOnce(emptyQueryDataSourceResponse());

		const client = createClient();
		const total = await client.count();
		expect(total).toBe(0);
	});

	test("propagates API errors", async () => {
		dataSourceQueryMock.mockRejectedValueOnce(new Error("Rate limited"));
		const client = createClient();
		await expect(client.count()).rejects.toThrow("Rate limited");
	});
});
