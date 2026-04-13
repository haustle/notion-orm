import type { NotionPropertyValue } from "../types";

export function resolveDate(property: NotionPropertyValue) {
	if (property.type !== "date") {
		return null;
	}

	if (property.date && typeof property.date.start === "string") {
		return {
			start: property.date.start,
			end: property.date.end ?? undefined,
		};
	}

	return null;
}
