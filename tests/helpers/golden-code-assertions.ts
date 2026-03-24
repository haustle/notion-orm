import { expect } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";
import * as ts from "typescript";
import {
	CODEGEN_PARSE_VIRTUAL_FILENAMES,
	CODEGEN_TEST_PATHS,
} from "./codegen-file-names";

/** Collapses whitespace; strips trailing commas before `}` / `]` for golden compares. */
export function normalizeCode(content: string): string {
	let normalized = content.trim().replace(/\s+/g, " ");
	let previous: string;
	do {
		previous = normalized;
		normalized = normalized.replace(/,(\s*)\}/g, "$1}");
		normalized = normalized.replace(/,(\s*)\]/g, "$1]");
	} while (normalized !== previous);
	return normalized;
}

export function readGolden(relativePath: string): string {
	return readFileSync(
		join(import.meta.dir, "..", CODEGEN_TEST_PATHS.goldenDir, relativePath),
		"utf-8",
	);
}

function getSyntaxDiagnostics(args: {
	code: string;
	fileName: string;
	scriptKind: ts.ScriptKind;
}): readonly ts.Diagnostic[] {
	const sourceFile = ts.createSourceFile(
		args.fileName,
		args.code,
		ts.ScriptTarget.ESNext,
		true,
		args.scriptKind,
	);
	const compilerOptions: ts.CompilerOptions = {
		target: ts.ScriptTarget.ESNext,
		module: ts.ModuleKind.ESNext,
		allowJs: args.scriptKind === ts.ScriptKind.JS,
		checkJs: false,
		noEmit: true,
		noResolve: true,
	};
	const host = ts.createCompilerHost(compilerOptions, true);
	host.getSourceFile = (
		fileName,
		languageVersion,
		onError,
		shouldCreateNewSourceFile,
	) => {
		if (fileName === args.fileName) {
			return sourceFile;
		}
		return ts
			.createCompilerHost(compilerOptions, true)
			.getSourceFile(
				fileName,
				languageVersion,
				onError,
				shouldCreateNewSourceFile,
			);
	};
	host.readFile = (fileName) => (fileName === args.fileName ? args.code : "");
	host.fileExists = (fileName) => fileName === args.fileName;
	const program = ts.createProgram([args.fileName], compilerOptions, host);
	return program.getSyntacticDiagnostics(sourceFile);
}

export function expectNormalizedCodeToMatch(args: {
	actual: string;
	expected: string;
}): void {
	expect(normalizeCode(args.actual)).toBe(normalizeCode(args.expected));
}

/**
 * Parses the given code as TypeScript and fails if there are any syntax errors.
 * This proves the golden is valid emitted code, not just matching text.
 */
export function expectCodeToParseAsValidTs(args: {
	code: string;
	fileName?: string;
}): void {
	const fileName = args.fileName ?? CODEGEN_PARSE_VIRTUAL_FILENAMES.ts;
	const syntaxErrors = getSyntaxDiagnostics({
		code: args.code,
		fileName,
		scriptKind: ts.ScriptKind.TS,
	});
	if (syntaxErrors && syntaxErrors.length > 0) {
		const messages = syntaxErrors.map((d) => {
			const msg = ts.flattenDiagnosticMessageText(d.messageText, "\n");
			const location = d.file?.getLineAndCharacterOfPosition(d.start ?? 0);
			return `  line ${(location?.line ?? 0) + 1}: ${msg}`;
		});
		throw new Error(
			`TypeScript parse errors in ${fileName}:\n${messages.join("\n")}`,
		);
	}
}

/**
 * Parses the given code as JavaScript and fails if there are any syntax errors.
 */
export function expectCodeToParseAsValidJs(args: {
	code: string;
	fileName?: string;
}): void {
	const fileName = args.fileName ?? CODEGEN_PARSE_VIRTUAL_FILENAMES.js;
	const syntaxErrors = getSyntaxDiagnostics({
		code: args.code,
		fileName,
		scriptKind: ts.ScriptKind.JS,
	});
	if (syntaxErrors && syntaxErrors.length > 0) {
		const messages = syntaxErrors.map((d) => {
			const msg = ts.flattenDiagnosticMessageText(d.messageText, "\n");
			const location = d.file?.getLineAndCharacterOfPosition(d.start ?? 0);
			return `  line ${(location?.line ?? 0) + 1}: ${msg}`;
		});
		throw new Error(
			`JavaScript parse errors in ${fileName}:\n${messages.join("\n")}`,
		);
	}
}
