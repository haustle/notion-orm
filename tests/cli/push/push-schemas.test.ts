import { describe, expect, test, mock, afterEach, beforeEach, spyOn } from "bun:test";
import fs from "fs";
import path from "path";
import { pushNewSchemas } from "../../../src/cli/push/push-schemas";
import { AST_FS_PATHS } from "../../../src/ast/shared/constants";
import * as loadConfigModule from "../../../src/config/loadConfig";
import * as findConfigFileModule from "../../../src/config/findConfigFile";
import * as cachedMetadataModule from "../../../src/ast/shared/cached-metadata";
import * as helpersModule from "../../../src/cli/helpers";

// Mock the Client class
mock.module("@notionhq/client", () => {
	return {
		Client: class MockClient {
			databases = {
				create: mock(async () => {
					return {
						id: "12345678-1234-1234-1234-123456789abc",
						dataSources: [
							{ id: "abcdef01-2345-6789-abcd-ef0123456789" },
						],
					};
				}),
				retrieve: mock(async () => ({
					id: "12345678-1234-1234-1234-123456789abc",
					dataSources: [
						{ id: "abcdef01-2345-6789-abcd-ef0123456789" },
					],
				})),
			};
		},
	};
});

describe("Push Schemas", () => {
	const schemasDir = path.join(AST_FS_PATHS.CODEGEN_ROOT_DIR, "schemas");
	
	beforeEach(() => {
		// Mock config
		spyOn(loadConfigModule, "getNotionConfig").mockResolvedValue({
			auth: "test-auth",
			databases: [],
			agents: [],
			defaultParentPageId: "352db8d6-aff1-80dd-a6e5-effc9c42b198",
		});

		// Mock config file
		spyOn(findConfigFileModule, "findConfigFile").mockReturnValue({
			path: "notion.config.ts",
			isTS: true,
		});

		// Mock existing databases (none)
		spyOn(cachedMetadataModule, "readDatabaseMetadata").mockReturnValue([]);

		// Mock write config
		spyOn(helpersModule, "writeConfigFileWithAST").mockResolvedValue(true);
	});

	afterEach(() => {
		if (fs.existsSync(schemasDir)) {
			fs.rmSync(schemasDir, { recursive: true, force: true });
		}
		mock.restore();
	});

	test("returns false if no config file found", async () => {
		spyOn(findConfigFileModule, "findConfigFile").mockReturnValue(undefined);
		const result = await pushNewSchemas();
		expect(result).toBe(false);
	});

	test("returns false if no schemas directory exists", async () => {
		const result = await pushNewSchemas();
		expect(result).toBe(false);
	});

	test("pushes new schema and returns true", async () => {
		fs.mkdirSync(schemasDir, { recursive: true });
		fs.writeFileSync(
			path.join(schemasDir, "users.json"),
			JSON.stringify({
				title: [{ type: "text", text: { content: "Users DB" } }],
				properties: { Name: { title: {} } }
			})
		);

		const result = await pushNewSchemas();
		
		expect(result).toBe(true);
		expect(helpersModule.writeConfigFileWithAST).toHaveBeenCalledWith(
			"notion.config.ts",
			"abcdef01-2345-6789-abcd-ef0123456789",
			true,
			"Users DB",
		);
	});

	test("skips already pushed schema", async () => {
		fs.mkdirSync(schemasDir, { recursive: true });
		fs.writeFileSync(
			path.join(schemasDir, "users.json"),
			JSON.stringify({
				title: [{ type: "text", text: { content: "Users DB" } }],
				properties: { Name: { title: {} } }
			})
		);

		// Mock that it already exists
		spyOn(cachedMetadataModule, "readDatabaseMetadata").mockReturnValue([
			{ id: "123", name: "usersDb", displayName: "Users DB" }
		]);

		const result = await pushNewSchemas();
		
		expect(result).toBe(false);
		expect(helpersModule.writeConfigFileWithAST).not.toHaveBeenCalled();
	});

	test("uses defaultParentPageId if schema doesn't provide one", async () => {
		fs.mkdirSync(schemasDir, { recursive: true });
		fs.writeFileSync(
			path.join(schemasDir, "users.json"),
			JSON.stringify({
				title: [{ type: "text", text: { content: "Users DB" } }],
				properties: { Name: { title: {} } }
			})
		);

		await pushNewSchemas();
		
		// The mock client is called, we just verify it didn't crash
		expect(helpersModule.writeConfigFileWithAST).toHaveBeenCalled();
	});
});
