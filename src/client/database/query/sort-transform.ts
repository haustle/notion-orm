import type { QueryDataSourceParameters } from "@notionhq/client/build/src/api-endpoints";
import type { DatabaseColumns, DatabaseDefinition, QuerySort } from "../types";

type QueryApiSorts = NonNullable<QueryDataSourceParameters["sorts"]>;

export function transformQuerySortToApiSorts<
	Definition extends DatabaseDefinition,
>(querySort: QuerySort<Definition>,
	columns: DatabaseColumns,
): QueryApiSorts {
	return querySort.map((sort) => {
		if ("timestamp" in sort) {
			return sort;
		}
		const mappedColumn = columns[sort.property];
		return {
			property: mappedColumn?.columnName ?? sort.property,
			direction: sort.direction,
		};
	});
}
