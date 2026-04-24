import type { QueryDataSourceResponse } from "@notionhq/client/build/src/api-endpoints";
import type { DatabaseColumns } from "../types";
import type { DatabasePropertyValue } from "../types";
import type {
	QueryResponseWithoutRawResponse,
	QueryResponseWithRawResponse,
} from "../types";
import {
	isPageWithProperties,
	normalizePageResult,
} from "./normalize-page-result";

/**
 * Normalizes every query result and validates the first row against the local
 * schema so drift is surfaced without paying a validation cost on every row.
 */
function mapQueryResults<
	DatabaseSchemaType extends Record<string, DatabasePropertyValue>,
>(args: {
	results: QueryDataSourceResponse["results"];
	columns: DatabaseColumns;
	validateSchema: (result: Partial<DatabaseSchemaType>) => void;
}) {
	const normalizedResults: Array<Partial<DatabaseSchemaType>> = [];
	let hasValidatedFirstPage = false;

	for (const result of args.results) {
		if (!isPageWithProperties(result)) {
			continue;
		}

		const normalizedResult = normalizePageResult<DatabaseSchemaType>({
			result,
			columns: args.columns,
		});

		if (!hasValidatedFirstPage) {
			args.validateSchema(normalizedResult);
			hasValidatedFirstPage = true;
		}

		normalizedResults.push(normalizedResult);
	}

	return normalizedResults;
}

type BuildQueryResponseBase<
	DatabaseSchemaType extends Record<string, DatabasePropertyValue>,
> = {
	response: QueryDataSourceResponse;
	columns: DatabaseColumns;
	validateSchema: (result: Partial<DatabaseSchemaType>) => void;
};

type BuildQueryResponseWithRawResponse<
	DatabaseSchemaType extends Record<string, DatabasePropertyValue>,
> = BuildQueryResponseBase<DatabaseSchemaType> & {
	options: { includeRawResponse: true };
};

type BuildQueryResponseInput<
	DatabaseSchemaType extends Record<string, DatabasePropertyValue>,
> = BuildQueryResponseBase<DatabaseSchemaType> & {
	options?: { includeRawResponse?: false | undefined };
};

export function buildQueryResponse<
	DatabaseSchemaType extends Record<string, DatabasePropertyValue>,
>(
	args: BuildQueryResponseWithRawResponse<DatabaseSchemaType>,
): QueryResponseWithRawResponse<DatabaseSchemaType>;
export function buildQueryResponse<
	DatabaseSchemaType extends Record<string, DatabasePropertyValue>,
>(
	args: BuildQueryResponseInput<DatabaseSchemaType>,
): QueryResponseWithoutRawResponse<DatabaseSchemaType>;
export function buildQueryResponse<
	DatabaseSchemaType extends Record<string, DatabasePropertyValue>,
>(
	args:
		| BuildQueryResponseInput<DatabaseSchemaType>
		| BuildQueryResponseWithRawResponse<DatabaseSchemaType>,
):
	| QueryResponseWithoutRawResponse<DatabaseSchemaType>
	| QueryResponseWithRawResponse<DatabaseSchemaType> {
	const results = mapQueryResults<DatabaseSchemaType>({
		results: args.response.results,
		columns: args.columns,
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
