import type { NotionPropertyValue } from "../types";

export function resolvePhoneNumber(property: NotionPropertyValue) {
	if (property.type !== "phone_number") {
		return null;
	}
	return property.phone_number;
}
