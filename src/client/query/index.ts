import type { QueryDataSourceResponse } from "@notionhq/client/build/src/api-endpoints";
import { camelize } from "../../helpers";
import type { camelPropertyNameToNameAndTypeMapType } from "../DatabaseClient";
import type {
	QueryResponseWithoutRawResponse,
	QueryResponseWithRawResponse,
} from "../queryTypes";
import { getSimplifiedResult } from "./response";
import type { QueryDataSourcePageResultWithProperties } from "./types";

function isPageWithProperties(
	result: QueryDataSourceResponse["results"][number],
): result is QueryDataSourcePageResultWithProperties {
	return result.object === "page" && "properties" in result;
}

function normalizePageResult<
	DatabaseSchemaType extends Record<string, unknown>,
>(
	result: QueryDataSourcePageResultWithProperties,
	camelPropertyNameToNameAndTypeMap: camelPropertyNameToNameAndTypeMapType,
) {
	const normalizedResult: Partial<DatabaseSchemaType> = {};
	for (const [columnName, propertyValue] of Object.entries(result.properties)) {
		const camelizedColumnName = camelize(columnName);
		const columnType =
			camelPropertyNameToNameAndTypeMap[camelizedColumnName]?.type;
		if (!columnType) {
			continue;
		}

		Object.defineProperty(normalizedResult, camelizedColumnName, {
			value: getSimplifiedResult({ columnType, propertyValue }),
			enumerable: true,
			configurable: true,
			writable: true,
		});
	}

	return normalizedResult;
}

function mapQueryResults<DatabaseSchemaType extends Record<string, unknown>>(
	results: QueryDataSourceResponse["results"],
	camelPropertyNameToNameAndTypeMap: camelPropertyNameToNameAndTypeMapType,
	validateSchema: (result: Partial<DatabaseSchemaType>) => void,
) {
	const normalizedResults: Array<Partial<DatabaseSchemaType>> = [];

	for (const [index, result] of results.entries()) {
		if (!isPageWithProperties(result)) {
			// biome-ignore lint/suspicious/noConsole: surfaced for debugging unexpected Notion payloads
			console.log("Skipping this page: ", { result });
			continue;
		}

		const normalizedResult = normalizePageResult<DatabaseSchemaType>(
			result,
			camelPropertyNameToNameAndTypeMap,
		);

		if (index === 0) {
			validateSchema(normalizedResult);
		}

		normalizedResults.push(normalizedResult);
	}

	return normalizedResults;
}

export function buildQueryResponse<
	DatabaseSchemaType extends Record<string, unknown>,
>(
	res: QueryDataSourceResponse,
	camelPropertyNameToNameAndTypeMap: camelPropertyNameToNameAndTypeMapType,
	validateSchema: (result: Partial<DatabaseSchemaType>) => void,
	options: { includeRawResponse: true },
): QueryResponseWithRawResponse<DatabaseSchemaType>;
export function buildQueryResponse<
	DatabaseSchemaType extends Record<string, unknown>,
>(
	res: QueryDataSourceResponse,
	camelPropertyNameToNameAndTypeMap: camelPropertyNameToNameAndTypeMapType,
	validateSchema: (result: Partial<DatabaseSchemaType>) => void,
	options?: { includeRawResponse?: false | undefined },
): QueryResponseWithoutRawResponse<DatabaseSchemaType>;
export function buildQueryResponse<
	DatabaseSchemaType extends Record<string, unknown>,
>(
	res: QueryDataSourceResponse,
	camelPropertyNameToNameAndTypeMap: camelPropertyNameToNameAndTypeMapType,
	validateSchema: (result: Partial<DatabaseSchemaType>) => void,
	options?: { includeRawResponse?: boolean },
):
	| QueryResponseWithoutRawResponse<DatabaseSchemaType>
	| QueryResponseWithRawResponse<DatabaseSchemaType> {
	const results = mapQueryResults<DatabaseSchemaType>(
		res.results,
		camelPropertyNameToNameAndTypeMap,
		validateSchema,
	);

	if (options?.includeRawResponse === true) {
		return {
			results,
			rawResponse: res,
		};
	}

	return {
		results,
	};
}

export {
	recursivelyBuildFilter,
	transformQueryFilterToApiFilter,
} from "./filter";
