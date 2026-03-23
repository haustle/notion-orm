/// <reference types="bun-types" />
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { collectHeadingsFromMdast } from "../src/site/headings.js";
import { extractTocFromSiteMdx } from "../src/site/mdx-pipeline.js";
import {
	getHeadingIds,
	getRenderedToc,
	parseRuntimeMdx,
	parseSiteMdxRoot,
} from "./mdx-test-utils";

const __dirname = dirname(fileURLToPath(import.meta.url));
const contentDir = join(__dirname, "..", "content");

describe("collectHeadingsFromMdast", () => {
	test("assigns rendered heading ids and TOC entries from one pass", () => {
		const tree = parseSiteMdxRoot(`
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
		const tree = parseSiteMdxRoot(`
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
