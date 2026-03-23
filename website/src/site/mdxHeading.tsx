"use client";

import { createElement, type FC, type ReactNode, useRef } from "react";
import { useHeadingSlug } from "./HeadingSlugProvider";
import { extractText } from "./mdxTextUtils";

function makeHeading(
	tag: "h1" | "h2" | "h3" | "h4",
): FC<{ children?: ReactNode }> {
	return function Heading({ children }) {
		const nextSlug = useHeadingSlug();
		const text = extractText(children);
		const idRef = useRef<string | null>(null);
		// One slug per mount: React Strict Mode double-invokes render in dev; calling
		// `nextSlug` each time would advance the shared counter and mismatch SSR HTML.
		if (idRef.current === null) {
			idRef.current = nextSlug(text);
		}
		const id = idRef.current;
		return createElement(tag, { id }, children);
	};
}

export const MdxHeading1 = makeHeading("h1");
export const MdxHeading2 = makeHeading("h2");
export const MdxHeading3 = makeHeading("h3");
export const MdxHeading4 = makeHeading("h4");
