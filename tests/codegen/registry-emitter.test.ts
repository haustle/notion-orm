import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as ts from "typescript";
import {
	buildRegistryModuleAst,
	emitRegistryModuleArtifacts,
	type RegistryEntry,
} from "../../src/ast/shared/emit/registry-emitter";
import {
	createEmitContext,
	printTsNodes,
} from "../../src/ast/shared/emit/ts-emit-core";
import {
	CODEGEN_EMIT_PATHS,
	CODEGEN_GOLDEN_FILES,
} from "../helpers/codegen-file-names";
import { REGISTRY_SCENARIO } from "../helpers/codegen-test-data";
import {
	expectNormalizedCodeToMatch,
	readGolden,
} from "../helpers/golden-code-assertions";

describe("registry emitter", () => {
	const registryEntries: RegistryEntry[] = [...REGISTRY_SCENARIO.entries];

	// A registry is an exported object that maps keys to imported modules.
	// Checks generated TypeScript matches the expected registry source exactly.
	test("emits TypeScript registry source that matches the golden file", () => {
		// buildRegistryModuleAst arguments:
		// - registryName: exported object name in generated module
		// - entries: import source + optional key override for each registry item
		const nodes = buildRegistryModuleAst({
			registryName: REGISTRY_SCENARIO.registryName,
			entries: registryEntries,
		});
		const renderedCode = printTsNodes({
			nodes,
			context: createEmitContext({ fileName: CODEGEN_EMIT_PATHS.indexTs }),
		});
		const goldenCode = readGolden(CODEGEN_GOLDEN_FILES.registryItems);
		expectNormalizedCodeToMatch({ actual: renderedCode, expected: goldenCode });
	});

	// Checks registry AST has one import section and one exported object variable.
	test("builds registry AST with imports plus one exported object", () => {
		const nodes = buildRegistryModuleAst({
			registryName: "agents",
			entries: [{ importName: "FoodManager", importPath: "./FoodManager" }],
		});
		expect(nodes.length).toBe(2);
		expect(nodes[0].kind).toBe(ts.SyntaxKind.ImportDeclaration);
		expect(nodes[1].kind).toBe(ts.SyntaxKind.VariableStatement);
	});

	test("emits only the TypeScript registry artifact", () => {
		const tempDirectory = mkdtempSync(join(tmpdir(), "registry-emitter-ts-"));
		try {
			const indexTsPath = join(tempDirectory, CODEGEN_EMIT_PATHS.indexTs);
			const { sourceCode } = emitRegistryModuleArtifacts({
				registryName: REGISTRY_SCENARIO.registryName,
				entries: registryEntries,
				outputPath: indexTsPath,
				environment: "typescript",
			});
			expect(existsSync(indexTsPath)).toBe(true);
			expect(readFileSync(indexTsPath, "utf8")).toBe(sourceCode);
		} finally {
			rmSync(tempDirectory, { recursive: true, force: true });
		}
	});
});
