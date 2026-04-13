import { afterEach, describe, expect, test } from "bun:test";
import { writeFileSync } from "fs";
import { join } from "path";
import * as ts from "typescript";
import { pathToFileURL } from "url";
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
import {
	cleanupTempWorkspaces,
	createTempWorkspace,
} from "../helpers/temp-workspace";

afterEach(() => {
	cleanupTempWorkspaces();
});

describe("registry emitter", () => {
	const registryEntries: RegistryEntry[] = [...REGISTRY_SCENARIO.entries];

	function createRuntimeModuleSource(args: {
		exportName: string;
		id: string;
	}): string {
		return `export const ${args.exportName} = { id: ${JSON.stringify(args.id)} };\n`;
	}

	function writeRuntimeRegistryModules(tempDirectory: string): void {
		const runtimeModules = [
			{
				fileName: CODEGEN_EMIT_PATHS.inventoryItemsModuleJs,
				exportName: "InventoryItems",
				id: "inventory-items",
			},
			{
				fileName: CODEGEN_EMIT_PATHS.customerOrdersModuleJs,
				exportName: "CustomerOrders",
				id: "customer-orders",
			},
		] as const;

		for (const moduleDef of runtimeModules) {
			writeFileSync(
				join(tempDirectory, moduleDef.fileName),
				createRuntimeModuleSource({
					exportName: moduleDef.exportName,
					id: moduleDef.id,
				}),
			);
		}
	}

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

	// Checks generated JavaScript exports a working registry object at runtime.
	test("emits JavaScript registry that can be imported at runtime", async () => {
		const tempDirectory = createTempWorkspace("orm-registry-");
		writeRuntimeRegistryModules(tempDirectory);

		const indexTsPath = join(tempDirectory, CODEGEN_EMIT_PATHS.indexTs);
		const indexJsPath = join(tempDirectory, CODEGEN_EMIT_PATHS.indexJs);
		// emitRegistryModuleArtifacts arguments:
		// - registryName/entries: define exported registry shape
		// - tsPath/jsPath: target artifact file locations
		emitRegistryModuleArtifacts({
			registryName: REGISTRY_SCENARIO.registryName,
			entries: registryEntries,
			tsPath: indexTsPath,
			jsPath: indexJsPath,
		});

		const importedModule = await import(pathToFileURL(indexJsPath).href);
		expect(importedModule.items.inventoryItems.id).toBe("inventory-items");
		expect(importedModule.items.customerOrders.id).toBe("customer-orders");
	});
});
