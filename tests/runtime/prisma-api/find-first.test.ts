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

describe("findFirst", () => {
	beforeEach(() => {
		dataSourceQueryMock.mockReset();
	});

	test("returns first result", async () => {
		dataSourceQueryMock.mockResolvedValueOnce({
			object: "list",
			results: [
				{
					object: "page",
					id: "p1",
					properties: {
						"Shop Name": databasePropertyValue.title("Blue Bottle"),
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
		const result = await client.findFirst();
		expect(result).toEqual({ shopName: "Blue Bottle", rating: 5 });
	});

	test("returns null when no results", async () => {
		dataSourceQueryMock.mockResolvedValueOnce({
			object: "list",
			results: [],
			next_cursor: null,
			has_more: false,
			type: "page_or_data_source",
			page_or_data_source: {},
		});

		const client = createClient();
		const result = await client.findFirst();
		expect(result).toBeNull();
	});

	test("sets page_size to 1", async () => {
		dataSourceQueryMock.mockResolvedValueOnce({
			object: "list",
			results: [],
			next_cursor: null,
			has_more: false,
			type: "page_or_data_source",
			page_or_data_source: {},
		});

		const client = createClient();
		await client.findFirst({ where: { shopName: { equals: "Test" } } });
		expect(dataSourceQueryMock).toHaveBeenCalledWith(
			expect.objectContaining({ page_size: 1 }),
		);
	});

	test("applies select projection", async () => {
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
		const result = await client.findFirst({ select: { shopName: true } });
		expect(result).toEqual({ shopName: "Test" });
		expect(result).not.toHaveProperty("rating");
	});
});
