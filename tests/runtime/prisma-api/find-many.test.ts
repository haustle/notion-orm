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

const pagesCreateMock = mock(async () => ({ id: "created-page-id" }));
const pagesUpdateMock = mock(async () => ({ id: "updated-page-id" }));
const pagesRetrieveMock = mock(async () => ({}));

mock.module("@notionhq/client", () => ({
	Client: class {
		public pages = {
			create: pagesCreateMock,
			update: pagesUpdateMock,
			retrieve: pagesRetrieveMock,
		};
		public dataSources = { query: dataSourceQueryMock };
		constructor(_args: unknown) {}
	},
}));

const { DatabaseClient } = await import("../../../src/client/DatabaseClient");

type TestSchema = {
	shopName: string;
	rating: number;
	hasWifi: boolean;
	notes: string;
};

type TestColumnTypes = {
	shopName: "title";
	rating: "number";
	hasWifi: "checkbox";
	notes: "rich_text";
};

function createClient() {
	return new DatabaseClient<TestSchema, TestColumnTypes>({
		id: "db-1",
		auth: "token",
		name: "Coffee Shops",
		schema: z.object({
			shopName: z.string().optional(),
			rating: z.number().optional(),
			hasWifi: z.boolean().optional(),
			notes: z.string().optional(),
		}),
		camelPropertyNameToNameAndTypeMap: {
			shopName: { columnName: "Shop Name", type: "title" },
			rating: { columnName: "Rating", type: "number" },
			hasWifi: { columnName: "Has WiFi", type: "checkbox" },
			notes: { columnName: "Notes", type: "rich_text" },
		},
	});
}

function mockQueryResponse(
	pages: any[],
	hasMore = false,
	nextCursor: string | null = null,
) {
	return {
		object: "list" as const,
		results: pages,
		next_cursor: nextCursor,
		has_more: hasMore,
		type: "page_or_data_source" as const,
		page_or_data_source: {},
	};
}

function makePage(properties: Record<string, any>, id = "page-1") {
	return {
		object: "page" as const,
		id,
		properties,
	};
}

describe("findMany", () => {
	beforeEach(() => {
		dataSourceQueryMock.mockReset();
		pagesCreateMock.mockReset();
		pagesUpdateMock.mockReset();
		pagesRetrieveMock.mockReset();
	});

	test("returns all results with no args", async () => {
		dataSourceQueryMock.mockResolvedValueOnce(
			mockQueryResponse([
				makePage({
					"Shop Name": databasePropertyValue.title("Blue Bottle"),
					Rating: databasePropertyValue.number(5),
					"Has WiFi": databasePropertyValue.checkbox(true),
					Notes: databasePropertyValue.richText("Great coffee"),
				}),
			]),
		);
		const client = createClient();
		const results = await client.findMany();
		expect(results).toHaveLength(1);
		expect(results[0]).toEqual({
			shopName: "Blue Bottle",
			rating: 5,
			hasWifi: true,
			notes: "Great coffee",
		});
	});

	test("passes where filter to dataSources.query", async () => {
		dataSourceQueryMock.mockResolvedValueOnce(mockQueryResponse([]));
		const client = createClient();
		await client.findMany({
			where: { rating: { greater_than: 3 } },
		});
		expect(dataSourceQueryMock).toHaveBeenCalledWith(
			expect.objectContaining({
				data_source_id: "db-1",
				filter: {
					property: "Rating",
					number: { greater_than: 3 },
				},
			}),
		);
	});

	test("passes sortBy as sorts", async () => {
		dataSourceQueryMock.mockResolvedValueOnce(mockQueryResponse([]));
		const client = createClient();
		const sorts = [{ property: "Rating", direction: "descending" as const }];
		await client.findMany({ sortBy: sorts });
		expect(dataSourceQueryMock).toHaveBeenCalledWith(
			expect.objectContaining({ sorts }),
		);
	});

	test("passes size as page_size", async () => {
		dataSourceQueryMock.mockResolvedValueOnce(mockQueryResponse([]));
		const client = createClient();
		await client.findMany({ size: 5 });
		expect(dataSourceQueryMock).toHaveBeenCalledWith(
			expect.objectContaining({ page_size: 5 }),
		);
	});

	test("select returns only selected fields", async () => {
		dataSourceQueryMock.mockResolvedValueOnce(
			mockQueryResponse([
				makePage({
					"Shop Name": databasePropertyValue.title("Blue Bottle"),
					Rating: databasePropertyValue.number(5),
					"Has WiFi": databasePropertyValue.checkbox(true),
					Notes: databasePropertyValue.richText("Great"),
				}),
			]),
		);
		const client = createClient();
		const results = await client.findMany({
			select: { shopName: true, rating: true },
		});
		expect(Object.keys(results[0])).toEqual(["shopName", "rating"]);
		expect(results[0].shopName).toBe("Blue Bottle");
		expect(results[0].rating).toBe(5);
	});

	test("omit strips omitted fields", async () => {
		dataSourceQueryMock.mockResolvedValueOnce(
			mockQueryResponse([
				makePage({
					"Shop Name": databasePropertyValue.title("Blue Bottle"),
					Rating: databasePropertyValue.number(5),
					"Has WiFi": databasePropertyValue.checkbox(true),
					Notes: databasePropertyValue.richText("Great"),
				}),
			]),
		);
		const client = createClient();
		const results = await client.findMany({ omit: { notes: true } });
		expect(results[0]).not.toHaveProperty("notes");
		expect(results[0]).toHaveProperty("shopName");
		expect(results[0]).toHaveProperty("rating");
	});

	test("throws when both select and omit are provided", () => {
		const client = createClient();
		expect(() =>
			client.findMany({
				select: { shopName: true },
				omit: { notes: true },
			} as any),
		).toThrow("Cannot use both 'select' and 'omit'");
	});

	test("stream returns AsyncIterable that paginates", async () => {
		dataSourceQueryMock
			.mockResolvedValueOnce(
				mockQueryResponse(
					[
						makePage({
							"Shop Name": databasePropertyValue.title("Shop A"),
							Rating: databasePropertyValue.number(4),
							"Has WiFi": databasePropertyValue.checkbox(true),
							Notes: databasePropertyValue.richText("A"),
						}),
					],
					true,
					"cursor-1",
				),
			)
			.mockResolvedValueOnce(
				mockQueryResponse([
					makePage({
						"Shop Name": databasePropertyValue.title("Shop B"),
						Rating: databasePropertyValue.number(3),
						"Has WiFi": databasePropertyValue.checkbox(false),
						Notes: databasePropertyValue.richText("B"),
					}),
				]),
			);

		const client = createClient();
		const items: any[] = [];
		for await (const item of client.findMany({ stream: 1 })) {
			items.push(item);
		}
		expect(items).toHaveLength(2);
		expect(items[0].shopName).toBe("Shop A");
		expect(items[1].shopName).toBe("Shop B");
		expect(dataSourceQueryMock).toHaveBeenCalledTimes(2);
	});
});
