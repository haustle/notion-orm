import { afterEach, describe, expect, test } from "bun:test";
import { renderDatabaseModule } from "../../src/ast/database/database-file-writer";
import type { CodegenDiagnosticSink } from "../../src/ast/shared/codegen-diagnostics";
import {
	isSupportedPropertyType,
	SUPPORTED_PROPERTY_TYPES,
	type SupportedNotionColumnType,
} from "../../src/client/database/types";
import { objectKeys } from "../../src/typeUtils";
import {
	CODEGEN_EMIT_PATHS,
	CODEGEN_GOLDEN_FILES,
	codegenArtifactFileName,
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
afterEach((): void => undefined);

function renderFixture(fixture: DataSourceFixtureSpec) {
	return renderDatabaseModule(buildMockDataSourceResponse(fixture));
}

function renderFixtureWithDiagnostics(
	fixture: DataSourceFixtureSpec,
	onDiagnostic: CodegenDiagnosticSink,
) {
	return renderDatabaseModule(buildMockDataSourceResponse(fixture), {
		onDiagnostic,
	});
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

		test("produces TypeScript output that parses successfully", () => {
			expectCodeToParseAsValidTs({
				code: rendered.tsCode,
				fileName: codegenArtifactFileName(
					CODEGEN_EMIT_PATHS.customerOrdersModule,
					"typescript",
				),
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

		test("produces TypeScript output that parses successfully", () => {
			expectCodeToParseAsValidTs({
				code: rendered.tsCode,
				fileName: codegenArtifactFileName(
					CODEGEN_EMIT_PATHS.inventoryItemsModule,
					"typescript",
				),
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

		test("produces TypeScript output that parses successfully", () => {
			expectCodeToParseAsValidTs({
				code: rendered.tsCode,
				fileName: codegenArtifactFileName(
					CODEGEN_EMIT_PATHS.edgeCasesModule,
					"typescript",
				),
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

		test("reports skipped properties with standardized diagnostic lines when sink is provided", () => {
			const messages: string[] = [];
			renderFixtureWithDiagnostics(EDGE_CASES_FIXTURE, (d) => {
				messages.push(d.message);
			});
			expect(messages).toContain(
				"[Edge Cases] `Score` (formula) was skipped",
			);
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
