import { beforeEach, describe, expect, mock, test } from "bun:test";
import {
	createPrismaApiTestDatabaseClient,
	installPrismaApiNotionClientMock,
	PRISMA_API_CREATE_COLUMNS,
	prismaApiStubPartialPage,
	type PrismaApiPagesCreateFn,
} from "../../helpers/notion-client-test-mock";
import { MOCK_DATA_SOURCE_ID } from "../../helpers/test-mock-ids";
import { isRecord } from "../../helpers/type-guards";

const { pagesCreateMock } = installPrismaApiNotionClientMock({
	pagesCreateMock: mock<PrismaApiPagesCreateFn>(async () =>
		prismaApiStubPartialPage("created-page-id"),
	),
});

const { DatabaseClient } = await import("../../../src/client/database/DatabaseClient");

type TestSchema = { shopName: string; rating: number; hasWifi: boolean };
type TestColumnTypes = { shopName: "title"; rating: "number"; hasWifi: "checkbox" };

function createClient() {
	return createPrismaApiTestDatabaseClient(DatabaseClient, PRISMA_API_CREATE_COLUMNS);
}

describe("create", () => {
	beforeEach(() => {
		pagesCreateMock.mockReset();
		pagesCreateMock.mockResolvedValue(prismaApiStubPartialPage("created-page-id"));
	});

	test("calls pages.create with correct properties", async () => {
		const client = createClient();
		const result = await client.create({
			properties: { shopName: "Cafe Nervosa", rating: 4, hasWifi: true },
		});
		expect(result.id).toBe("created-page-id");
		expect(pagesCreateMock).toHaveBeenCalledWith(
			expect.objectContaining({
				parent: { data_source_id: MOCK_DATA_SOURCE_ID, type: "data_source_id" },
				properties: {
					"Shop Name": { title: [{ text: { content: "Cafe Nervosa" } }] },
					Rating: { number: 4 },
					"Has WiFi": { checkbox: true },
				},
			}),
		);
	});

	test("passes icon and cover to API", async () => {
		const client = createClient();
		const icon = { type: "emoji" as const, emoji: "☕" as const };
		const cover = { type: "external" as const, external: { url: "https://example.com/cover.jpg" } };
		await client.create({
			properties: { shopName: "Test", rating: 1, hasWifi: false },
			icon,
			cover,
		});
		expect(pagesCreateMock).toHaveBeenCalledWith(
			expect.objectContaining({ icon, cover }),
		);
	});

	test("createMany calls pages.create N times", async () => {
		const client = createClient();
		const results = await client.createMany({
			properties: [
				{ shopName: "Shop A", rating: 3, hasWifi: true },
				{ shopName: "Shop B", rating: 5, hasWifi: false },
			],
		});
		expect(results).toHaveLength(2);
		expect(pagesCreateMock).toHaveBeenCalledTimes(2);
	});

	test("passes markdown content to API", async () => {
		const client = createClient();
		const md = "# Welcome\n\nThis is a page with **bold** text.";
		await client.create({
			properties: { shopName: "Markdown Shop", rating: 5, hasWifi: true },
			markdown: md,
		});
		expect(pagesCreateMock).toHaveBeenCalledWith(
			expect.objectContaining({ markdown: md }),
		);
	});

	test("omits markdown from API call when not provided", async () => {
		const client = createClient();
		await client.create({
			properties: { shopName: "No MD", rating: 3, hasWifi: false },
		});
		expect(pagesCreateMock).toHaveBeenCalled();
		const firstCall = pagesCreateMock.mock.calls[0];
		expect(firstCall).toBeDefined();
		const firstArg = firstCall?.[0];
		expect(isRecord(firstArg)).toBe(true);
		if (isRecord(firstArg)) {
			expect(firstArg.markdown).toBeUndefined();
		}
	});

	test("propagates API errors", async () => {
		pagesCreateMock.mockRejectedValueOnce(new Error("Conflict"));
		const client = createClient();
		await expect(
			client.create({ properties: { shopName: "Fail", rating: 1, hasWifi: false } }),
		).rejects.toThrow("Conflict");
	});
});
