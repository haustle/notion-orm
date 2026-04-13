import type { NotionPropertyValue } from "../types";

export function resolveUniqueId(property: NotionPropertyValue) {
	if (property.type !== "unique_id") {
		return null;
	}

	if (property.unique_id && typeof property.unique_id.number === "number") {
		if (
			typeof property.unique_id.prefix === "string" &&
			property.unique_id.prefix.length > 0
		) {
			return `${property.unique_id.prefix}-${property.unique_id.number}`;
		}
		return `${property.unique_id.number}`;
	}

	return null;
}
