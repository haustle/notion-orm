import { beforeEach, describe, expect, mock, test } from "bun:test";
import {
	createPrismaApiTestDatabaseClient,
	installPrismaApiNotionClientMock,
	prismaApiStubPartialPage,
	type PrismaApiPagesCreateFn,
	type PrismaApiPagesUpdateFn,
} from "../../helpers/notion-client-test-mock";
import {
	emptyQueryDataSourceResponse,
	queryDataSourceListResponse,
} from "../../helpers/query-data-source-response";
import { databasePropertyValue } from "../../helpers/query-transform-fixtures";

const { dataSourceQueryMock, pagesCreateMock, pagesUpdateMock } =
	installPrismaApiNotionClientMock({
		pagesCreateMock: mock<PrismaApiPagesCreateFn>(async () =>
			prismaApiStubPartialPage("new-page"),
		),
		pagesUpdateMock: mock<PrismaApiPagesUpdateFn>(async () =>
			prismaApiStubPartialPage("updated-page"),
		),
	});

const { DatabaseClient } = await import("../../../src/client/database/DatabaseClient");

function createClient() {
	return createPrismaApiTestDatabaseClient(DatabaseClient);
}

describe("upsert", () => {
	beforeEach(() => {
		pagesCreateMock.mockReset();
		pagesCreateMock.mockResolvedValue(prismaApiStubPartialPage("new-page"));
		pagesUpdateMock.mockReset();
		pagesUpdateMock.mockResolvedValue(prismaApiStubPartialPage("updated-page"));
		dataSourceQueryMock.mockReset();
	});

	test("creates when no match found", async () => {
		dataSourceQueryMock.mockResolvedValueOnce(emptyQueryDataSourceResponse());

		const client = createClient();
		const result = await client.upsert({
			where: { shopName: { equals: "New Shop" } },
			create: { shopName: "New Shop", rating: 5 },
			update: { rating: 5 },
		});

		expect(pagesCreateMock).toHaveBeenCalledTimes(1);
		expect(pagesUpdateMock).not.toHaveBeenCalled();
		expect(dataSourceQueryMock).toHaveBeenCalledTimes(1);
		expect(result).toEqual({ object: "page", id: "new-page" });
	});

	test("updates when match found", async () => {
		dataSourceQueryMock.mockResolvedValueOnce(
			queryDataSourceListResponse([
				{
					object: "page",
					id: "existing-page",
					properties: {
						"Shop Name": databasePropertyValue.title("Existing"),
						Rating: databasePropertyValue.number(3),
					},
				},
			]),
		);

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

	test("throws when a row matches and update is empty", async () => {
		dataSourceQueryMock.mockResolvedValueOnce(
			queryDataSourceListResponse([
				{
					object: "page",
					id: "existing-page",
					properties: {
						"Shop Name": databasePropertyValue.title("Existing"),
						Rating: databasePropertyValue.number(3),
					},
				},
			]),
		);

		const client = createClient();
		await expect(
			client.upsert({
				where: { shopName: { equals: "Existing" } },
				create: { shopName: "Existing", rating: 5 },
				update: {},
			}),
		).rejects.toThrow(
			"[@haustle/notion-orm] upsert(): when a matching row exists, pass at least one key in update.",
		);
	});

	test("throws when more than one row matches before mutating", async () => {
		dataSourceQueryMock.mockResolvedValueOnce(
			queryDataSourceListResponse([
				{
					object: "page",
					id: "a",
					properties: {
						"Shop Name": databasePropertyValue.title("Dup"),
						Rating: databasePropertyValue.number(1),
					},
				},
				{
					object: "page",
					id: "b",
					properties: {
						"Shop Name": databasePropertyValue.title("Dup"),
						Rating: databasePropertyValue.number(2),
					},
				},
			]),
		);

		const client = createClient();
		await expect(
			client.upsert({
				where: { shopName: { equals: "Dup" } },
				create: { shopName: "Dup", rating: 1 },
				update: { rating: 2 },
			}),
		).rejects.toThrow(
			"[@haustle/notion-orm] upsert(): more than one row matches where. Tighten where, delete duplicates, or use updateMany/create explicitly.",
		);
		expect(pagesCreateMock).not.toHaveBeenCalled();
		expect(pagesUpdateMock).not.toHaveBeenCalled();
	});

	test("uses default created_time sort on the existence query", async () => {
		dataSourceQueryMock.mockResolvedValueOnce(emptyQueryDataSourceResponse());

		const client = createClient();
		await client.upsert({
			where: { shopName: { equals: "New Shop" } },
			create: { shopName: "New Shop", rating: 5 },
			update: { rating: 5 },
		});

		const firstCall = dataSourceQueryMock.mock.calls.at(0);
		const firstQueryArg = firstCall?.at(0);
		if (
			!firstQueryArg ||
			typeof firstQueryArg !== "object" ||
			!("sorts" in firstQueryArg)
		) {
			throw new Error("expected query call with sorts");
		}
		expect(firstQueryArg.sorts).toEqual([
			{ timestamp: "created_time", direction: "ascending" },
		]);
	});
});
