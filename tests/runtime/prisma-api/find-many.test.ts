import { beforeEach, describe, expect, mock, test } from "bun:test";
import { z } from "zod";
import type { NotionPropertyValue } from "../../../src/client/database/query/types";
import { objectKeys } from "../../../src/typeUtils";
import {
	emptyQueryDataSourceResponse,
	type QueryDataSourceResultRow,
	queryDataSourceListResponse,
} from "../../helpers/query-data-source-response";
import {
	databasePropertyValue,
	page,
} from "../../helpers/query-transform-fixtures";

const dataSourceQueryMock = mock(async () => emptyQueryDataSourceResponse());

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

const { DatabaseClient } = await import("../../../src/client/database/DatabaseClient");

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
	pages: QueryDataSourceResultRow[],
	hasMore = false,
	nextCursor: string | null = null,
) {
	return queryDataSourceListResponse(pages, {
		has_more: hasMore,
		next_cursor: nextCursor,
	});
}

function makePage(
	properties: Record<string, NotionPropertyValue>,
	id = "page-1",
): QueryDataSourceResultRow {
	return page(properties, id);
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

	test("empty select returns all fields like no projection", async () => {
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
		const results = await client.findMany({ select: [] });
		expect(results).toHaveLength(1);
		expect(results[0]).toEqual({
			shopName: "Blue Bottle",
			rating: 5,
			hasWifi: true,
			notes: "Great coffee",
		});
	});

	test("empty omit returns all fields like no projection", async () => {
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
		const results = await client.findMany({ omit: [] });
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
		await client.findMany({
			sortBy: [{ property: "rating", direction: "descending" }],
		});
		expect(dataSourceQueryMock).toHaveBeenCalledWith(
			expect.objectContaining({
				sorts: [{ property: "Rating", direction: "descending" }],
			}),
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
			select: ["shopName", "rating"] as const,
		});
		expect(objectKeys(results[0])).toEqual(["shopName", "rating"]);
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
		const results = await client.findMany({ omit: ["notes"] as const });
		expect(results[0]).not.toHaveProperty("notes");
		expect(results[0]).toHaveProperty("shopName");
		expect(results[0]).toHaveProperty("rating");
	});

	test("select de-dupes duplicate property names at runtime", async () => {
		dataSourceQueryMock.mockResolvedValueOnce(
			mockQueryResponse([
				makePage({
					"Shop Name": databasePropertyValue.title("Blue Bottle"),
					Rating: databasePropertyValue.number(5),
					"Has WiFi": databasePropertyValue.checkbox(true),
				}),
			]),
		);
		const client = createClient();
		const results = await client.findMany({
			select: ["shopName", "shopName", "rating"] as const,
		});
		expect(objectKeys(results[0])).toEqual(["shopName", "rating"]);
	});

	test("throws when both select and omit are provided", () => {
		const client = createClient();
		expect(() =>
			// @ts-expect-error invalid args
			client.findMany({
				select: ["shopName"] as const,
				omit: ["notes"] as const,
			}),
		).toThrow(
			"[@haustle/notion-orm] Projection: use either select or omit, not both.",
		);
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
		const items: Partial<TestSchema>[] = [];
		for await (const item of client.findMany({ stream: 1 })) {
			items.push(item);
		}
		expect(items).toHaveLength(2);
		expect(items[0].shopName).toBe("Shop A");
		expect(items[1].shopName).toBe("Shop B");
		expect(dataSourceQueryMock).toHaveBeenCalledTimes(2);
	});
});
