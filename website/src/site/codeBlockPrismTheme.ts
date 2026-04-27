import type { PrismTheme } from "prism-react-renderer";

/**
 * Syntax colors aligned with the demo playground:
 * - **Dark** — `src/site/demo/cmOneDarkTheme.ts` (One Dark / Lezer)
 * - **Light** — `thememirror` `clouds` (`node_modules/thememirror/dist/themes/clouds.js`)
 *
 * `plain.color` uses site semantic tokens (see `panda.config.ts` `codeText`).
 */
const plainLight = {
	color: "var(--colors-code-text, #374151)",
	backgroundColor: "transparent",
} as const;

const plainDark = {
	color: "var(--colors-code-text, #d1d1d1)",
	backgroundColor: "transparent",
} as const;

/** Prism token styles for dark mode (matches `cmOneDarkTheme` hex values). */
export const siteCodeBlockPrismThemeDark = {
	plain: { ...plainDark },
	styles: [
		{
			types: ["comment", "prolog", "doctype", "cdata"],
			style: { color: "#5c6370", fontStyle: "italic" },
		},
		// `const` / `let` / `var` only (see `prismPlaygroundStyleKeywords`); not `import` / `export` (those match `keyword`)
		{ types: ["declaration"], style: { color: "#e06c75" } },
		{
			types: ["keyword", "atrule", "important"],
			style: { color: "#c678dd" },
		},
		{
			types: [
				"string",
				"char",
				"attr-value",
				"inserted",
				"template-string",
				"regex",
			],
			style: { color: "#98c379" },
		},
		{
			types: ["number", "boolean", "null"],
			style: { color: "#d19a66" },
		},
		{
			types: ["class-name", "builtin", "maybe-class-name"],
			languages: ["javascript", "js", "typescript", "ts", "tsx", "jsx"],
			style: { color: "#e5c07b" },
		},
		{
			types: ["function"],
			languages: ["javascript", "js", "typescript", "ts", "tsx", "jsx"],
			style: { color: "#61afef" },
		},
		{
			types: ["function", "tag"],
			languages: ["json", "yaml", "bash", "shell"],
			style: { color: "#61afef" },
		},
		{ types: ["property", "constant"], style: { color: "#d19a66" } },
		{ types: ["symbol", "variable"], style: { color: "#e06c75" } },
		{
			types: ["operator", "punctuation", "namespace", "entity"],
			style: { color: "#abb2bf" },
		},
		{ types: ["bold"], style: { fontWeight: "bold" } },
		{
			types: ["class-name", "atrule", "selector", "tag", "attr-name"],
			languages: ["css", "scss"],
			style: { color: "#e5c07b" },
		},
		{ types: ["deleted"], style: { color: "#e06c75" } },
		{
			types: ["script", "language-javascript", "language-typescript"],
			style: { color: "inherit" },
		},
	],
} satisfies PrismTheme;

/** Prism light theme — `clouds` (thememirror) with TS-friendly accents. */
export const siteCodeBlockPrismThemeLight = {
	plain: { ...plainLight },
	styles: [
		{
			types: ["comment", "prolog", "doctype", "cdata"],
			style: { color: "#6b7a72" },
		},
		{
			types: [
				"string",
				"char",
				"attr-value",
				"inserted",
				"regex",
				"template-string",
			],
			style: { color: "#2563b8" },
		},
		{ types: ["number", "boolean", "null"], style: { color: "#46A609" } },
		// Playground: only `const` / `let` / `var` are red; `import` / `from` / `await` stay in `keyword` (tan, clouds #AF956F)
		{ types: ["declaration"], style: { color: "#b91c1c" } },
		{ types: ["keyword", "atrule"], style: { color: "#9a6b2f" } },
		{
			types: ["class-name", "maybe-class-name"],
			languages: ["javascript", "js", "typescript", "ts", "tsx", "jsx"],
			style: { color: "#606060" },
		},
		{
			types: ["function"],
			languages: ["javascript", "js", "typescript", "ts", "tsx", "jsx"],
			style: { color: "#5D90CD" },
		},
		{ types: ["function", "tag"], style: { color: "#5D90CD" } },
		{
			types: ["punctuation", "namespace", "operator", "entity"],
			style: { color: "#606060" },
		},
		{ types: ["variable", "constant", "symbol"], style: { color: "#1f2937" } },
		{ types: ["property"], style: { color: "#AF956F" } },
		{ types: ["bold", "important"], style: { fontWeight: "bold" } },
		{
			types: ["class-name", "selector", "atrule", "tag", "attr-name"],
			languages: ["css", "scss"],
			style: { color: "#C52727" },
		},
		{ types: ["deleted"], style: { color: "#C52727" } },
		{
			types: ["script", "language-javascript", "language-typescript"],
			style: { color: "inherit" },
		},
	],
} satisfies PrismTheme;

export function getSiteCodeBlockPrismTheme(isDark: boolean): PrismTheme {
	return isDark ? siteCodeBlockPrismThemeDark : siteCodeBlockPrismThemeLight;
}
