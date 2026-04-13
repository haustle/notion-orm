import type { QueryDataSourceParameters } from "@notionhq/client/build/src/api-endpoints";
import type {
	DatabaseColumns,
	DatabaseDefinition,
	QueryFilter,
	QuerySort,
} from "../types";
import { transformQueryFilterToApiFilter } from "./filter";
import { transformQuerySortToApiSorts } from "./sort-transform";

export function buildDataSourceQueryParams<
	Definition extends DatabaseDefinition,
>(args: {
	dataSourceId: string;
	columns: DatabaseColumns;
	where?: QueryFilter<Definition>;
	sortBy?: QuerySort<Definition>;
	size?: number;
	after?: string;
}): QueryDataSourceParameters {
	const params: QueryDataSourceParameters = {
		data_source_id: args.dataSourceId,
	};
	if (args.sortBy) {
		params.sorts = transformQuerySortToApiSorts(args.sortBy, args.columns);
	}
	if (args.where) {
		const filters = transformQueryFilterToApiFilter(args.where, args.columns);
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
