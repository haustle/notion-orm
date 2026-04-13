import { objectEntries } from "../../../../typeUtils";
import type {
	apiFilterType,
	DatabaseColumns,
	DatabaseDefinition,
	QueryFilter,
} from "../../types";
import { isFilterablePropertyType } from "../../types";
import type { FilterableColumnType } from "../types";
import { filterLeafBuilders, filterValueGuards } from "./builders";
import { buildCompoundFilter } from "./compound";

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function isDefined<T>(value: T | undefined): value is T {
	return value !== undefined;
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

function buildTypedLeafFilter<K extends FilterableColumnType>(
	columnType: K,
	columnName: string,
	columnFilterValue: unknown,
): apiFilterType {
	const guard = filterValueGuards[columnType];
	if (!guard(columnFilterValue)) {
		return undefined;
	}

	const builder = filterLeafBuilders[columnType];
	return builder({
		columnName,
		columnFilterValue,
	});
}

function buildLeafFilterFromEntry(
	entry: [string, unknown],
	columns: DatabaseColumns,
): apiFilterType {
	const [prop, columnFilterValue] = entry;
	const mappedColumn = columns[prop];
	if (!mappedColumn) {
		return undefined;
	}
	if (!isFilterablePropertyType(mappedColumn.type)) {
		return undefined;
	}
	if (!columnFilterValue) {
		return undefined;
	}

	const leafFilter = buildTypedLeafFilter(
		mappedColumn.type,
		mappedColumn.columnName,
		columnFilterValue,
	);

	if (isApiFilter(leafFilter)) {
		return leafFilter;
	}
	return undefined;
}

function buildLeafFilterObject(
	queryFilter: Record<string, unknown>,
	columns: DatabaseColumns,
): apiFilterType {
	const entries = objectEntries(queryFilter);
	if (entries.length === 0) {
		return undefined;
	}

	const leafFilters = entries
		.map((entry) => buildLeafFilterFromEntry(entry, columns))
		.filter(isDefined);

	if (leafFilters.length === 0) {
		return undefined;
	}

	if (leafFilters.length === 1) {
		return leafFilters[0];
	}

	const andFilter = { and: leafFilters };
	if (isApiFilter(andFilter)) {
		return andFilter;
	}
	return undefined;
}

export function transformQueryFilterToApiFilter<
	Definition extends DatabaseDefinition,
>(queryFilter: QueryFilter<Definition>,
	columns: DatabaseColumns,
): apiFilterType {
		if ("and" in queryFilter && Array.isArray(queryFilter.and)) {
			const andFilter = buildCompoundFilter("and", queryFilter.and, (filter) =>
				transformQueryFilterToApiFilter(filter, columns),
			);
			if (isApiFilter(andFilter)) {
				return andFilter;
			}
			return undefined;
		}

		if ("or" in queryFilter && Array.isArray(queryFilter.or)) {
			const orFilter = buildCompoundFilter("or", queryFilter.or, (filter) =>
				transformQueryFilterToApiFilter(filter, columns),
			);
			if (isApiFilter(orFilter)) {
				return orFilter;
			}
			return undefined;
		}

		return buildLeafFilterObject(queryFilter, columns);
	}
