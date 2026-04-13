import type { NotionPropertyValue } from "../types";
import { resolveUserNameOrId } from "./shared";

export function resolveCreatedBy(property: NotionPropertyValue) {
	if (property.type !== "created_by") {
		return null;
	}
	return resolveUserNameOrId(property.created_by);
}
