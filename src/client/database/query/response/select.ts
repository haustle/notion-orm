import type { NotionPropertyValue } from "../types";

export function resolveSelect(property: NotionPropertyValue) {
	if (property.type !== "select") {
		return null;
	}
	return property.select ? property.select.name : null;
}
