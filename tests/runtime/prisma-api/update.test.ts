import { beforeEach, describe, expect, mock, test } from "bun:test";
import { z } from "zod";
import {
	emptyQueryDataSourceResponse,
	queryDataSourceListResponse,
} from "../../helpers/query-data-source-response";
import { databasePropertyValue } from "../../helpers/query-transform-fixtures";
import { isRecord } from "../../helpers/type-guards";

const pagesUpdateMock = mock(async (_args: unknown) => ({
	id: "updated-page-id",
}));
const dataSourceQueryMock = mock(async () => emptyQueryDataSourceResponse());

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

const { DatabaseClient } = await import("../../../src/client/database/DatabaseClient");

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
		expect(pagesUpdateMock).toHaveBeenCalled();
		const firstCall = pagesUpdateMock.mock.calls[0];
		expect(firstCall).toBeDefined();
		const firstArg = firstCall?.[0];
		expect(isRecord(firstArg)).toBe(true);
		if (isRecord(firstArg)) {
			expect(firstArg.properties).toEqual({
				"Shop Name": { title: [{ text: { content: "New Name" } }] },
			});
			expect(firstArg.properties).not.toHaveProperty("Rating");
		}
	});

	test("throws when id is missing", async () => {
		const client = createClient();
		await expect(
			client.update({ where: { id: "" }, properties: { rating: 1 } }),
		).rejects.toThrow(
			"[@haustle/notion-orm] update(): where.id must be a non-empty string (Notion page id).",
		);
	});

	test("throws when properties is empty", async () => {
		const client = createClient();
		await expect(
			client.update({ where: { id: "page-1" }, properties: {} }),
		).rejects.toThrow(
			"[@haustle/notion-orm] update(): pass at least one key in properties.",
		);
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
		dataSourceQueryMock.mockResolvedValueOnce(
			queryDataSourceListResponse([
				{
					object: "page",
					id: "p1",
					properties: {
						"Shop Name": databasePropertyValue.title("A"),
						Rating: databasePropertyValue.number(3),
					},
				},
				{
					object: "page",
					id: "p2",
					properties: {
						"Shop Name": databasePropertyValue.title("B"),
						Rating: databasePropertyValue.number(2),
					},
				},
			]),
		);

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
