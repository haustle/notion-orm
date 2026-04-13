import { describe, expect, test } from "bun:test";
import type {
	PartialDataSourceObjectResponse,
	QueryDataSourceResponse,
} from "@notionhq/client/build/src/api-endpoints";
import { buildQueryResponse } from "../../../src/client/database/query";
import {
	databasePropertyValue,
	page,
} from "../../helpers/query-transform-fixtures";

describe("query response pipeline", () => {
	test("skips non-page objects and validates the first page with properties", () => {
		let validateCalls = 0;

		const dataSourceRow: PartialDataSourceObjectResponse = {
			object: "data_source",
			id: "ds-1",
			properties: {},
		};

		const notionResponse: QueryDataSourceResponse = {
			object: "list",
			type: "page_or_data_source",
			page_or_data_source: {},
			results: [
				dataSourceRow,
				page({
					"Shop Name": databasePropertyValue.title("Blue Bottle"),
				}),
			],
			next_cursor: null,
			has_more: false,
		};

		const response = buildQueryResponse<{ shopName: string }>({
			response: notionResponse,
			columns: {
				shopName: {
					columnName: "Shop Name",
					type: "title",
				},
			},
			validateSchema: () => {
				validateCalls += 1;
			},
		});

		expect(response.results).toEqual([
			{
				shopName: "Blue Bottle",
			},
		]);
		expect(validateCalls).toBe(1);
	});

	test("returns rawResponse when includeRawResponse is true", () => {
		const rawResponse: QueryDataSourceResponse = {
			object: "list",
			type: "page_or_data_source",
			page_or_data_source: {},
			results: [
				page({
					"Shop Name": databasePropertyValue.title("Blue Bottle"),
				}),
			],
			next_cursor: null,
			has_more: false,
		};

		const response = buildQueryResponse<{ shopName: string }>({
			response: rawResponse,
			columns: {
				shopName: {
					columnName: "Shop Name",
					type: "title",
				},
			},
			validateSchema: () => undefined,
			options: { includeRawResponse: true },
		});

		expect(response.rawResponse).toEqual(rawResponse);
		expect(response.results[0]).toEqual({ shopName: "Blue Bottle" });
	});
});
