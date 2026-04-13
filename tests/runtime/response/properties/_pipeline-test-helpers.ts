import { describe, expect, test } from "bun:test";
import type { QueryDataSourceResponse } from "@notionhq/client/build/src/api-endpoints";
import { buildQueryResponse } from "../../../../src/client/database/query";
import type { NotionPropertyValue } from "../../../../src/client/database/query/types";
import type { SupportedNotionColumnType } from "../../../../src/client/database/types";
import { queryDataSourceListResponse } from "../../../helpers/query-data-source-response";

const PRIMARY_COLUMN_NAME = "Primary Value";
const PRIMARY_CAMEL_COLUMN_NAME = "primaryValue";
const UNMAPPED_COLUMN_NAME = "Unmapped Value";

export interface PropertyPipelineCase {
		propertyType: SupportedNotionColumnType;
		validPropertyValue: NotionPropertyValue;
		expectedValidValue: unknown;
		mismatchedPropertyValue: NotionPropertyValue;
		malformedPropertyValue: unknown;
		expectedMalformedValue: unknown;
	}

function buildSinglePageResponse(args: {
	primaryValue: unknown;
	includeUnmapped?: NotionPropertyValue;
}): QueryDataSourceResponse {
	const properties: Record<string, unknown> = {
		[PRIMARY_COLUMN_NAME]: args.primaryValue,
	};
	if (args.includeUnmapped) {
		properties[UNMAPPED_COLUMN_NAME] = args.includeUnmapped;
	}

	return queryDataSourceListResponse([
		// @ts-expect-error malformed fixture
		{
			object: "page",
			id: "pipeline-page-1",
			properties,
		},
	]);
}

function transformPrimaryValue(args: {
	propertyType: SupportedNotionColumnType;
	propertyValue: unknown;
	includeRawResponse?: boolean;
	includeUnmapped?: NotionPropertyValue;
	validateSchema?: (result: Record<string, unknown>) => void;
}) {
	let validateCalls = 0;
	const rawResponse = buildSinglePageResponse({
		primaryValue: args.propertyValue,
		includeUnmapped: args.includeUnmapped,
	});
	const validateSchema =
		args.validateSchema ??
		(() => {
			validateCalls += 1;
		});

	if (args.includeRawResponse) {
		const output = buildQueryResponse<Record<string, unknown>>({
			response: rawResponse,
			columnNameToColumnProperties: {
				[PRIMARY_CAMEL_COLUMN_NAME]: {
					columnName: PRIMARY_COLUMN_NAME,
					type: args.propertyType,
				},
			},
			validateSchema,
			options: { includeRawResponse: true },
		});
		return { output, validateCalls, rawResponse };
	}

	const output = buildQueryResponse<Record<string, unknown>>({
		response: rawResponse,
		columnNameToColumnProperties: {
			[PRIMARY_CAMEL_COLUMN_NAME]: {
				columnName: PRIMARY_COLUMN_NAME,
				type: args.propertyType,
			},
		},
		validateSchema,
	});
	return { output, validateCalls, rawResponse };
}

export function describePropertyPipelineCases(
	name: string,
	testCase: PropertyPipelineCase,
) {
	describe(`${name} response transformation pipeline`, () => {
		test("transforms a valid property payload from API results", () => {
			const { output, validateCalls } = transformPrimaryValue({
				propertyType: testCase.propertyType,
				propertyValue: testCase.validPropertyValue,
			});

			expect(validateCalls).toBe(1);
			expect(output.results).toEqual([
				{
					[PRIMARY_CAMEL_COLUMN_NAME]: testCase.expectedValidValue,
				},
			]);
		});

		test("returns null when metadata type and payload type mismatch", () => {
			const { output } = transformPrimaryValue({
				propertyType: testCase.propertyType,
				propertyValue: testCase.mismatchedPropertyValue,
			});

			expect(output.results[0]).toEqual({
				[PRIMARY_CAMEL_COLUMN_NAME]: null,
			});
		});

		test("throws when schema validation rejects transformed output", () => {
			const schemaError = new Error("schema validation failed");
			expect(() =>
				transformPrimaryValue({
					propertyType: testCase.propertyType,
					propertyValue: testCase.mismatchedPropertyValue,
					validateSchema: (result) => {
						expect(result).toEqual({
							[PRIMARY_CAMEL_COLUMN_NAME]: null,
						});
						throw schemaError;
					},
				}),
			).toThrow(schemaError);
		});

		test("handles malformed payloads for the same property type", () => {
			const { output } = transformPrimaryValue({
				propertyType: testCase.propertyType,
				propertyValue: testCase.malformedPropertyValue,
			});

			expect(output.results[0]).toEqual({
				[PRIMARY_CAMEL_COLUMN_NAME]: testCase.expectedMalformedValue,
			});
		});

		test("ignores unmapped API properties while preserving mapped output", () => {
			const { output } = transformPrimaryValue({
				propertyType: testCase.propertyType,
				propertyValue: testCase.validPropertyValue,
				includeUnmapped: testCase.validPropertyValue,
			});

			expect(output.results).toEqual([
				{
					[PRIMARY_CAMEL_COLUMN_NAME]: testCase.expectedValidValue,
				},
			]);
		});

		test("returns rawResponse when includeRawResponse is enabled", () => {
			const { output, rawResponse } = transformPrimaryValue({
				propertyType: testCase.propertyType,
				propertyValue: testCase.validPropertyValue,
				includeRawResponse: true,
			});

			expect(output.results[0]).toEqual({
				[PRIMARY_CAMEL_COLUMN_NAME]: testCase.expectedValidValue,
			});
			if (!("rawResponse" in output)) {
				throw new Error("Expected rawResponse to be present");
			}
			expect(output.rawResponse).toEqual(rawResponse);
		});
	});
}
