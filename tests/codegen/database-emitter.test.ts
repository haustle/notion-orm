import { afterEach, describe, expect, test } from "bun:test";
import { join } from "path";
import { pathToFileURL } from "url";
import { renderDatabaseModule } from "../../src/ast/database/database-file-writer";
import {
	isSupportedPropertyType,
	SUPPORTED_PROPERTY_TYPES,
	type SupportedNotionColumnType,
} from "../../src/client/queryTypes";
import { objectKeys } from "../../src/typeUtils";
import {
	CODEGEN_EMIT_PATHS,
	CODEGEN_GOLDEN_FILES,
	CODEGEN_TEST_PATHS,
} from "../helpers/codegen-file-names";
import {
	ALL_DATABASE_FIXTURES,
	buildMockDataSourceResponse,
	CUSTOMER_ORDERS_FIXTURE,
	type DataSourceFixtureSpec,
	EDGE_CASES_FIXTURE,
	INVENTORY_ITEMS_FIXTURE,
} from "../helpers/datasource-fixture-builder";
import {
	expectCodeToParseAsValidJs,
	expectCodeToParseAsValidTs,
	readGolden,
} from "../helpers/golden-code-assertions";
import {
	cleanupTempWorkspaces,
	createTempWorkspace,
	writeWorkspaceFile,
} from "../helpers/temp-workspace";

afterEach(() => {
	cleanupTempWorkspaces();
});

function renderFixture(fixture: DataSourceFixtureSpec) {
	return renderDatabaseModule(buildMockDataSourceResponse(fixture));
}

// ---------------------------------------------------------------------------
// Golden comparison tests
// ---------------------------------------------------------------------------

