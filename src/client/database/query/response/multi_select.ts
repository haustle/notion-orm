import type { NotionPropertyValue } from "../types";

export function resolveMultiSelect(property: NotionPropertyValue) {
	if (property.type !== "multi_select") {
		return null;
	}

	if (!property.multi_select) {
		return null;
	}

	return property.multi_select.map(({ name }: { name: string }) => name);
}
