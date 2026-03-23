export function slugify(text: string): string {
	return text
		.toLowerCase()
		.replace(/[^a-z0-9\s-]/g, "")
		.trim()
		.replace(/\s/g, "-");
}

/**
 * Assigns stable heading `id`s in document order, matching `extractToc` in
 * `scripts/build-mdx-content.ts` (duplicate titles become `slug`, `slug-1`, …).
 */
export function createHeadingSlugFactory(): (label: string) => string {
	const counts = new Map<string, number>();
	return (label: string) => {
		const base = slugify(label);
		const n = counts.get(base) ?? 0;
		counts.set(base, n + 1);
		return n === 0 ? base : `${base}-${n}`;
	};
}
