import type { NotionPropertyValue } from "../types";
import { resolveUserNameOrId } from "./shared";

export function resolveLastEditedBy(property: NotionPropertyValue) {
	if (property.type !== "last_edited_by") {
		return null;
	}
	return resolveUserNameOrId(property.last_edited_by);
}
