import type { NotionPropertyValue } from "../types";

export function resolveCreatedTime(property: NotionPropertyValue) {
	if (property.type !== "created_time") {
		return null;
	}
	return property.created_time ?? null;
}
