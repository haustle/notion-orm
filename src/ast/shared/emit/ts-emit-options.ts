import * as ts from "typescript";

/**
 * Shared compiler option shape used by AST emitters.
 */
interface TsEmitCompilerOptions {
	module: ts.ModuleKind;
	target: ts.ScriptTarget;
}

/**
 * Canonical source file target for printer/source-file scaffolding.
 * Kept as ESNext so printer output can represent latest syntax.
 */
export const TS_EMIT_SOURCE_TARGET = ts.ScriptTarget.ESNext;

/**
 * Default transpile options used across AST emit modules.
 * This mirrors `tsconfig.json` (`module` + `target` are ES2020).
 */
export const TS_EMIT_OPTIONS_DEFAULT = {
	module: ts.ModuleKind.ES2020,
	target: ts.ScriptTarget.ES2020,
} as const satisfies TsEmitCompilerOptions;

/**
 * Transpile options for generated database/agent factory modules.
 */
export const TS_EMIT_OPTIONS_GENERATED = {
	module: ts.ModuleKind.None,
	target: ts.ScriptTarget.ESNext,
} as const satisfies TsEmitCompilerOptions;

/**
 * Interop flags used when emitting package entrypoint runtime JS.
 */
export const TS_EMIT_INTEROP = {
	esModuleInterop: true,
	allowSyntheticDefaultImports: true,
} as const;
