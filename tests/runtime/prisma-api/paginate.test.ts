import { beforeEach, describe, expect, mock, test } from "bun:test";
import { z } from "zod";
import { databasePropertyValue } from "../../helpers/query-transform-fixtures";

const dataSourceQueryMock = mock(async () => ({
	object: "list" as const,
	results: [] as any[],
	next_cursor: null,
	has_more: false,
	type: "page_or_data_source" as const,
	page_or_data_source: {},
}));

mock.module("@notionhq/client", () => ({
	Client: class {
		public pages = {
			create: mock(async () => ({})),
			update: mock(async () => ({})),
			retrieve: mock(async () => ({})),
		};
		public dataSources = { query: dataSourceQueryMock };
		constructor(_args: unknown) {}
	},
}));

const { DatabaseClient } = await import("../../../src/client/DatabaseClient");

type TestSchema = { shopName: string; rating: number };
type TestColumnTypes = { shopName: "title"; rating: "number" };

function createClient() {
	return new DatabaseClient<TestSchema, TestColumnTypes>({
		id: "db-1",
		auth: "token",
		name: "Coffee Shops",
		schema: z.object({
			shopName: z.string().optional(),
			rating: z.number().optional(),
		}),
		camelPropertyNameToNameAndTypeMap: {
			shopName: { columnName: "Shop Name", type: "title" },
			rating: { columnName: "Rating", type: "number" },
		},
	});
}

describe("findMany with after (pagination)", () => {
	beforeEach(() => {
		dataSourceQueryMock.mockReset();
	});

	test("after: null returns first page with data, nextCursor, hasMore", async () => {
		dataSourceQueryMock.mockResolvedValueOnce({
			object: "list",
			results: [
				{
					object: "page",
					id: "p1",
					properties: {
						"Shop Name": databasePropertyValue.title("Shop A"),
						Rating: databasePropertyValue.number(5),
					},
				},
			],
			next_cursor: "cursor-123",
			has_more: true,
			type: "page_or_data_source",
			page_or_data_source: {},
		});

		const client = createClient();
		const result = await client.findMany({ size: 1, after: null });
		expect(result.data).toHaveLength(1);
		expect(result.data[0].shopName).toBe("Shop A");
		expect(result.nextCursor).toBe("cursor-123");
		expect(result.hasMore).toBe(true);
	});

	test("after: string passes start_cursor to API", async () => {
		dataSourceQueryMock.mockResolvedValueOnce({
			object: "list",
			results: [],
			next_cursor: null,
			has_more: false,
			type: "page_or_data_source",
			page_or_data_source: {},
		});

		const client = createClient();
		await client.findMany({ after: "cursor-xyz" });
		expect(dataSourceQueryMock).toHaveBeenCalledWith(
			expect.objectContaining({ start_cursor: "cursor-xyz" }),
		);
	});

	test("without after returns plain array", async () => {
		dataSourceQueryMock.mockResolvedValueOnce({
			object: "list",
			results: [
				{
					object: "page",
					id: "p1",
					properties: {
						"Shop Name": databasePropertyValue.title("Test"),
						Rating: databasePropertyValue.number(3),
					},
				},
			],
			next_cursor: "cursor-abc",
			has_more: true,
			type: "page_or_data_source",
			page_or_data_source: {},
		});

		const client = createClient();
		const result = await client.findMany({ size: 1 });
		expect(Array.isArray(result)).toBe(true);
		expect(result[0].shopName).toBe("Test");
		expect(result).not.toHaveProperty("nextCursor");
	});

	test("paginated result applies select projection", async () => {
		dataSourceQueryMock.mockResolvedValueOnce({
			object: "list",
			results: [
				{
					object: "page",
					id: "p1",
					properties: {
						"Shop Name": databasePropertyValue.title("Test"),
						Rating: databasePropertyValue.number(5),
					},
				},
			],
			next_cursor: null,
			has_more: false,
			type: "page_or_data_source",
			page_or_data_source: {},
		});

		const client = createClient();
		const result = await client.findMany({
			after: null,
			select: { shopName: true },
		});
		expect(Object.keys(result.data[0])).toEqual(["shopName"]);
	});
});
