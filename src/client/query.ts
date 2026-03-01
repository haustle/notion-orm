import type { QueryDataSourceResponse } from "@notionhq/client/build/src/api-endpoints";
import { camelize } from "../helpers";
import type { camelPropertyNameToNameAndTypeMapType } from "./DatabaseClient";
import type {
	apiFilterType,
	QueryFilter,
	SimpleQueryResponse,
	SupportedNotionColumnType,
} from "./queryTypes";

/**
 * Transforms Notion API query response into simplified format
 */
export function buildQueryResponse<
		DatabaseSchemaType extends Record<string, unknown>,
	>(
		res: QueryDataSourceResponse,
		camelPropertyNameToNameAndTypeMap: camelPropertyNameToNameAndTypeMapType,
		validateSchema: (result: Partial<DatabaseSchemaType>) => void,
	): SimpleQueryResponse<DatabaseSchemaType> {
		const rawResults = res.results;
		const rawResponse = res;

		const results: Array<Partial<DatabaseSchemaType>> = rawResults
			.map((result, index) => {
				if (result.object === "page" && !("properties" in result)) {
					// biome-ignore lint/suspicious/noConsole: surfaced for debugging
					// unexpected Notion payloads
					console.log("Skipping this page: ", { result });
					return undefined;
				}

				const simpleResult: Partial<DatabaseSchemaType> = {};
				const properties = Object.entries(result.properties);

				for (const [columnName, result] of properties) {
					const camelizeColumnName = camelize(columnName);
					const columnType =
						camelPropertyNameToNameAndTypeMap[camelizeColumnName]?.type;

					if (columnType) {
						Object.defineProperty(simpleResult, camelizeColumnName, {
							value: getResponseValue(columnType, result),
							enumerable: true,
							configurable: true,
							writable: true,
						});
					}
				}

				if (index === 0) {
					validateSchema(simpleResult);
				}
				return simpleResult;
			})
			.filter((result) => result !== undefined);

		return {
			results,
			rawResponse,
		};
	}

/**
 * Extracts value from Notion property object based on column type
 */
export function getResponseValue(
		prop: SupportedNotionColumnType,
		x: Record<string, any>,
	) {
		switch (prop) {
			case "select": {
				const { select } = x;
				if (select) {
					return select["name"];
				}
				return null;
			}
			case "title": {
				const { title } = x;
				if (title) {
					const combinedText = title.map(
						({ plain_text }: { plain_text: string }) => plain_text,
					);
					return combinedText.join("");
				}
				return null;
			}
			case "url": {
				const { url } = x;
				return url;
			}
			case "multi_select": {
				const { multi_select } = x;
				if (multi_select) {
					const multi_selectArr: string[] = multi_select.map(
						({ name }: { name: string }) => name,
					);
					return multi_selectArr;
				}
				return null;
			}
			case "checkbox": {
				const { checkbox } = x;
				return Boolean(checkbox);
			}
			case "status": {
				const { status } = x;
				if (status) {
					return status["name"];
				}
				return null;
			}
			case "rich_text": {
				const { rich_text } = x;
				if (rich_text && Array.isArray(rich_text)) {
					const combinedText = rich_text.map(
						({ plain_text }: { plain_text: string }) => plain_text,
					);
					return combinedText.join("");
				}
				return null;
			}
			case "number": {
				const { number } = x;
				return number;
			}
			default: {
				return null;
			}
		}
	}

function isFilterableColumnType(
	columnType: SupportedNotionColumnType,
): boolean {
	switch (columnType) {
		case "rich_text":
		case "title":
		case "number":
		case "checkbox":
		case "select":
		case "multi_select":
		case "url":
		case "date":
		case "status":
		case "email":
		case "phone_number":
			return true;
		default:
			return false;
	}
}

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function isApiFilter(value: unknown): value is NonNullable<apiFilterType> {
	if (!isObject(value)) {
		return false;
	}

	if ("and" in value) {
		return Array.isArray(value.and);
	}

	if ("or" in value) {
		return Array.isArray(value.or);
	}

	return typeof value.property === "string";
}

function isDefined<T>(value: T | undefined): value is T {
	return value !== undefined;
}

/**
 * Recursively converts user query filters to Notion API filter format
 */
export function recursivelyBuildFilter<
		DatabaseSchemaType extends Record<string, unknown>,
		ColumnNameToColumnType extends Record<
			keyof DatabaseSchemaType,
			SupportedNotionColumnType
		>,
	>(
		queryFilter: QueryFilter<DatabaseSchemaType, ColumnNameToColumnType>,
		camelPropertyNameToNameAndTypeMap: camelPropertyNameToNameAndTypeMapType,
	): apiFilterType {
		if ("and" in queryFilter) {
			const andFilters = queryFilter.and;
			if (Array.isArray(andFilters)) {
				const compoundFilter = {
					and: andFilters
						.map(
							(
								filter: QueryFilter<DatabaseSchemaType, ColumnNameToColumnType>,
							) =>
								recursivelyBuildFilter(
									filter,
									camelPropertyNameToNameAndTypeMap,
								),
						)
						.filter(isDefined),
				};
				if (isApiFilter(compoundFilter)) {
					return compoundFilter;
				}
				return undefined;
			}
		}

		if ("or" in queryFilter) {
			const orFilters = queryFilter.or;
			if (Array.isArray(orFilters)) {
				const compoundFilter = {
					or: orFilters
						.map(
							(
								filter: QueryFilter<DatabaseSchemaType, ColumnNameToColumnType>,
							) =>
								recursivelyBuildFilter(
									filter,
									camelPropertyNameToNameAndTypeMap,
								),
						)
						.filter(isDefined),
				};
				if (isApiFilter(compoundFilter)) {
					return compoundFilter;
				}
				return undefined;
			}
		}

		const firstEntry = Object.entries(queryFilter)[0];
		if (!firstEntry) {
			return undefined;
		}
		const [prop, columnFilterValue] = firstEntry;

		const mappedColumn = camelPropertyNameToNameAndTypeMap[prop];
		if (!mappedColumn) {
			return undefined;
		}
		if (!isFilterableColumnType(mappedColumn.type)) {
			return undefined;
		}
		if (!columnFilterValue) {
			return undefined;
		}

		const filterObject: Record<string, unknown> = {
			property: mappedColumn.columnName,
			[mappedColumn.type]: columnFilterValue,
		};
		if (isApiFilter(filterObject)) {
			return filterObject;
		}
		return undefined;
	}
