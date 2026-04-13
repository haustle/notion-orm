import type { NotionPropertyValue } from "../types";

export function resolveRichText(property: NotionPropertyValue) {
	if (property.type !== "rich_text") {
		return null;
	}

	if (!property.rich_text || !Array.isArray(property.rich_text)) {
		return null;
	}

	return property.rich_text
		.map(({ plain_text }: { plain_text: string }) => plain_text)
		.join("");
}
