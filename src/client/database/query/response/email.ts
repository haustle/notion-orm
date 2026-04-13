import type { NotionPropertyValue } from "../types";

export function resolveEmail(property: NotionPropertyValue) {
	if (property.type !== "email") {
		return null;
	}
	return property.email;
}
