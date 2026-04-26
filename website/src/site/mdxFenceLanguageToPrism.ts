import type { Language } from "prism-react-renderer";

const MDX_FENCE_TO_PRISM: Record<string, Language> = {
	ts: "typescript",
	tsx: "tsx",
	mts: "typescript",
	cts: "typescript",
	js: "javascript",
	jsx: "javascript",
	mjs: "javascript",
	cjs: "javascript",
	javascript: "javascript",
	typescript: "typescript",
	json: "json",
	jsonc: "json",
	bash: "bash",
	sh: "bash",
	shell: "bash",
	zsh: "bash",
	pwsh: "powershell",
	ps1: "powershell",
	powershell: "powershell",
	yaml: "yaml",
	yml: "yaml",
	md: "markdown",
	mdx: "markdown",
	css: "css",
	scss: "scss",
	sass: "scss",
};

/** Fences for which we show plain text (no grammar). */
const NO_HIGHLIGHT = new Set([
	"text",
	"txt",
	"plain",
	"plaintext",
	"output",
	"mermaid",
	"",
]);

/**
 * @returns Prism `language` id, or `null` when the fence should not be tokenized.
 */
export function mdxFenceLanguageToPrism(fence: string | null): Language | null {
	if (!fence) {
		return null;
	}
	const k = fence.toLowerCase();
	if (NO_HIGHLIGHT.has(k)) {
		return null;
	}
	if (k in MDX_FENCE_TO_PRISM) {
		return MDX_FENCE_TO_PRISM[k];
	}
	return k;
}

export function prismHasGrammar(
	Prism: { languages: Record<string, object | undefined> },
	lang: Language,
): boolean {
	return Boolean(Prism.languages[lang]);
}
