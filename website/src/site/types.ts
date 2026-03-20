import type { ComponentType } from "react";

export interface TocEntry {
	id: string;
	label: string;
	depth: number;
}

export interface SitePage {
	path: string;
	title: string;
	description: string;
	component: ComponentType;
	toc: TocEntry[];
}
