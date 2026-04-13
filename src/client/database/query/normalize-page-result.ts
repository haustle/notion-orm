import type {
	GetPageResponse,
	PageObjectResponse,
	QueryDataSourceResponse,
} from "@notionhq/client/build/src/api-endpoints";
import { camelize } from "../../../helpers";
import { objectEntries } from "../../../typeUtils";
import type { camelPropertyNameToNameAndTypeMapType } from "../types";
import { getSimplifiedResult } from "./response";
import type {
	NormalizablePageResult,
	QueryDataSourcePageResultWithProperties,
} from "./types";

/** Narrows Notion query results to page payloads that expose a property map. */
export function isPageWithProperties(
	result: QueryDataSourceResponse["results"][number],
): result is QueryDataSourcePageResultWithProperties {
	return result.object === "page" && "properties" in result;
}

/** Narrows a pages.retrieve response to a full page with properties. */
export function isFullPage(page: GetPageResponse): page is PageObjectResponse {
	return "properties" in page;
}

/** Converts a raw Notion page into the camelized shape exposed by the client. */
export function normalizePageResult<
	DatabaseSchemaType extends Record<string, unknown>,
>(args: {
	result: NormalizablePageResult;
	camelPropertyNameToNameAndTypeMap: camelPropertyNameToNameAndTypeMapType;
}) {
	const normalizedResult: Partial<DatabaseSchemaType> = {};
	for (const [columnName, propertyValue] of objectEntries(
		args.result.properties,
	)) {
		const camelizedColumnName = camelize(columnName);
		const columnType =
			args.camelPropertyNameToNameAndTypeMap[camelizedColumnName]?.type;
		if (!columnType) {
			continue;
		}

		Object.assign(normalizedResult, {
			[camelizedColumnName]: getSimplifiedResult({
				columnType,
				propertyValue,
			}),
		});
	}

	return normalizedResult;
}
