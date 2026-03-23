import type { Heading, Root } from "mdast";
import { toString as mdastToString } from "mdast-util-to-string";
import remarkMdx from "remark-mdx";
import remarkParse from "remark-parse";
import { unified } from "unified";
import type { Node } from "unist";
import { visit } from "unist-util-visit";
import {
	MAX_TOC_HEADING_DEPTH,
	MIN_TOC_HEADING_DEPTH,
} from "../src/site/headings.js";
import {
	parseSiteMdx,
	siteMdxRemarkPlugins,
} from "../src/site/mdx-pipeline.js";
import type { TocEntry } from "../src/site/types";

export function assertMdastRoot(node: Node): asserts node is Root {
	if (node.type !== "root") {
		throw new Error(`expected mdast root, got ${String(node.type)}`);
	}
}

/** Build-time MDX parse (same as scripts / `extractTocFromSiteMdx`) narrowed to {@link Root}. */
export function parseSiteMdxRoot(source: string): Root {
	const node = parseSiteMdx(source);
	assertMdastRoot(node);
	return node;
}

/** `remarkStableHeadingIds` stores the slug on `node.data.id` (and hProperties). */
function stableHeadingIdFromRemark(node: Heading): string | undefined {
	const d = node.data;
	if (!d || typeof d !== "object") {
		return undefined;
	}
	if ("id" in d && typeof d.id === "string") {
		return d.id;
	}
	return undefined;
}

/**
 * Same pipeline as the browser/runtime path: MDX + GFM + stable heading ids.
 */
export function parseRuntimeMdx(source: string): Root {
	const processor = unified().use(remarkParse).use(remarkMdx);
	for (const plugin of siteMdxRemarkPlugins) {
		processor.use(plugin);
	}
	const tree = processor.parse(source);
	const out = processor.runSync(tree);
	assertMdastRoot(out);
	return out;
}

export function getHeadingIds(tree: Root): string[] {
	const headingIds: string[] = [];

	visit(tree, "heading", (node: Heading) => {
		const id = stableHeadingIdFromRemark(node);
		if (id !== undefined) {
			headingIds.push(id);
		}
	});

	return headingIds;
}

export function getRenderedToc(tree: Root): TocEntry[] {
	const toc: TocEntry[] = [];

	visit(tree, "heading", (node: Heading) => {
		const id = stableHeadingIdFromRemark(node);
		if (
			id !== undefined &&
			node.depth >= MIN_TOC_HEADING_DEPTH &&
			node.depth <= MAX_TOC_HEADING_DEPTH
		) {
			toc.push({
				id,
				label: mdastToString(node).trim(),
				depth: node.depth,
			});
		}
	});

	return toc;
}
