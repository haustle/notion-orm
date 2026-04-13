import * as ts from "typescript";
import { emitTsAndJsArtifacts, type TsEmitContext } from "./ts-emit-core";
import { TS_EMIT_OPTIONS_DEFAULT } from "./ts-emit-options";

/**
 * One exported item inside a generated registry module
 * (`databases/index.ts`, `agents/index.ts`, etc).
 */
export interface RegistryEntry {
	importName: string;
	importPath: string;
	registryKey?: string;
}

/**
 * Builds AST for a simple export registry object:
 * imports each entry and exports `const <registryName> = { ... }`.
 */
export function buildRegistryModuleAst(args: {
	registryName: string;
	entries: RegistryEntry[];
}): ts.Statement[] {
	const { registryName, entries } = args;
	const importStatements = entries.map((entry) =>
		ts.factory.createImportDeclaration(
			undefined,
			ts.factory.createImportClause(
				false,
				undefined,
				ts.factory.createNamedImports([
					ts.factory.createImportSpecifier(
						false,
						undefined,
						ts.factory.createIdentifier(entry.importName),
					),
				]),
			),
			ts.factory.createStringLiteral(entry.importPath),
			undefined,
		),
	);

	const registryProperties = entries.map((entry) => {
		const registryKey = entry.registryKey ?? entry.importName;
		return ts.factory.createPropertyAssignment(
			ts.factory.createIdentifier(registryKey),
			ts.factory.createIdentifier(entry.importName),
		);
	});

	const registryExport = ts.factory.createVariableStatement(
		[ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)],
		ts.factory.createVariableDeclarationList(
			[
				ts.factory.createVariableDeclaration(
					ts.factory.createIdentifier(registryName),
					undefined,
					undefined,
					ts.factory.createObjectLiteralExpression(registryProperties, true),
				),
			],
			ts.NodeFlags.Const,
		),
	);

	return [...importStatements, registryExport];
}

/**
 * Emits TypeScript + JavaScript artifacts for a registry module.
 * This is used by both database and agent barrel generation.
 */
export function emitRegistryModuleArtifacts(args: {
	registryName: string;
	entries: RegistryEntry[];
	tsPath: string;
	jsPath: string;
	context?: TsEmitContext;
}): { tsCode: string; jsCode: string } {
	const { registryName, entries, tsPath, jsPath, context } = args;
	const nodes = buildRegistryModuleAst({ registryName, entries });
	return emitTsAndJsArtifacts({
		nodes,
		tsPath,
		jsPath,
		context,
		module: TS_EMIT_OPTIONS_DEFAULT.module,
		target: TS_EMIT_OPTIONS_DEFAULT.target,
	});
}
