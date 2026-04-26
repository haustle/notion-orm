import type { default as PrismLib } from "prismjs";

const STORAGE_DECL = {
	declaration: {
		pattern: /\b(?:const|let|var)\b/,
	},
} as const;

/**
 * Playground (light) shows `const` in **red** and `import` / `from` / `export` / `await` in **tan** — not
 * the same bucket. Out of the box, Prism’s JS grammar is all `keyword`. We peel off only `const` / `let` / `var`.
 *
 * `typescript` and `tsx` are created with `extend` (deep copies at import time), so the same
 * `insertBefore` has to be applied to each id **after** every component has loaded, not just `javascript`
 * (otherwise TS/MDX ` ```ts` blocks never get the `declaration` token).
 */
export function registerPrismPlaygroundStyleKeywords(
	Prism: typeof PrismLib,
): void {
	for (const id of ["javascript", "typescript", "tsx"] as const) {
		const grammar = Prism.languages[id];
		if (!grammar) {
			continue;
		}
		if (Object.hasOwn(grammar, "declaration")) {
			continue;
		}
		Prism.languages.insertBefore(id, "keyword", { ...STORAGE_DECL });
	}
}
