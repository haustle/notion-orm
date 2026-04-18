import fs from "fs";
import path from "path";
import * as ts from "typescript";
import { TS_EMIT_SOURCE_TARGET } from "./ts-emit-options";

/**
 * Shared emit context used by all AST-based codegen modules.
 * Keeping one context stable helps produce deterministic printed output.
 */
export interface TsEmitContext {
	sourceFile: ts.SourceFile;
	printer: ts.Printer;
}

/**
 * Creates printer/source-file scaffolding used by TypeScript AST emitters.
 * This is the root primitive that higher-level emitters reuse.
 */
export function createEmitContext(args?: {
	fileName?: string;
	target?: ts.ScriptTarget;
	kind?: ts.ScriptKind;
}): TsEmitContext {
	const {
		fileName = "generated.ts",
		target = TS_EMIT_SOURCE_TARGET,
		kind,
	} = args ?? {};
	return {
		sourceFile: ts.createSourceFile(fileName, "", target, true, kind),
		printer: ts.createPrinter(),
	};
}

/**
 * Converts statement nodes into TypeScript source text.
 * This is used for both runtime modules and declaration/module templates.
 */
export function printTsNodes(args: {
	nodes: readonly ts.Statement[];
	context?: TsEmitContext;
	listFormat?: ts.ListFormat;
}): string {
	const {
		nodes,
		context = createEmitContext(),
		listFormat = ts.ListFormat.MultiLine,
	} = args;
	return context.printer.printList(
		listFormat,
		ts.factory.createNodeArray(nodes),
		context.sourceFile,
	);
}

/**
 * Prints multiple statement groups with a blank line between groups.
 * Use this when comments alone do not create enough visual separation in generated modules.
 */
export function printTsNodeSegments(args: {
	segments: readonly (readonly ts.Statement[])[];
	context?: TsEmitContext;
	listFormat?: ts.ListFormat;
}): string {
	const { segments, context = createEmitContext(), listFormat } = args;
	const nonEmpty = segments.filter((segment) => segment.length > 0);
	return nonEmpty
		.map((segment) =>
			printTsNodes({ nodes: segment, context, listFormat }).trimEnd(),
		)
		.join("\n\n");
}

/** Inserts a blank line after a two-line `//` banner (before the next non-comment line). */
export function insertBlankLineAfterDoubleSlashBanner(code: string): string {
	return code.replace(
		/^(\/\/[^\n]+\r?\n\/\/[^\n]+)\r?\n(?=import\b)/m,
		"$1\n\n",
	);
}

/** Ensures emitted text ends with a single trailing newline (POSIX-friendly). */
export function finalizeGeneratedSourceWithTrailingNewline(code: string): string {
	return code.endsWith("\n") ? code : `${code}\n`;
}

/**
 * Transpiles generated TypeScript text into JavaScript text.
 * Callers provide module/target options based on the artifact being emitted.
 */
export function transpileTsToJs(args: {
	typescriptCode: string;
	module?: ts.ModuleKind;
	target?: ts.ScriptTarget;
	esModuleInterop?: boolean;
	allowSyntheticDefaultImports?: boolean;
}): string {
	const {
		typescriptCode,
		module = ts.ModuleKind.ES2020,
		target = ts.ScriptTarget.ES2020,
		esModuleInterop,
		allowSyntheticDefaultImports,
	} = args;
	return ts.transpile(typescriptCode, {
		module,
		target,
		esModuleInterop,
		allowSyntheticDefaultImports,
	});
}

/**
 * Ensures the destination directory exists before writing artifacts.
 */
function ensureParentDir(filePath: string): void {
	const parentDir = path.dirname(filePath);
	if (!fs.existsSync(parentDir)) {
		fs.mkdirSync(parentDir, { recursive: true });
	}
}

/**
 * Writes a single text artifact to disk.
 */
export function writeTextArtifact(args: {
	filePath: string;
	content: string;
}): void {
	const { filePath, content } = args;
	ensureParentDir(filePath);
	fs.writeFileSync(filePath, content);
}

/**
 * End-to-end helper used by AST generators that only emit TypeScript source.
 */
export function emitTsArtifacts(args: {
	nodes: readonly ts.Statement[];
	tsPath: string;
	context?: TsEmitContext;
	listFormat?: ts.ListFormat;
}): { tsCode: string } {
	const { nodes, tsPath, context, listFormat } = args;
	const tsCode = printTsNodes({
		nodes,
		context,
		listFormat,
	});
	writeTextArtifact({ filePath: tsPath, content: tsCode });
	return { tsCode };
}
