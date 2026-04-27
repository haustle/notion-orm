import type { Language } from "prism-react-renderer";
import type { Languages } from "prismjs";
import { objectKeys } from "../../../src/typeUtils";

const MDX_FENCE_TO_PRISM = {
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
} as const satisfies Readonly<Record<string, Language>>;

const mdxFenceAliasToPrismLanguage = new Map<string, Language>();
for (const key of objectKeys(MDX_FENCE_TO_PRISM)) {
	mdxFenceAliasToPrismLanguage.set(key, MDX_FENCE_TO_PRISM[key]);
}

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
	const aliased = mdxFenceAliasToPrismLanguage.get(k);
	if (aliased !== undefined) {
		return aliased;
	}
	return k;
}

export function prismHasGrammar(
	Prism: { readonly languages: Languages },
	lang: Language,
): boolean {
	return Boolean(Prism.languages[lang]);
}
