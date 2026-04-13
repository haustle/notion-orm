import type { NotionPropertyValue } from "../types";

export function resolveLastEditedTime(property: NotionPropertyValue) {
	if (property.type !== "last_edited_time") {
		return null;
	}
	return property.last_edited_time ?? null;
}