describe("database module emitter", () => {
	describe("customerOrders", () => {
		const rendered = renderFixture(CUSTOMER_ORDERS_FIXTURE);

		test("returns normalized metadata for the customerOrders fixture", () => {
			expect(rendered.databaseName).toBe("Customer Orders");
			expect(rendered.databaseModuleName).toBe("customerOrders");
			expect(rendered.databaseId).toBe("a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4");
		});

		test("emits TypeScript source that matches the customerOrders golden", () => {
			const golden = readGolden(CODEGEN_GOLDEN_FILES.dbCustomerOrdersTs);
			expect(rendered.tsCode).toBe(golden);
		});

		test("emits JavaScript source that matches the customerOrders golden", () => {
			const golden = readGolden(CODEGEN_GOLDEN_FILES.dbCustomerOrdersJs);
			expect(rendered.jsCode).toBe(golden);
		});

		test("produces TypeScript output that parses successfully", () => {
			expectCodeToParseAsValidTs({
				code: rendered.tsCode,
				fileName: CODEGEN_EMIT_PATHS.customerOrdersModuleTs,
			});
		});

		test("produces JavaScript output that parses successfully", () => {
			expectCodeToParseAsValidJs({
				code: rendered.jsCode,
				fileName: CODEGEN_EMIT_PATHS.customerOrdersModuleJs,
			});
		});
	});

	describe("inventoryItems", () => {
		const rendered = renderFixture(INVENTORY_ITEMS_FIXTURE);

		test("returns normalized metadata for the inventoryItems fixture", () => {
			expect(rendered.databaseName).toBe("Inventory Items");
			expect(rendered.databaseModuleName).toBe("inventoryItems");
			expect(rendered.databaseId).toBe("b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5");
		});

		test("emits TypeScript source that matches the inventoryItems golden", () => {
			const golden = readGolden(CODEGEN_GOLDEN_FILES.dbInventoryItemsTs);
			expect(rendered.tsCode).toBe(golden);
		});

		test("emits JavaScript source that matches the inventoryItems golden", () => {
			const golden = readGolden(CODEGEN_GOLDEN_FILES.dbInventoryItemsJs);
			expect(rendered.jsCode).toBe(golden);
		});

		test("produces TypeScript output that parses successfully", () => {
			expectCodeToParseAsValidTs({
				code: rendered.tsCode,
				fileName: CODEGEN_EMIT_PATHS.inventoryItemsModuleTs,
			});
		});

		test("produces JavaScript output that parses successfully", () => {
			expectCodeToParseAsValidJs({
				code: rendered.jsCode,
				fileName: CODEGEN_EMIT_PATHS.inventoryItemsModuleJs,
			});
		});
	});

	describe("edgeCases", () => {
		const rendered = renderFixture(EDGE_CASES_FIXTURE);

		test("returns normalized metadata for the edgeCases fixture", () => {
			expect(rendered.databaseName).toBe("Edge Cases");
			expect(rendered.databaseModuleName).toBe("edgeCases");
			expect(rendered.databaseId).toBe("c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6");
		});

		test("emits TypeScript source that matches the edgeCases golden", () => {
			const golden = readGolden(CODEGEN_GOLDEN_FILES.dbEdgeCasesTs);
			expect(rendered.tsCode).toBe(golden);
		});

		test("emits JavaScript source that matches the edgeCases golden", () => {
			const golden = readGolden(CODEGEN_GOLDEN_FILES.dbEdgeCasesJs);
			expect(rendered.jsCode).toBe(golden);
		});

		test("produces TypeScript output that parses successfully", () => {
			expectCodeToParseAsValidTs({
				code: rendered.tsCode,
				fileName: CODEGEN_EMIT_PATHS.edgeCasesModuleTs,
			});
		});

		test("produces JavaScript output that parses successfully", () => {
			expectCodeToParseAsValidJs({
				code: rendered.jsCode,
				fileName: CODEGEN_EMIT_PATHS.edgeCasesModuleJs,
			});
		});

		test("skips unsupported formula and rollup properties from emitted output", () => {
			expect(rendered.tsCode).not.toContain("score");
			expect(rendered.tsCode).not.toContain("Score");
			expect(rendered.tsCode).not.toContain("formula");
			expect(rendered.tsCode).not.toContain("summary");
			expect(rendered.tsCode).not.toContain("Summary");
			expect(rendered.tsCode).not.toContain("rollup");
		});
	});

	// -----------------------------------------------------------------------
	// Runtime import tests -- emitted JS can actually be loaded
	// -----------------------------------------------------------------------

	describe("runtime import", () => {
		function writeDependencyStubs(workspacePath: string): void {
			writeWorkspaceFile({
				workspacePath,
				relativePath: CODEGEN_TEST_PATHS.notionOrmModuleIndexJs,
				content:
					"class DatabaseClient { constructor(args) { this.args = args; } }\nmodule.exports = { DatabaseClient };\n",
			});
			writeWorkspaceFile({
				workspacePath,
				relativePath: CODEGEN_TEST_PATHS.zodModuleIndexJs,
				content: [
					"const handler = { get(_, prop) { return prop === 'object' ? (o) => chain : (...a) => chain; }, };",
					"const chain = new Proxy({}, handler);",
					"module.exports = { z: new Proxy({}, handler) };",
				].join("\n"),
			});
		}

		test("loads emitted JavaScript and exposes the expected runtime exports", async () => {
			const tempDir = createTempWorkspace("orm-db-golden-");
			const rendered = renderFixture(CUSTOMER_ORDERS_FIXTURE);

			writeDependencyStubs(tempDir);
			writeWorkspaceFile({
				workspacePath: tempDir,
				relativePath: CODEGEN_EMIT_PATHS.customerOrdersModuleJs,
				content: rendered.jsCode,
			});

			const jsPath = join(tempDir, CODEGEN_EMIT_PATHS.customerOrdersModuleJs);
			const mod = await import(pathToFileURL(jsPath).href);

			expect(mod.CustomerOrdersSchema).toBeDefined();
			expect(typeof mod.customerOrders).toBe("function");
		});
	});
});

// ---------------------------------------------------------------------------
// Property coverage guard
// ---------------------------------------------------------------------------

describe("property type coverage", () => {
	const supportedTypes = objectKeys(SUPPORTED_PROPERTY_TYPES).filter(
		(type): type is SupportedNotionColumnType => isSupportedPropertyType(type),
	);

	const fixturePropertyTypes = new Set<string>();
	for (const fixture of Object.values(ALL_DATABASE_FIXTURES)) {
		for (const prop of Object.values(fixture.properties)) {
			fixturePropertyTypes.add(prop.type);
		}
	}

	test("covers every supported property type with at least one fixture", () => {
		const missing = supportedTypes.filter(
			(type) => !fixturePropertyTypes.has(type),
		);
		expect(missing).toEqual([]);
	});

	test("keeps rollup present in fixtures while remaining intentionally unsupported", () => {
		expect(fixturePropertyTypes.has("rollup")).toBe(true);
		expect(SUPPORTED_PROPERTY_TYPES.rollup).toBe(false);
	});

	test("keeps formula present in fixtures while remaining intentionally unsupported", () => {
		expect(fixturePropertyTypes.has("formula")).toBe(true);
		expect(SUPPORTED_PROPERTY_TYPES.formula).toBe(false);
	});
});
