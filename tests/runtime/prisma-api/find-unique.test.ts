import { beforeEach, describe, expect, test } from "bun:test";
import {
	createPrismaApiTestDatabaseClient,
	installPrismaApiNotionClientMock,
	prismaApiDataSourceParent,
} from "../../helpers/notion-client-test-mock";
import { databasePropertyValue } from "../../helpers/query-transform-fixtures";
import { MOCK_DATA_SOURCE_ID } from "../../helpers/test-mock-ids";

const { pagesRetrieveMock } = installPrismaApiNotionClientMock();

const { DatabaseClient } = await import("../../../src/client/database/DatabaseClient");

type TestSchema = { shopName: string; rating: number };
type TestColumnTypes = { shopName: "title"; rating: "number" };

function createClient() {
	return createPrismaApiTestDatabaseClient(DatabaseClient);
}

describe("findUnique", () => {
	beforeEach(() => {
		pagesRetrieveMock.mockReset();
	});

	test("calls pages.retrieve with correct page_id", async () => {
		pagesRetrieveMock.mockResolvedValueOnce({
			object: "page",
			id: "page-abc",
			parent: prismaApiDataSourceParent({ dataSourceId: MOCK_DATA_SOURCE_ID }),
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

	test("applies projection to findUnique results", async () => {
		pagesRetrieveMock.mockResolvedValueOnce({
			object: "page",
			id: "page-abc",
			parent: prismaApiDataSourceParent({ dataSourceId: MOCK_DATA_SOURCE_ID }),
			properties: {
				"Shop Name": databasePropertyValue.title("Blue Bottle"),
				Rating: databasePropertyValue.number(5),
			},
		});
		const client = createClient();
		const result = await client.findUnique({
			where: { id: "page-abc" },
			select: ["shopName"] as const,
		});
		expect(result).toEqual({ shopName: "Blue Bottle" });
	});

	test("returns null when the page belongs to another data source", async () => {
		pagesRetrieveMock.mockResolvedValueOnce({
			object: "page",
			id: "page-abc",
			parent: prismaApiDataSourceParent({ dataSourceId: "other-db" }),
			properties: {
				"Shop Name": databasePropertyValue.title("Blue Bottle"),
				Rating: databasePropertyValue.number(5),
			},
		});
		const client = createClient();
		const result = await client.findUnique({ where: { id: "page-abc" } });
		expect(result).toBeNull();
	});

	test("throws when both select and omit are provided", async () => {
		const client = createClient();
		await expect(
			// @ts-expect-error intentional invalid args — runtime validates projection
			client.findUnique({
				where: { id: "page-abc" },
				select: ["shopName"] as const,
				omit: ["rating"] as const,
			}),
		).rejects.toThrow(
			"[@haustle/notion-orm] Projection: use either select or omit, not both.",
		);
	});

	test("returns null on 404", async () => {
		const notFoundError = Object.assign(new Error("Not Found"), {
			status: 404,
		});
		pagesRetrieveMock.mockRejectedValueOnce(notFoundError);
		const client = createClient();
		const result = await client.findUnique({ where: { id: "nonexistent" } });
		expect(result).toBeNull();
	});

	test("rethrows non-404 errors", async () => {
		const serverError = Object.assign(new Error("Server Error"), {
			status: 500,
		});
		pagesRetrieveMock.mockRejectedValueOnce(serverError);
		const client = createClient();
		await expect(
			client.findUnique({ where: { id: "page-abc" } }),
		).rejects.toThrow("Server Error");
	});

	test("throws when id is missing", async () => {
		const client = createClient();
		await expect(client.findUnique({ where: { id: "" } })).rejects.toThrow(
			"[@haustle/notion-orm] findUnique(): where.id must be a non-empty string (Notion page id).",
		);
	});
});
