import { beforeEach, describe, expect, mock, test } from "bun:test";
import { z } from "zod";
import { databasePropertyValue } from "../../helpers/query-transform-fixtures";

const pagesCreateMock = mock(async () => ({ id: "new-page" }));
const pagesUpdateMock = mock(async () => ({ id: "updated-page" }));
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
			create: pagesCreateMock,
			update: pagesUpdateMock,
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

describe("upsert", () => {
	beforeEach(() => {
		pagesCreateMock.mockReset();
		pagesCreateMock.mockResolvedValue({ id: "new-page" });
		pagesUpdateMock.mockReset();
		pagesUpdateMock.mockResolvedValue({ id: "updated-page" });
		dataSourceQueryMock.mockReset();
	});

	test("creates when no match found", async () => {
		dataSourceQueryMock.mockResolvedValueOnce({
			object: "list",
			results: [],
			next_cursor: null,
			has_more: false,
			type: "page_or_data_source",
			page_or_data_source: {},
		});

		const client = createClient();
		const result = await client.upsert({
			where: { shopName: { equals: "New Shop" } },
			create: { shopName: "New Shop", rating: 5 },
			update: { rating: 5 },
		});

		expect(pagesCreateMock).toHaveBeenCalledTimes(1);
		expect(pagesUpdateMock).not.toHaveBeenCalled();
		expect(result).toEqual({ id: "new-page" });
	});

	test("updates when match found", async () => {
		dataSourceQueryMock.mockResolvedValueOnce({
			object: "list",
			results: [
				{
					object: "page",
					id: "existing-page",
					properties: {
						"Shop Name": databasePropertyValue.title("Existing"),
						Rating: databasePropertyValue.number(3),
					},
				},
			],
			next_cursor: null,
			has_more: false,
			type: "page_or_data_source",
			page_or_data_source: {},
		});

		const client = createClient();
		await client.upsert({
			where: { shopName: { equals: "Existing" } },
			create: { shopName: "Existing", rating: 5 },
			update: { rating: 5 },
		});

		expect(pagesUpdateMock).toHaveBeenCalledWith(
			expect.objectContaining({ page_id: "existing-page" }),
		);
		expect(pagesCreateMock).not.toHaveBeenCalled();
	});
});
