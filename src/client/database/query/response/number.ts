import type { NotionPropertyValue } from "../types";

export function resolveNumber(property: NotionPropertyValue) {
	if (property.type !== "number") {
		return null;
	}
	return property.number;
}
