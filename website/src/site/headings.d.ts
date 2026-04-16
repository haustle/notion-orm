import type { Root } from "mdast";
import type { TocEntry } from "./types";

export declare const MIN_TOC_HEADING_DEPTH: 2;
export declare const MAX_TOC_HEADING_DEPTH: 4;

export function collectHeadingsFromMdast(tree: Root): TocEntry[];
export function remarkStableHeadingIds(): (tree: Root) => void;
