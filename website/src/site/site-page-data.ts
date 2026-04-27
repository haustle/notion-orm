import type { Metadata } from "next";
import { cache } from "react";
import { getPage as getPageFromContent } from "../generated/content";
import { pageDocumentTitle, siteSocialMetadata } from "./config";
import type { SitePage, SitePath } from "./types";

const getCachedPage = cache((path: SitePath) => getPageFromContent(path));

export function getPage(path: SitePath = "/"): SitePage | undefined {
	return getCachedPage(path);
}

export function getPageMetadata(page: SitePage | undefined): Metadata {
	if (!page) {
		return { title: "Not Found", description: "" };
	}
	return {
		title: page.title,
		description: page.description,
		...siteSocialMetadata({
			openGraphTitle: pageDocumentTitle(page.title),
			openGraphDescription: page.description,
		}),
	};
}
