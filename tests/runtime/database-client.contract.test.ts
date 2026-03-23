import { beforeEach, describe, expect, mock, test } from "bun:test";
import { z } from "zod";
import {
	emptyQueryDataSourceResponse,
	queryDataSourceListResponse,
} from "../helpers/query-data-source-response";
import { databasePropertyValue } from "../helpers/query-transform-fixtures";

const dataSourceQueryMock = mock(async () => emptyQueryDataSourceResponse());

const pagesCreateMock = mock(async () => ({
	id: "created-page-id",
}));

mock.module("@notionhq/client", () => {
	return {
		Client: class {
			public pages = {
				create: pagesCreateMock,
			};

			public dataSources = {
				query: dataSourceQueryMock,
			};

			constructor(_args: unknown) {}
		},
	};
});

const { DatabaseClient } = await import("../../src/client/DatabaseClient");

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
	return new DatabaseClient<TestSchema, TestColumnTypes>({
		id: "db-1",
		auth: "token",
		name: "Coffee Shops",
		schema: z.object({
			shopName: z.string().optional(),
			rating: z.number().optional(),
			hasWifi: z.boolean().optional(),
		}),
		camelPropertyNameToNameAndTypeMap: {
			shopName: { columnName: "Shop Name", type: "title" },
			rating: { columnName: "Rating", type: "number" },
			hasWifi: { columnName: "Has WiFi", type: "checkbox" },
		},
	});
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
					id: "page-1",
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
			data_source_id: "db-1",
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
		pagesCreateMock.mockResolvedValueOnce({
			id: "new-page",
		});

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
				data_source_id: "db-1",
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
					id: "page-1",
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
