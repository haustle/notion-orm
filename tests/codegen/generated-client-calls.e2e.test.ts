import { afterEach, describe, expect, mock, test } from "bun:test";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type {
	CreatePageParameters,
	QueryDataSourceParameters,
} from "@notionhq/client/build/src/api-endpoints";
import { renderDatabaseModule } from "../../src/ast/database/database-file-writer";
import {
	CODEGEN_EMIT_PATHS,
	CODEGEN_TEST_PATHS,
} from "../helpers/codegen-file-names";
import {
	buildMockDataSourceResponse,
	CUSTOMER_ORDERS_FIXTURE,
} from "../helpers/datasource-fixture-builder";
import { queryDataSourceListResponse } from "../helpers/query-data-source-response";
import { databasePropertyValue } from "../helpers/query-transform-fixtures";
import {
	cleanupTempWorkspaces,
	createTempWorkspace,
	writeWorkspaceFile,
} from "../helpers/temp-workspace";

const dataSourceQueryMock = mock(async (_call: QueryDataSourceParameters) =>
	queryDataSourceListResponse([
		{
			object: "page",
			id: "page-order-44",
			properties: {
				"Order Name": databasePropertyValue.title("Order #44"),
				Notes: databasePropertyValue.richText("fragile"),
				Total: databasePropertyValue.number(42),
				"Order Date": databasePropertyValue.date("2026-03-01"),
				Paid: databasePropertyValue.checkbox(true),
				"Customer Email": databasePropertyValue.email("buyer@example.com"),
				"Customer Phone": databasePropertyValue.phoneNumber("+1 555 111 1111"),
				"Receipt URL": databasePropertyValue.url("https://receipt.dev/44"),
			},
		},
	]),
);

const pagesCreateMock = mock(async (_call: CreatePageParameters) => ({
	id: "created-page-id",
}));

mock.module("@notionhq/client", () => {
	return {
		Client: class {
			public pages = {
				create: pagesCreateMock,
			};

			public dataSources = {
				query: dataSourceQueryMock,
			};

			constructor(_args: unknown) {}
		},
	};
});

afterEach(() => {
	dataSourceQueryMock.mockReset();
	pagesCreateMock.mockReset();
	cleanupTempWorkspaces();
});

describe("generated database client e2e calls", () => {
	test("generated customerOrders factory builds valid create/findMany call bodies", async () => {
		const rendered = renderDatabaseModule(
			buildMockDataSourceResponse(CUSTOMER_ORDERS_FIXTURE),
		);
		expect(rendered.jsCode).not.toContain("rollup");
		const workspacePath = createTempWorkspace("generated-client-calls-");
		const databaseClientSourcePath = join(
			process.cwd(),
			"src/client/DatabaseClient.ts",
		);
		const zodSourcePath = join(process.cwd(), "node_modules/zod");

		writeWorkspaceFile({
			workspacePath,
			relativePath: CODEGEN_EMIT_PATHS.customerOrdersModuleJs,
			content: rendered.jsCode,
		});
		writeWorkspaceFile({
			workspacePath,
			relativePath: CODEGEN_TEST_PATHS.notionOrmModuleIndexJs,
			content: `module.exports = require(${JSON.stringify(databaseClientSourcePath)});`,
		});
		writeWorkspaceFile({
			workspacePath,
			relativePath: CODEGEN_TEST_PATHS.zodModuleIndexJs,
			content: `module.exports = require(${JSON.stringify(zodSourcePath)});`,
		});

		const mod = await import(
			pathToFileURL(
				join(workspacePath, CODEGEN_EMIT_PATHS.customerOrdersModuleJs),
			).href
		);
		const dbClient = mod.customerOrders("token-123");

		await dbClient.create({
			properties: {
				orderName: "Order #44",
				notes: "fragile",
				total: 42,
				orderDate: { start: "2026-03-01" },
				paid: true,
				customerEmail: "buyer@example.com",
				customerPhone: "+1 555 111 1111",
				receiptUrl: "https://receipt.dev/44",
			},
		});
		await dbClient.findMany({
			where: {
				total: { greater_than: 10 },
			},
			sortBy: [{ property: "total", direction: "ascending" }],
		});

		expect(pagesCreateMock).toHaveBeenCalledTimes(1);
		expect(dataSourceQueryMock).toHaveBeenCalledTimes(1);

		const createCall = pagesCreateMock.mock.calls[0]?.[0];
		const queryCall = dataSourceQueryMock.mock.calls[0]?.[0];

		const createCallContract: CreatePageParameters = createCall;
		const queryCallContract: QueryDataSourceParameters = queryCall;
		expect(createCallContract.parent.type).toBe("data_source_id");
		expect(queryCallContract.data_source_id).toBe(
			"a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4",
		);

		expect(createCallContract.properties).toEqual({
			"Order Name": {
				title: [
					{
						text: {
							content: "Order #44",
						},
					},
				],
			},
			Notes: {
				rich_text: [
					{
						text: {
							content: "fragile",
						},
					},
				],
			},
			Total: { number: 42 },
			"Order Date": { date: { start: "2026-03-01" } },
			Paid: { checkbox: true },
			"Customer Email": { email: "buyer@example.com" },
			"Customer Phone": { phone_number: "+1 555 111 1111" },
			"Receipt URL": { url: "https://receipt.dev/44" },
		});
		expect(queryCallContract).toEqual({
			data_source_id: "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4",
			sorts: [{ property: "Total", direction: "ascending" }],
			filter: {
				property: "Total",
				number: {
					greater_than: 10,
				},
			},
		});
	});
});
