import type { NotionPropertyValue } from "../types";
import { resolveUserNameOrId } from "./shared";

export function resolvePeople(property: NotionPropertyValue) {
	if (property.type !== "people") {
		return null;
	}

	if (!Array.isArray(property.people)) {
		return [];
	}

	return property.people
		.map((person) => resolveUserNameOrId(person))
		.filter((value): value is string => typeof value === "string");
}
