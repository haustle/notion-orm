import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { buildOrmIndexModuleAst } from "../../src/ast/shared/emit/orm-index-emitter";
import { createEmitContext, printTsNodes } from "../../src/ast/shared/emit/ts-emit-core";
import { AST_RUNTIME_CONSTANTS } from "../../src/ast/shared/constants";
import { renderDatabaseModule } from "../../src/ast/database/database-file-writer";
import {
	buildMockDataSourceResponse,
	CUSTOMER_ORDERS_FIXTURE,
} from "../helpers/datasource-fixture-builder";
import {
	cleanupTempWorkspaces,
	createTempWorkspace,
	writeWorkspaceFile,
} from "../helpers/temp-workspace";

const tempDirs: string[] = [];

describe("generated consumer install compatibility", () => {
	test("generated TypeScript resolves package exports in a consumer-style typecheck", () => {
		try {
			const renderedDatabase = renderDatabaseModule(
				buildMockDataSourceResponse(CUSTOMER_ORDERS_FIXTURE),
			);
			assert.match(renderedDatabase.tsCode, /from "@haustle\/notion-orm"/);

			const notionWorkspace = createTempWorkspace("generated-consumer-notion-");
			writeWorkspaceFile({
				workspacePath: notionWorkspace,
				relativePath: "notion/databases/CustomerOrders.ts",
				content: renderedDatabase.tsCode,
			});

			const generatedIndexTs = printTsNodes({
				nodes: buildOrmIndexModuleAst({
					databases: [{ name: renderedDatabase.databaseModuleName }],
					agents: [],
					syncCommand: AST_RUNTIME_CONSTANTS.CLI_GENERATE_COMMAND,
				}),
				context: createEmitContext({ fileName: "index.ts" }),
			});
			writeWorkspaceFile({
				workspacePath: notionWorkspace,
				relativePath: "notion/index.ts",
				content: generatedIndexTs,
			});

			const consumerPath = mkdtempSync(
				join(tmpdir(), "orm-consumer-typecheck-"),
			);
			tempDirs.push(consumerPath);
			writeFileSync(
				join(consumerPath, "package.json"),
				JSON.stringify(
					{
						name: "orm-consumer-typecheck",
						private: true,
						type: "module",
						dependencies: {
							"@haustle/notion-orm": "file:/workspace",
						},
					devDependencies: {
						typescript: "^5.6.3",
					},
					},
					null,
					2,
				),
			);
			writeFileSync(
				join(consumerPath, "tsconfig.json"),
				JSON.stringify(
					{
						compilerOptions: {
							target: "ES2022",
							module: "NodeNext",
							moduleResolution: "NodeNext",
							strict: true,
							noEmit: true,
							esModuleInterop: true,
							skipLibCheck: true,
						},
						include: ["src", "notion"],
					},
					null,
					2,
				),
			);
			writeWorkspaceFile({
				workspacePath: consumerPath,
				relativePath: "src/app.ts",
				content: [
					'import { NotionORM } from "../notion/index.js";',
					'const notion = new NotionORM({ auth: "token" });',
					"void notion.databases.customerOrders;",
					"",
				].join("\n"),
			});
			writeWorkspaceFile({
				workspacePath: consumerPath,
				relativePath: "notion/index.ts",
				content: generatedIndexTs,
			});
			writeWorkspaceFile({
				workspacePath: consumerPath,
				relativePath: "notion/databases/CustomerOrders.ts",
				content: renderedDatabase.tsCode,
			});

			const install = spawnSync("npm", ["install", "--ignore-scripts"], {
				cwd: consumerPath,
				encoding: "utf-8",
			});
			assert.equal(install.status, 0, install.stderr || install.stdout);

			const typecheck = spawnSync(
				process.platform === "win32"
					? join(consumerPath, "node_modules", ".bin", "tsc.cmd")
					: join(consumerPath, "node_modules", ".bin", "tsc"),
				["--noEmit", "-p", "tsconfig.json"],
				{
					cwd: consumerPath,
					encoding: "utf-8",
				},
			);
			assert.equal(
				typecheck.status,
				0,
				typecheck.stderr || typecheck.stdout,
			);
		} finally {
			cleanupTempWorkspaces();
			while (tempDirs.length > 0) {
				const tempDir = tempDirs.pop();
				if (!tempDir) {
					continue;
				}
				rmSync(tempDir, { recursive: true, force: true });
			}
		}
	});
});
