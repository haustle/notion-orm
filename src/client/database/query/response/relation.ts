import type { NotionPropertyValue } from "../types";

export function resolveRelation(property: NotionPropertyValue) {
	if (property.type !== "relation") {
		return null;
	}

	if (!Array.isArray(property.relation)) {
		return [];
	}

	return property.relation
		.map((item) => item.id)
		.filter((value): value is string => typeof value === "string");
}
