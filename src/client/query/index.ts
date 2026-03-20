import type { QueryDataSourceResponse } from "@notionhq/client/build/src/api-endpoints";
import { camelize } from "../../helpers";
import type { camelPropertyNameToNameAndTypeMapType } from "../DatabaseClient";
import type {
	QueryResponseWithoutRawResponse,
	QueryResponseWithRawResponse,
} from "../queryTypes";
import { getSimplifiedResult } from "./response";
import type { QueryDataSourcePageResultWithProperties } from "./types";

/** Narrows Notion query results to page payloads that expose a property map. */
function isPageWithProperties(
	result: QueryDataSourceResponse["results"][number],
): result is QueryDataSourcePageResultWithProperties {
	return result.object === "page" && "properties" in result;
}

/** Converts a raw Notion page into the camelized shape exposed by the client. */
function normalizePageResult<
	DatabaseSchemaType extends Record<string, unknown>,
>(args: {
	result: QueryDataSourcePageResultWithProperties;
	camelPropertyNameToNameAndTypeMap: camelPropertyNameToNameAndTypeMapType;
}) {
	const normalizedResult: Partial<DatabaseSchemaType> = {};
	for (const [columnName, propertyValue] of Object.entries(
		args.result.properties,
	)) {
		const camelizedColumnName = camelize(columnName);
		const columnType =
			args.camelPropertyNameToNameAndTypeMap[camelizedColumnName]?.type;
		if (!columnType) {
			continue;
		}

		Object.assign(normalizedResult, {
			[camelizedColumnName]: getSimplifiedResult({ columnType, propertyValue }),
		});
	}

	return normalizedResult;
}

/**
 * Normalizes every query result and validates the first row against the local
 * schema so drift is surfaced without paying a validation cost on every row.
 */
function mapQueryResults<
	DatabaseSchemaType extends Record<string, unknown>,
>(args: {
	results: QueryDataSourceResponse["results"];
	camelPropertyNameToNameAndTypeMap: camelPropertyNameToNameAndTypeMapType;
	validateSchema: (result: Partial<DatabaseSchemaType>) => void;
}) {
	const normalizedResults: Array<Partial<DatabaseSchemaType>> = [];
	let hasValidatedFirstPage = false;

	for (const result of args.results) {
		if (!isPageWithProperties(result)) {
			// biome-ignore lint/suspicious/noConsole: surfaced for debugging unexpected Notion payloads
			console.log("Skipping this page: ", { result });
			continue;
		}

		const normalizedResult = normalizePageResult<DatabaseSchemaType>({
			result,
			camelPropertyNameToNameAndTypeMap: args.camelPropertyNameToNameAndTypeMap,
		});

		if (!hasValidatedFirstPage) {
			args.validateSchema(normalizedResult);
			hasValidatedFirstPage = true;
		}

		normalizedResults.push(normalizedResult);
	}

	return normalizedResults;
}

type BuildQueryResponseBaseArgs<
	DatabaseSchemaType extends Record<string, unknown>,
> = {
	response: QueryDataSourceResponse;
	columnNameToColumnProperties: camelPropertyNameToNameAndTypeMapType;
	validateSchema: (result: Partial<DatabaseSchemaType>) => void;
};

type BuildQueryResponseWithRawResponseArgs<
	DatabaseSchemaType extends Record<string, unknown>,
> = BuildQueryResponseBaseArgs<DatabaseSchemaType> & {
	options: { includeRawResponse: true };
};

type BuildQueryResponseArgs<
	DatabaseSchemaType extends Record<string, unknown>,
> = BuildQueryResponseBaseArgs<DatabaseSchemaType> & {
	options?: { includeRawResponse?: false | undefined };
};

export function buildQueryResponse<
		DatabaseSchemaType extends Record<string, unknown>,
	>(
		args: BuildQueryResponseWithRawResponseArgs<DatabaseSchemaType>,
	): QueryResponseWithRawResponse<DatabaseSchemaType>;
export function buildQueryResponse<
		DatabaseSchemaType extends Record<string, unknown>,
	>(
		args: BuildQueryResponseArgs<DatabaseSchemaType>,
	): QueryResponseWithoutRawResponse<DatabaseSchemaType>;
export function buildQueryResponse<
	DatabaseSchemaType extends Record<string, unknown>,
>(
	args:
		| BuildQueryResponseArgs<DatabaseSchemaType>
		| BuildQueryResponseWithRawResponseArgs<DatabaseSchemaType>,
):
	| QueryResponseWithoutRawResponse<DatabaseSchemaType>
	| QueryResponseWithRawResponse<DatabaseSchemaType> {
	const results = mapQueryResults<DatabaseSchemaType>({
		results: args.response.results,
		camelPropertyNameToNameAndTypeMap: args.columnNameToColumnProperties,
		validateSchema: args.validateSchema,
	});

	if (args.options?.includeRawResponse === true) {
		return {
			results,
			rawResponse: args.response,
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
