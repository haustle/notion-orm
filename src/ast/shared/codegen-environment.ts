/**
 * Codegen extension rules (central source of truth for TS vs JS choices):
 *
 *   Rule 1 (env-driven). Per-file ARTIFACT extension is `.ts` or `.js` based
 *            on the consumer project's environment. Compose filenames with
 *            `codegenArtifactFileName(basename, env)` (or
 *            `getCodegenArtifactExtension(env)` only when you need the raw
 *            extension) — never inline the TS/JS ternary.
 *   Rule 2 (constant).   Relative IMPORT SPECIFIERS inside generated `.ts`
 *            and `.d.ts` modules are always `.js` (TS ESM NodeNext pattern
 *            so emitted JS and Node resolution line up). Use
 *            `getCodegenImportExtension()`.
 *   Rule 3 (constant).   DECLARATION artifacts are always `.d.ts` /
 *            `.d.ts.map` regardless of environment (see
 *            `AST_FS_FILENAMES.INDEX_DTS` / `INDEX_DTS_MAP`).
 *
 * New env-dependent file locations should go through
 * `codegenIndexSourcePath` (for `index.{ts,js}`-shaped outputs) rather than
 * reintroducing `Ts`/`Js` paired constants.
 */

import fs from "fs";
import path from "path";

export type CodegenEnvironment = "typescript" | "javascript";

type CodegenConfigRuntime = {
	isTS: boolean;
};

const TSCONFIG_CANDIDATES = [
	"tsconfig.json",
	"tsconfig.app.json",
	"tsconfig.base.json",
	"tsconfig.build.json",
] as const;

function hasTypeScriptConfig(projectRoot: string): boolean {
	return TSCONFIG_CANDIDATES.some((candidate) =>
		fs.existsSync(path.join(projectRoot, candidate)),
	);
}

export function resolveCodegenEnvironment(args?: {
	projectRoot?: string;
	configRuntime?: CodegenConfigRuntime;
}): CodegenEnvironment {
	const projectRoot = args?.projectRoot ?? process.cwd();
	if (args?.configRuntime?.isTS) {
		return "typescript";
	}
	return hasTypeScriptConfig(projectRoot) ? "typescript" : "javascript";
}

function getCodegenArtifactExtension(
	environment: CodegenEnvironment,
): "ts" | "js" {
	return environment === "typescript" ? "ts" : "js";
}

/**
 * Environment-aware artifact filename: `{basename}.{ts|js}`.
 * Use for on-disk module paths and relative `./Foo.{ts|js}` import paths in
 * emitted registries — do not interpolate `getCodegenArtifactExtension` by hand.
 */
export function codegenArtifactFileName(
	basename: string,
	environment: CodegenEnvironment,
): string {
	return `${basename}.${getCodegenArtifactExtension(environment)}`;
}

export function getCodegenImportExtension(): "js" {
	return "js";
}
