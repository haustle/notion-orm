import type { NotionPropertyValue } from "../types";

export function resolveUrl(property: NotionPropertyValue) {
	if (property.type !== "url") {
		return null;
	}
	return property.url;
}
