import { toString as mdastToString } from "mdast-util-to-string";
import { visit } from "unist-util-visit";

export const MIN_TOC_HEADING_DEPTH = 2;
export const MAX_TOC_HEADING_DEPTH = 4;
const MIN_HEADING_DEPTH = 1;
const MAX_HEADING_DEPTH = 4;

function isSupportedHeadingDepth(depth) {
	return (
		Number.isInteger(depth) &&
		depth >= MIN_HEADING_DEPTH &&
		depth <= MAX_HEADING_DEPTH
	);
}

function isTocHeadingDepth(depth) {
	return depth >= MIN_TOC_HEADING_DEPTH && depth <= MAX_TOC_HEADING_DEPTH;
}

function getHeadingLabel(node) {
	return mdastToString(node).trim();
}

function setHeadingId(node, id) {
	node.data ??= {};
	node.data.id = id;
	node.data.hProperties = {
		...(typeof node.data.hProperties === "object" &&
		node.data.hProperties !== null
			? node.data.hProperties
			: {}),
		id,
	};
}

function slugify(text) {
	return text
		.toLowerCase()
		.replace(/[^a-z0-9\s-]/g, "")
		.trim()
		.replace(/\s/g, "-");
}

function createHeadingSlugFactory() {
	const counts = new Map();
	return (label) => {
		const base = slugify(label);
		const nextCount = counts.get(base) ?? 0;
		counts.set(base, nextCount + 1);
		return nextCount === 0 ? base : `${base}-${nextCount}`;
	};
}

export function collectHeadingsFromMdast(tree) {
	const toc = [];
	const nextId = createHeadingSlugFactory();

	visit(tree, "heading", (node) => {
		if (!isSupportedHeadingDepth(node.depth)) {
			return;
		}

		const label = getHeadingLabel(node);
		if (label.length === 0) {
			return;
		}

		const id = nextId(label);
		setHeadingId(node, id);

		if (isTocHeadingDepth(node.depth)) {
			toc.push({
				id,
				label,
				depth: node.depth,
			});
		}
	});

	return toc;
}

export function remarkStableHeadingIds() {
	return (tree) => {
		collectHeadingsFromMdast(tree);
	};
}
