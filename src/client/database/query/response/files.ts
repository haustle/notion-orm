import type { NotionPropertyValue } from "../types";
import { resolveFilesValue } from "./shared";

export function resolveFiles(property: NotionPropertyValue) {
	if (property.type !== "files") {
		return null;
	}
	return resolveFilesValue(property.files);
}
