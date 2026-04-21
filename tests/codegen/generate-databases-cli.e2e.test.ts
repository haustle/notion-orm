import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { readDatabaseMetadata } from "../../src/ast/shared/cached-metadata";
import {
	AST_FS_PATHS,
	codegenIndexSourcePath,
} from "../../src/ast/shared/constants";
import { clearConfigCache } from "../../src/config/loadConfig";
import { resolveCodegenEnvironment } from "../../src/ast/shared/codegen-environment";
import {
	CODEGEN_EMIT_PATHS,
	codegenArtifactFileName,
} from "../helpers/codegen-file-names";
import {
	buildMockDataSourceResponse,
	CUSTOMER_ORDERS_FIXTURE,
	EDGE_CASES_FIXTURE,
	INVENTORY_ITEMS_FIXTURE,
} from "../helpers/datasource-fixture-builder";
import { installCodegenRetrieveOnlyNotionClientMock } from "../helpers/notion-client-test-mock";
import {
	cleanupTempWorkspaces,
	createTempWorkspace,
	writeWorkspaceFile,
} from "../helpers/temp-workspace";

const ORIGINAL_CWD = process.cwd();
const retrieveDataSourceMock = mock(
	async (_args: { data_source_id: string }) => {
		return buildMockDataSourceResponse(CUSTOMER_ORDERS_FIXTURE);
	},
);

installCodegenRetrieveOnlyNotionClientMock(retrieveDataSourceMock);

const { createDatabaseTypes } = await import(
	"../../src/ast/database/generate-databases-cli"
);

function writeConfigFile(args: {
	workspacePath: string;
	databases: string[];
	agents?: string[];
	auth?: string;
	configFileName?:
		| typeof CODEGEN_EMIT_PATHS.notionConfigTs
		| typeof CODEGEN_EMIT_PATHS.notionConfigMjs;
}) {
	writeWorkspaceFile({
		workspacePath: args.workspacePath,
		relativePath: args.configFileName ?? CODEGEN_EMIT_PATHS.notionConfigMjs,
		content: [
			"export default {",
			`  auth: '${args.auth ?? "token-123"}',`,
			`  databases: ${JSON.stringify(args.databases)},`,
			`  agents: ${JSON.stringify(args.agents ?? [])},`,
			"};",
		].join("\n"),
	});
}

