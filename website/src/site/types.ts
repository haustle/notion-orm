import type { ComponentType } from "react";

export const sitePaths = ["/", "/api-reference", "/demo"] as const;

export type SitePath = (typeof sitePaths)[number];

export interface TocEntry {
	id: string;
	label: string;
	depth: number;
}

export interface SitePage {
	path: SitePath;
	title: string;
	description: string;
	component: ComponentType;
	toc: TocEntry[];
}
