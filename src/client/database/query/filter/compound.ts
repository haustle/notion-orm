import type { apiFilterType } from "../../types";

function isDefined<T>(value: T | undefined): value is T {
	return value !== undefined;
}

export function buildCompoundFilter<TFilter>(
	key: "and" | "or",
	filters: Array<TFilter>,
	buildChild: (filter: TFilter) => apiFilterType,
): Record<string, unknown> {
	const nestedFilters = filters
		.map((filter) => buildChild(filter))
		.filter(isDefined);
	if (key === "and") {
		return { and: nestedFilters };
	}
	return { or: nestedFilters };
}
