import { beforeEach, describe, expect, test } from "bun:test";
import { objectKeys } from "../../../src/typeUtils";
import {
	createPrismaApiTestDatabaseClient,
	installPrismaApiNotionClientMock,
} from "../../helpers/notion-client-test-mock";
import {
	emptyQueryDataSourceResponse,
	queryDataSourceListResponse,
} from "../../helpers/query-data-source-response";
import {
	databasePropertyValue,
	page,
} from "../../helpers/query-transform-fixtures";

const { dataSourceQueryMock } = installPrismaApiNotionClientMock();

const { DatabaseClient } = await import("../../../src/client/database/DatabaseClient");

function createClient() {
	return createPrismaApiTestDatabaseClient(DatabaseClient);
}

describe("findMany with after (pagination)", () => {
	beforeEach(() => {
		dataSourceQueryMock.mockReset();
	});

	test("after: null returns first page with data, nextCursor, hasMore", async () => {
		dataSourceQueryMock.mockResolvedValueOnce(
			queryDataSourceListResponse(
				[
					page(
						{
							"Shop Name": databasePropertyValue.title("Shop A"),
							Rating: databasePropertyValue.number(5),
						},
						"p1",
					),
				],
				{ next_cursor: "cursor-123", has_more: true },
			),
		);

		const client = createClient();
		const result = await client.findMany({ size: 1, after: null });
		expect(result.data).toHaveLength(1);
		expect(result.data[0]).toMatchObject({ shopName: "Shop A" });
		expect(result.nextCursor).toBe("cursor-123");
		expect(result.hasMore).toBe(true);
	});

	test("after: string passes start_cursor to API", async () => {
		dataSourceQueryMock.mockResolvedValueOnce(emptyQueryDataSourceResponse());

		const client = createClient();
		await client.findMany({ after: "cursor-xyz" });
		expect(dataSourceQueryMock).toHaveBeenCalledWith(
			expect.objectContaining({ start_cursor: "cursor-xyz" }),
		);
	});

	test("without after returns plain array", async () => {
		dataSourceQueryMock.mockResolvedValueOnce(
			queryDataSourceListResponse(
				[
					page(
						{
							"Shop Name": databasePropertyValue.title("Test"),
							Rating: databasePropertyValue.number(3),
						},
						"p1",
					),
				],
				{ next_cursor: "cursor-abc", has_more: true },
			),
		);

		const client = createClient();
		const result = await client.findMany({ size: 1 });
		expect(Array.isArray(result)).toBe(true);
		expect(result[0]).toMatchObject({ shopName: "Test" });
		expect(result).not.toHaveProperty("nextCursor");
	});

	test("paginated result applies select projection", async () => {
		dataSourceQueryMock.mockResolvedValueOnce(
			queryDataSourceListResponse([
				page(
					{
						"Shop Name": databasePropertyValue.title("Test"),
						Rating: databasePropertyValue.number(5),
					},
					"p1",
				),
			]),
		);

		const client = createClient();
		const result = await client.findMany({
			after: null,
			select: ["shopName"] as const,
		});
		expect(objectKeys(result.data[0])).toEqual(["shopName"]);
	});
});
