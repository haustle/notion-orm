import type { NotionPropertyValue } from "../types";

export function resolveTitle(property: NotionPropertyValue) {
	if (property.type !== "title") {
		return null;
	}

	if (!property.title) {
		return null;
	}

	return property.title
		.map(({ plain_text }: { plain_text: string }) => plain_text)
		.join("");
}
