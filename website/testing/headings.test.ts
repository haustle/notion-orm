import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { toString as mdastToString } from "mdast-util-to-string";
import remarkMdx from "remark-mdx";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { visit } from "unist-util-visit";
import {
	collectHeadingsFromMdast,
	MAX_TOC_HEADING_DEPTH,
	MIN_TOC_HEADING_DEPTH,
} from "../src/site/headings.js";
import {
	extractTocFromSiteMdx,
	parseSiteMdx,
	siteMdxRemarkPlugins,
} from "../src/site/mdx-pipeline.js";
import type { TocEntry } from "../src/site/types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const contentDir = join(__dirname, "..", "content");

function parseRuntimeMdx(source: string) {
	const processor = unified().use(remarkParse).use(remarkMdx);
	for (const plugin of siteMdxRemarkPlugins) {
		processor.use(plugin);
	}

	const tree = processor.parse(source);
	return processor.runSync(tree);
}

function getHeadingIds(tree: ReturnType<typeof parseSiteMdx>): string[] {
	const headingIds: string[] = [];

	visit(
		tree,
		"heading",
		(node: { data?: { hProperties?: { id?: unknown } } }) => {
			const id = node.data?.hProperties?.id;
			if (typeof id === "string") {
				headingIds.push(id);
			}
		},
	);

	return headingIds;
}

function getRenderedToc(tree: ReturnType<typeof parseRuntimeMdx>): TocEntry[] {
	const toc: TocEntry[] = [];

	visit(
		tree,
		"heading",
		(node: { depth: number; data?: { hProperties?: { id?: unknown } } }) => {
			const id = node.data?.hProperties?.id;
			if (
				typeof id === "string" &&
				node.depth >= MIN_TOC_HEADING_DEPTH &&
				node.depth <= MAX_TOC_HEADING_DEPTH
			) {
				toc.push({
					id,
					label: mdastToString(node).trim(),
					depth: node.depth,
				});
			}
		},
	);

	return toc;
}

describe("collectHeadingsFromMdast", () => {
	test("assigns rendered heading ids and TOC entries from one pass", () => {
		const tree = parseSiteMdx(`
# Overview

## Intro

### Using \`sortBy\`

## Intro

#### Deep dive
`);

		const toc = collectHeadingsFromMdast(tree);

		expect(getHeadingIds(tree)).toEqual([
			"overview",
			"intro",
			"using-sortby",
			"intro-1",
			"deep-dive",
		]);
		expect(toc).toEqual([
			{ id: "intro", label: "Intro", depth: 2 },
			{ id: "using-sortby", label: "Using sortBy", depth: 3 },
			{ id: "intro-1", label: "Intro", depth: 2 },
			{ id: "deep-dive", label: "Deep dive", depth: 4 },
		]);
	});

	test("ignores heading-like lines inside fenced code blocks", () => {
		const tree = parseSiteMdx(`
## Real section

\`\`\`md
## Not a section
### Also not a section
\`\`\`

### Real child
`);

		const toc = collectHeadingsFromMdast(tree);

		expect(toc).toEqual([
			{ id: "real-section", label: "Real section", depth: 2 },
			{ id: "real-child", label: "Real child", depth: 3 },
		]);
	});

	test("keeps build-time TOC extraction aligned with runtime heading ids", () => {
		const mdxFiles = readdirSync(contentDir, { withFileTypes: true })
			.filter((entry) => entry.isFile() && entry.name.endsWith(".mdx"))
			.map((entry) => entry.name)
			.sort((left, right) => left.localeCompare(right));

		for (const fileName of mdxFiles) {
			const source = readFileSync(join(contentDir, fileName), "utf8");
			const runtimeTree = parseRuntimeMdx(source);
			expect(extractTocFromSiteMdx(source)).toEqual(
				getRenderedToc(runtimeTree),
			);
		}
	});
});
