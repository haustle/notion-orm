import { beforeEach, describe, expect, test } from "bun:test";
import {
	createPrismaApiTestDatabaseClient,
	installPrismaApiNotionClientMock,
} from "../../helpers/notion-client-test-mock";
import {
	emptyQueryDataSourceResponse,
	queryDataSourceListResponse,
} from "../../helpers/query-data-source-response";
import { databasePropertyValue } from "../../helpers/query-transform-fixtures";

const { dataSourceQueryMock } = installPrismaApiNotionClientMock();

const { DatabaseClient } = await import("../../../src/client/database/DatabaseClient");

function createClient() {
	return createPrismaApiTestDatabaseClient(DatabaseClient);
}

describe("findFirst", () => {
	beforeEach(() => {
		dataSourceQueryMock.mockReset();
	});

	test("returns first result", async () => {
		dataSourceQueryMock.mockResolvedValueOnce(
			queryDataSourceListResponse([
				{
					object: "page",
					id: "p1",
					properties: {
						"Shop Name": databasePropertyValue.title("Blue Bottle"),
						Rating: databasePropertyValue.number(5),
					},
				},
			]),
		);

		const client = createClient();
		const result = await client.findFirst();
		expect(result).toEqual({ shopName: "Blue Bottle", rating: 5 });
	});

	test("returns null when no results", async () => {
		dataSourceQueryMock.mockResolvedValueOnce(emptyQueryDataSourceResponse());

		const client = createClient();
		const result = await client.findFirst();
		expect(result).toBeNull();
	});

	test("sets page_size to 1", async () => {
		dataSourceQueryMock.mockResolvedValueOnce(emptyQueryDataSourceResponse());

		const client = createClient();
		await client.findFirst({ where: { shopName: { equals: "Test" } } });
		expect(dataSourceQueryMock).toHaveBeenCalledWith(
			expect.objectContaining({ page_size: 1 }),
		);
	});

	test("applies select projection", async () => {
		dataSourceQueryMock.mockResolvedValueOnce(
			queryDataSourceListResponse([
				{
					object: "page",
					id: "p1",
					properties: {
						"Shop Name": databasePropertyValue.title("Test"),
						Rating: databasePropertyValue.number(5),
					},
				},
			]),
		);

		const client = createClient();
		const result = await client.findFirst({ select: ["shopName"] as const });
		expect(result).toEqual({ shopName: "Test" });
		expect(result).not.toHaveProperty("rating");
	});

	test("empty select returns all fields like no projection", async () => {
		dataSourceQueryMock.mockResolvedValueOnce(
			queryDataSourceListResponse([
				{
					object: "page",
					id: "p1",
					properties: {
						"Shop Name": databasePropertyValue.title("Blue Bottle"),
						Rating: databasePropertyValue.number(5),
					},
				},
			]),
		);

		const client = createClient();
		const result = await client.findFirst({ select: [] });
		expect(result).toEqual({ shopName: "Blue Bottle", rating: 5 });
	});
});
