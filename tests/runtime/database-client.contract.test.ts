import { beforeEach, describe, expect, mock, test } from "bun:test";
import {
	createPrismaApiTestDatabaseClient,
	installPrismaApiNotionClientMock,
	PRISMA_API_CREATE_COLUMNS,
	prismaApiStubPartialPage,
} from "../helpers/notion-client-test-mock";
import { queryDataSourceListResponse } from "../helpers/query-data-source-response";
import { databasePropertyValue } from "../helpers/query-transform-fixtures";
import {
	MOCK_DATA_SOURCE_ID,
	MOCK_PAGE_ID,
} from "../helpers/test-mock-ids";

const { dataSourceQueryMock, pagesCreateMock } = installPrismaApiNotionClientMock();

const { DatabaseClient } = await import("../../src/client/database/DatabaseClient");

type TestSchema = {
	shopName: string;
	rating: number;
	hasWifi: boolean;
};

type TestColumnTypes = {
	shopName: "title";
	rating: "number";
	hasWifi: "checkbox";
};

function createClient() {
	return createPrismaApiTestDatabaseClient(DatabaseClient, PRISMA_API_CREATE_COLUMNS);
}

describe("DatabaseClient contract", () => {
	beforeEach(() => {
		dataSourceQueryMock.mockReset();
		pagesCreateMock.mockReset();
	});

	test("findMany maps typed filters and returns transformed results", async () => {
		dataSourceQueryMock.mockResolvedValueOnce(
			queryDataSourceListResponse([
				{
					object: "page",
					id: MOCK_PAGE_ID,
					properties: {
						"Shop Name": databasePropertyValue.title("Blue Bottle"),
						Rating: databasePropertyValue.number(5),
						"Has WiFi": databasePropertyValue.checkbox(true),
					},
				},
			]),
		);

		const client = createClient();
		const output = await client.findMany({
			where: {
				rating: { greater_than: 3 },
			},
		});

		expect(dataSourceQueryMock).toHaveBeenCalledTimes(1);
		expect(dataSourceQueryMock).toHaveBeenCalledWith({
			data_source_id: MOCK_DATA_SOURCE_ID,
			filter: {
				property: "Rating",
				number: { greater_than: 3 },
			},
		});
		expect(output).toEqual([
			{
				shopName: "Blue Bottle",
				rating: 5,
				hasWifi: true,
			},
		]);
	});

	test("create maps typed properties to Notion create payload", async () => {
		pagesCreateMock.mockResolvedValueOnce(prismaApiStubPartialPage("new-page"));

		const client = createClient();
		await client.create({
			properties: {
				shopName: "Cafe Nervosa",
				rating: 4,
				hasWifi: false,
			},
		});

		expect(pagesCreateMock).toHaveBeenCalledTimes(1);
		expect(pagesCreateMock).toHaveBeenCalledWith({
			parent: {
				data_source_id: MOCK_DATA_SOURCE_ID,
				type: "data_source_id",
			},
			properties: {
				"Shop Name": {
					title: [
						{
							text: {
								content: "Cafe Nervosa",
							},
						},
					],
				},
				Rating: { number: 4 },
				"Has WiFi": { checkbox: false },
			},
			icon: undefined,
		});
	});

	test("schema drift logs missing properties once per unique issue", async () => {
		dataSourceQueryMock.mockResolvedValue(
			queryDataSourceListResponse([
				{
					object: "page",
					id: MOCK_PAGE_ID,
					properties: {
						"Shop Name": databasePropertyValue.title("Blue Bottle"),
						Rating: databasePropertyValue.number(5),
					},
				},
			]),
		);

		const errorSpy = mock((..._args: unknown[]) => undefined);
		const originalError = console.error;
		console.error = errorSpy;

		try {
			const client = createClient();
			await client.findMany();
			await client.findMany();
		} finally {
			console.error = originalError;
		}

		expect(errorSpy.mock.calls.length).toBe(1);
		const firstCallMessage = String(errorSpy.mock.calls[0]?.[0] ?? "");
		expect(firstCallMessage.includes("Schema drift detected")).toBe(true);
		expect(firstCallMessage.includes("hasWifi")).toBe(true);
	});
});
