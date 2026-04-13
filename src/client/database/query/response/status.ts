import type { NotionPropertyValue } from "../types";

export function resolveStatus(property: NotionPropertyValue) {
	if (property.type !== "status") {
		return null;
	}
	return property.status ? property.status.name : null;
}
