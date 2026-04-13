import type { NotionPropertyValue } from "../types";
import {
	type NotionPageId,
	toNotionPageId,
} from "../../types/notion-page-id";

export function resolveRelation(property: NotionPropertyValue): NotionPageId[] | null {
	if (property.type !== "relation") {
		return null;
	}

	if (!Array.isArray(property.relation)) {
		return [];
	}

	return property.relation
		.map((item) => item.id)
		.filter((value): value is string => typeof value === "string")
		.map(toNotionPageId);
}
