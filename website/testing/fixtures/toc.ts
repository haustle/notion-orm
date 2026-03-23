import type { TocEntry } from "../../src/site/types";

/** Shared nested TOC used across `toc` unit tests. */
export const sampleTocNested = [
	{ id: "intro", label: "Intro", depth: 2 },
	{ id: "overview", label: "Overview", depth: 3 },
	{ id: "details", label: "Details", depth: 4 },
	{ id: "api", label: "API", depth: 2 },
] satisfies TocEntry[];
