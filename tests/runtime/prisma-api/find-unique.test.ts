import { beforeEach, describe, expect, mock, test } from "bun:test";
import { z } from "zod";
import { databasePropertyValue } from "../../helpers/query-transform-fixtures";

const pagesRetrieveMock = mock(async () => ({}));

mock.module("@notionhq/client", () => ({
	Client: class {
		public pages = {
			create: mock(async () => ({})),
			update: mock(async () => ({})),
			retrieve: pagesRetrieveMock,
		};
		public dataSources = {
			query: mock(async () => ({
				object: "list",
				results: [],
				next_cursor: null,
				has_more: false,
				type: "page_or_data_source",
				page_or_data_source: {},
			})),
		};
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

describe("findUnique", () => {
	beforeEach(() => {
		pagesRetrieveMock.mockReset();
	});

	test("calls pages.retrieve with correct page_id", async () => {
		pagesRetrieveMock.mockResolvedValueOnce({
			object: "page",
			id: "page-abc",
			properties: {
				"Shop Name": databasePropertyValue.title("Blue Bottle"),
				Rating: databasePropertyValue.number(5),
			},
		});
		const client = createClient();
		const result = await client.findUnique({ where: { id: "page-abc" } });
		expect(pagesRetrieveMock).toHaveBeenCalledWith({ page_id: "page-abc" });
		expect(result).toEqual({ shopName: "Blue Bottle", rating: 5 });
	});

	test("returns null when page has no properties (partial page)", async () => {
		pagesRetrieveMock.mockResolvedValueOnce({
			object: "page",
			id: "page-abc",
		});
		const client = createClient();
		const result = await client.findUnique({ where: { id: "page-abc" } });
		expect(result).toBeNull();
	});

	test("returns null on 404", async () => {
		const notFoundError = Object.assign(new Error("Not Found"), { status: 404 });
		pagesRetrieveMock.mockRejectedValueOnce(notFoundError);
		const client = createClient();
		const result = await client.findUnique({ where: { id: "nonexistent" } });
		expect(result).toBeNull();
	});

	test("rethrows non-404 errors", async () => {
		const serverError = Object.assign(new Error("Server Error"), { status: 500 });
		pagesRetrieveMock.mockRejectedValueOnce(serverError);
		const client = createClient();
		await expect(
			client.findUnique({ where: { id: "page-abc" } }),
		).rejects.toThrow("Server Error");
	});

	test("throws when id is missing", async () => {
		const client = createClient();
		await expect(
			client.findUnique({ where: { id: "" } }),
		).rejects.toThrow("findUnique() requires 'where.id'");
	});
});
