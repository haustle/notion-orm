import type { PrismTheme } from "prism-react-renderer";

/**
 * Light colors match the playground's clouds theme; dark colors match cmOneDarkTheme.
 * CodeBlock sets CSS color-scheme, so the same token markup works before hydration
 * and follows theme changes without a React render.
 */
export const siteCodeBlockPrismTheme = {
	plain: {
		color: "var(--colors-code-text, light-dark(#374151, #d1d1d1))",
		backgroundColor: "transparent",
	},
	styles: [
		{
			types: ["comment", "prolog", "doctype", "cdata"],
			style: { color: "light-dark(#6b7a72, #5c6370)" },
		},
		// Only const / let / var use declaration colors, not import / export / await.
		{
			types: ["declaration"],
			style: { color: "light-dark(#b91c1c, #e06c75)" },
		},
		{
			types: ["keyword", "atrule"],
			style: { color: "light-dark(#9a6b2f, #c678dd)" },
		},
		{
			types: ["important"],
			style: { color: "light-dark(currentColor, #c678dd)" },
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
			style: { color: "light-dark(#2563b8, #98c379)" },
		},
		{
			types: ["number", "boolean", "null"],
			style: { color: "light-dark(#46A609, #d19a66)" },
		},
		{
			types: ["class-name", "maybe-class-name"],
			languages: ["javascript", "js", "typescript", "ts", "tsx", "jsx"],
			style: { color: "light-dark(#606060, #e5c07b)" },
		},
		{
			types: ["builtin"],
			languages: ["javascript", "js", "typescript", "ts", "tsx", "jsx"],
			style: { color: "light-dark(currentColor, #e5c07b)" },
		},
		{
			types: ["function", "tag"],
			style: { color: "light-dark(#5D90CD, currentColor)" },
		},
		{
			types: ["function"],
			languages: ["javascript", "js", "typescript", "ts", "tsx", "jsx"],
			style: { color: "light-dark(#5D90CD, #61afef)" },
		},
		{
			types: ["function", "tag"],
			languages: ["json", "yaml", "bash", "shell"],
			style: { color: "light-dark(#5D90CD, #61afef)" },
		},
		{ types: ["property"], style: { color: "light-dark(#AF956F, #d19a66)" } },
		{ types: ["constant"], style: { color: "light-dark(#1f2937, #d19a66)" } },
		{
			types: ["symbol", "variable"],
			style: { color: "light-dark(#1f2937, #e06c75)" },
		},
		{
			types: ["punctuation", "namespace", "operator", "entity"],
			style: { color: "light-dark(#606060, #abb2bf)" },
		},
		{ types: ["bold"], style: { fontWeight: "bold" } },
		{
			types: ["class-name", "selector", "atrule", "tag", "attr-name"],
			languages: ["css", "scss"],
			style: { color: "light-dark(#C52727, #e5c07b)" },
		},
		{ types: ["deleted"], style: { color: "light-dark(#C52727, #e06c75)" } },
		{
			types: ["script", "language-javascript", "language-typescript"],
			style: { color: "inherit" },
		},
	],
} satisfies PrismTheme;
