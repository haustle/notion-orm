import { describe, expect, test } from "bun:test";
import { buildQueryResponse } from "../../../src/client/query";
import { databasePropertyValue } from "../../helpers/query-transform-fixtures";

describe("query response pipeline", () => {
	test("skips non-page objects and validates the first page with properties", () => {
		let validateCalls = 0;

		const response = buildQueryResponse<{ shopName: string }>({
			response: {
				object: "list",
				results: [
					{
						object: "database",
					},
					{
						object: "page",
						properties: {
							"Shop Name": databasePropertyValue.title("Blue Bottle"),
						},
					},
				],
			},
			columnNameToColumnProperties: {
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
		const rawResponse = {
			object: "list",
			results: [
				{
					object: "page",
					properties: {
						"Shop Name": databasePropertyValue.title("Blue Bottle"),
					},
				},
			],
		};

		const response = buildQueryResponse<{ shopName: string }>({
			response: rawResponse,
			columnNameToColumnProperties: {
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
