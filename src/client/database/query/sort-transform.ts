import type { QueryDataSourceParameters } from "@notionhq/client/build/src/api-endpoints";
import type { camelPropertyNameToNameAndTypeMapType } from "../types";
import type {
	QuerySort,
	SupportedNotionColumnType,
} from "../types";

type QueryApiSorts = NonNullable<QueryDataSourceParameters["sorts"]>;

export function transformQuerySortToApiSorts<
	DatabaseSchemaType extends Record<string, unknown>,
	ColumnNameToColumnType extends Record<
		keyof DatabaseSchemaType,
		SupportedNotionColumnType
	>,
>(
	querySort: QuerySort<ColumnNameToColumnType>,
	camelPropertyNameToNameAndTypeMap: camelPropertyNameToNameAndTypeMapType,
): QueryApiSorts {
	return querySort.map((sort) => {
		if ("timestamp" in sort) {
			return sort;
		}
		const mappedColumn = camelPropertyNameToNameAndTypeMap[sort.property];
		return {
			property: mappedColumn?.columnName ?? sort.property,
			direction: sort.direction,
		};
	});
}
