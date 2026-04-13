import type { NotionPropertyValue } from "../types";

export function resolveCheckbox(property: NotionPropertyValue) {
	if (property.type !== "checkbox") {
		return null;
	}
	return Boolean(property.checkbox);
}
