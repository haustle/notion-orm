import type { Metadata } from "next";
import { getPage as getPageFromContent } from "../generated/content";
import type { SitePage } from "./types";

export function getPage(path: string = "/"): SitePage | undefined {
	return getPageFromContent(path);
}

export function getPageMetadata(page: SitePage | undefined): Metadata {
	if (!page) {
		return { title: "Not Found", description: "" };
	}
	return {
		title: page.title,
		description: page.description,
	};
}
