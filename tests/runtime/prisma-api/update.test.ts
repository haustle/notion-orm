import { beforeEach, describe, expect, mock, test } from "bun:test";
import { z } from "zod";
import { databasePropertyValue } from "../../helpers/query-transform-fixtures";

const pagesUpdateMock = mock(async () => ({ id: "updated-page-id" }));
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

describe("update", () => {
	beforeEach(() => {
		pagesUpdateMock.mockReset();
		pagesUpdateMock.mockResolvedValue({ id: "updated-page-id" });
		dataSourceQueryMock.mockReset();
	});

	test("calls pages.update with page_id and property patch", async () => {
		const client = createClient();
		await client.update({
			where: { id: "page-1" },
			properties: { rating: 4 },
		});
		expect(pagesUpdateMock).toHaveBeenCalledWith({
			page_id: "page-1",
			properties: { Rating: { number: 4 } },
		});
	});

	test("sends only changed fields", async () => {
		const client = createClient();
		await client.update({
			where: { id: "page-1" },
			properties: { shopName: "New Name" },
		});
		const callArgs = pagesUpdateMock.mock.calls[0][0] as any;
		expect(callArgs.properties).toEqual({
			"Shop Name": { title: [{ text: { content: "New Name" } }] },
		});
		expect(callArgs.properties).not.toHaveProperty("Rating");
	});

	test("throws when id is missing", async () => {
		const client = createClient();
		await expect(
			client.update({ where: { id: "" }, properties: { rating: 1 } }),
		).rejects.toThrow("update() requires 'where.id'");
	});

	test("throws when properties is empty", async () => {
		const client = createClient();
		await expect(
			client.update({ where: { id: "page-1" }, properties: {} }),
		).rejects.toThrow("at least one property");
	});

	test("propagates API errors", async () => {
		pagesUpdateMock.mockRejectedValueOnce(new Error("Forbidden"));
		const client = createClient();
		await expect(
			client.update({ where: { id: "page-1" }, properties: { rating: 1 } }),
		).rejects.toThrow("Forbidden");
	});
});

describe("updateMany", () => {
	beforeEach(() => {
		pagesUpdateMock.mockReset();
		pagesUpdateMock.mockResolvedValue({ id: "updated" });
		dataSourceQueryMock.mockReset();
	});

	test("queries matching pages then updates each", async () => {
		dataSourceQueryMock.mockResolvedValueOnce({
			object: "list",
			results: [
				{ object: "page", id: "p1", properties: { "Shop Name": databasePropertyValue.title("A"), Rating: databasePropertyValue.number(3) } },
				{ object: "page", id: "p2", properties: { "Shop Name": databasePropertyValue.title("B"), Rating: databasePropertyValue.number(2) } },
			],
			next_cursor: null,
			has_more: false,
			type: "page_or_data_source",
			page_or_data_source: {},
		});

		const client = createClient();
		await client.updateMany({
			where: { rating: { less_than: 4 } },
			properties: { rating: 5 },
		});

		expect(pagesUpdateMock).toHaveBeenCalledTimes(2);
		expect(pagesUpdateMock).toHaveBeenCalledWith(
			expect.objectContaining({ page_id: "p1" }),
		);
		expect(pagesUpdateMock).toHaveBeenCalledWith(
			expect.objectContaining({ page_id: "p2" }),
		);
	});
});