describe("generate-databases-cli e2e orchestration", () => {
	beforeEach(() => {
		retrieveDataSourceMock.mockReset();
		clearConfigCache();
	});

	afterEach(() => {
		process.chdir(ORIGINAL_CWD);
		clearConfigCache();
		cleanupTempWorkspaces();
	});

	test("full generation emits metadata, db modules, and registry barrel", async () => {
		const workspacePath = createTempWorkspace("db-generate-e2e-all-");
		process.chdir(workspacePath);

		writeConfigFile({
			workspacePath,
			databases: [CUSTOMER_ORDERS_FIXTURE.id, INVENTORY_ITEMS_FIXTURE.id],
			configFileName: CODEGEN_EMIT_PATHS.notionConfigTs,
		});
		writeWorkspaceFile({
			workspacePath,
			relativePath: "tsconfig.json",
			content: JSON.stringify({ compilerOptions: { target: "ES2022" } }, null, 2),
		});

		retrieveDataSourceMock.mockImplementation(async (args) => {
			if (args.data_source_id === CUSTOMER_ORDERS_FIXTURE.id) {
				return buildMockDataSourceResponse(CUSTOMER_ORDERS_FIXTURE);
			}
			if (args.data_source_id === INVENTORY_ITEMS_FIXTURE.id) {
				return buildMockDataSourceResponse(INVENTORY_ITEMS_FIXTURE);
			}
			throw new Error(`Unexpected data_source_id: ${args.data_source_id}`);
		});

		const progressEvents: Array<{ completed: number; total: number }> = [];
		const output = await createDatabaseTypes({
			type: "all",
			skipSourceIndexUpdate: true,
			onProgress: (progress) => progressEvents.push(progress),
		});

		expect(output.databaseKeys).toEqual(["customerOrders", "inventoryItems"]);
		expect(output.databaseNames).toEqual([
			"Customer Orders",
			"Inventory Items",
		]);
		expect(progressEvents).toEqual([
			{ completed: 0, total: 2 },
			{ completed: 1, total: 2 },
			{ completed: 2, total: 2 },
		]);

		const metadata = readDatabaseMetadata();
		expect(metadata.map((entry) => entry.name)).toEqual([
			"customerOrders",
			"inventoryItems",
		]);

		expect(
			existsSync(
				join(AST_FS_PATHS.DATABASES_DIR, codegenArtifactFileName(
					CODEGEN_EMIT_PATHS.customerOrdersModule,
					"typescript",
				)),
			),
		).toBe(true);
		expect(
			existsSync(
				join(
					AST_FS_PATHS.DATABASES_DIR,
					codegenArtifactFileName(
						CODEGEN_EMIT_PATHS.inventoryItemsModule,
						"typescript",
					),
				),
			),
		).toBe(true);
		expect(
			existsSync(
				codegenIndexSourcePath({
					scope: "databases",
					environment: "typescript",
				}),
			),
		).toBe(true);
	});

	test("typescript projects emit .ts generated modules", async () => {
		const workspacePath = createTempWorkspace("db-generate-e2e-ts-env-");
		process.chdir(workspacePath);

		writeConfigFile({
			workspacePath,
			databases: [CUSTOMER_ORDERS_FIXTURE.id],
			configFileName: CODEGEN_EMIT_PATHS.notionConfigTs,
		});
		writeWorkspaceFile({
			workspacePath,
			relativePath: "tsconfig.json",
			content: JSON.stringify(
				{
					compilerOptions: {
						target: "ES2022",
					},
				},
				null,
				2,
			),
		});

		expect(resolveCodegenEnvironment({ configRuntime: { isTS: true } })).toBe(
			"typescript",
		);

		retrieveDataSourceMock.mockImplementation(async () =>
			buildMockDataSourceResponse(CUSTOMER_ORDERS_FIXTURE),
		);

		await createDatabaseTypes({
			type: "all",
			skipSourceIndexUpdate: false,
		});

		expect(
			existsSync(
				join(AST_FS_PATHS.DATABASES_DIR, codegenArtifactFileName(
					CODEGEN_EMIT_PATHS.customerOrdersModule,
					"typescript",
				)),
			),
		).toBe(true);
		expect(
			existsSync(
				join(AST_FS_PATHS.DATABASES_DIR, codegenArtifactFileName(
					CODEGEN_EMIT_PATHS.customerOrdersModule,
					"javascript",
				)),
			),
		).toBe(false);
		expect(
			existsSync(
				codegenIndexSourcePath({
					scope: "databases",
					environment: "typescript",
				}),
			),
		).toBe(true);
		expect(
			existsSync(
				codegenIndexSourcePath({
					scope: "databases",
					environment: "javascript",
				}),
			),
		).toBe(false);
		expect(
			existsSync(
				codegenIndexSourcePath({
					scope: "codegenRoot",
					environment: "typescript",
				}),
			),
		).toBe(true);
		expect(
			existsSync(
				codegenIndexSourcePath({
					scope: "codegenRoot",
					environment: "javascript",
				}),
			),
		).toBe(false);
		expect(existsSync(AST_FS_PATHS.buildIndexDts)).toBe(true);
	});

	test("javascript projects emit .js generated modules", async () => {
		const workspacePath = createTempWorkspace("db-generate-e2e-js-env-");
		process.chdir(workspacePath);

		writeConfigFile({
			workspacePath,
			databases: [CUSTOMER_ORDERS_FIXTURE.id],
			configFileName: CODEGEN_EMIT_PATHS.notionConfigMjs,
		});

		retrieveDataSourceMock.mockImplementation(async () =>
			buildMockDataSourceResponse(CUSTOMER_ORDERS_FIXTURE),
		);

		await createDatabaseTypes({
			type: "all",
			skipSourceIndexUpdate: false,
		});

		expect(
			existsSync(
				join(AST_FS_PATHS.DATABASES_DIR, codegenArtifactFileName(
					CODEGEN_EMIT_PATHS.customerOrdersModule,
					"javascript",
				)),
			),
		).toBe(true);
		expect(
			existsSync(
				join(AST_FS_PATHS.DATABASES_DIR, codegenArtifactFileName(
					CODEGEN_EMIT_PATHS.customerOrdersModule,
					"typescript",
				)),
			),
		).toBe(false);
		expect(
			existsSync(
				codegenIndexSourcePath({
					scope: "databases",
					environment: "javascript",
				}),
			),
		).toBe(true);
		expect(
			existsSync(
				codegenIndexSourcePath({
					scope: "databases",
					environment: "typescript",
				}),
			),
		).toBe(false);
		expect(
			existsSync(
				codegenIndexSourcePath({
					scope: "codegenRoot",
					environment: "javascript",
				}),
			),
		).toBe(true);
		expect(
			existsSync(
				codegenIndexSourcePath({
					scope: "codegenRoot",
					environment: "typescript",
				}),
			),
		).toBe(false);
		expect(existsSync(AST_FS_PATHS.buildIndexDts)).toBe(true);
	});

	test("incremental generation emits a single db and updates source index when enabled", async () => {
		const workspacePath = createTempWorkspace("db-generate-e2e-incremental-");
		process.chdir(workspacePath);

		writeConfigFile({
			workspacePath,
			databases: [CUSTOMER_ORDERS_FIXTURE.id],
			configFileName: CODEGEN_EMIT_PATHS.notionConfigTs,
		});
		writeWorkspaceFile({
			workspacePath,
			relativePath: "tsconfig.json",
			content: JSON.stringify({ compilerOptions: { target: "ES2022" } }, null, 2),
		});

		retrieveDataSourceMock.mockImplementation(async () =>
			buildMockDataSourceResponse(EDGE_CASES_FIXTURE),
		);

		const output = await createDatabaseTypes({
			type: "incremental",
			id: EDGE_CASES_FIXTURE.id,
			onProgress: () => undefined,
		});

		expect(output.databaseKeys).toEqual(["edgeCases"]);
		expect(output.databaseNames).toEqual(["Edge Cases"]);
		expect(
			existsSync(
				join(
					AST_FS_PATHS.DATABASES_DIR,
					codegenArtifactFileName(
						CODEGEN_EMIT_PATHS.edgeCasesModule,
						"typescript",
					),
				),
			),
		).toBe(true);
		expect(
			existsSync(
				codegenIndexSourcePath({
					scope: "codegenRoot",
					environment: "typescript",
				}),
			),
		).toBe(true);
		expect(existsSync(AST_FS_PATHS.buildIndexDts)).toBe(true);
	});
});
