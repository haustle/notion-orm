import type { QueryDataSourceParameters } from "@notionhq/client/build/src/api-endpoints";
import type { camelPropertyNameToNameAndTypeMapType } from "../types";
import type {
	DatabasePropertyValue,
	QueryFilter,
	QuerySort,
	SupportedNotionColumnType,
} from "../types";
import { transformQueryFilterToApiFilter } from "./filter";
import { transformQuerySortToApiSorts } from "./sort-transform";

export function buildDataSourceQueryParams<
	DatabaseSchemaType extends Record<string, DatabasePropertyValue>,
	ColumnNameToColumnType extends Record<
		keyof DatabaseSchemaType,
		SupportedNotionColumnType
	>,
>(args: {
	dataSourceId: string;
	camelPropertyNameToNameAndTypeMap: camelPropertyNameToNameAndTypeMapType;
	where?: QueryFilter<DatabaseSchemaType, ColumnNameToColumnType>;
	sortBy?: QuerySort<ColumnNameToColumnType>;
	size?: number;
	after?: string;
}): QueryDataSourceParameters {
	const params: QueryDataSourceParameters = {
		data_source_id: args.dataSourceId,
	};
	if (args.sortBy) {
		params.sorts = transformQuerySortToApiSorts(
			args.sortBy,
			args.camelPropertyNameToNameAndTypeMap,
		);
	}
	if (args.where) {
		const filters = transformQueryFilterToApiFilter(
			args.where,
			args.camelPropertyNameToNameAndTypeMap,
		);
		if (filters) {
			params.filter = filters;
		}
	}
	if (args.size !== undefined) {
		params.page_size = args.size;
	}
	if (args.after) {
		params.start_cursor = args.after;
	}
	return params;
}
