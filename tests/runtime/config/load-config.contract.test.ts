import { afterEach, describe, expect, test } from "bun:test";
import {
	clearConfigCache,
	getNotionConfig,
	loadConfig,
} from "../../../src/config/loadConfig";
import { CODEGEN_EMIT_PATHS } from "../../helpers/codegen-file-names";
import {
	MOCK_DATA_SOURCE_ID,
	MOCK_DATA_SOURCE_ID_B,
} from "../../helpers/test-mock-ids";
import {
	cleanupTempWorkspaces,
	createTempWorkspace,
	writeWorkspaceFile,
} from "../../helpers/temp-workspace";

const ORIGINAL_CWD = process.cwd();
const ORIGINAL_NOTION_KEY = process.env.NOTION_KEY;
const ORIGINAL_NODE_ENV = process.env.NODE_ENV;

afterEach(() => {
	process.chdir(ORIGINAL_CWD);
	if (ORIGINAL_NOTION_KEY === undefined) {
		delete process.env.NOTION_KEY;
	} else {
		process.env.NOTION_KEY = ORIGINAL_NOTION_KEY;
	}
	if (ORIGINAL_NODE_ENV === undefined) {
		delete process.env.NODE_ENV;
	} else {
		process.env.NODE_ENV = ORIGINAL_NODE_ENV;
	}
	clearConfigCache();
	cleanupTempWorkspaces();
});

describe("config loading contracts", () => {
	test("loadConfig parses a valid user config module", async () => {
		const workspacePath = createTempWorkspace("config-load-valid-");
		const configPath = writeWorkspaceFile({
			workspacePath,
			relativePath: CODEGEN_EMIT_PATHS.notionConfigMjs,
			content: [
				"export default {",
				"  auth: 'token-123',",
				`  databases: ['${MOCK_DATA_SOURCE_ID}'],`,
				"  agents: ['agent-1'],",
				"};",
			].join("\n"),
		});

		const config = await loadConfig(configPath);
		expect(config).toEqual({
			auth: "token-123",
			databases: [MOCK_DATA_SOURCE_ID],
			agents: ["agent-1"],
		});
	});

	test("loadConfig rejects invalid config shapes with stable messages", async () => {
		const workspacePath = createTempWorkspace("config-load-invalid-");
		const configPath = writeWorkspaceFile({
			workspacePath,
			relativePath: CODEGEN_EMIT_PATHS.notionConfigMjs,
			content: [
				"export default {",
				"  auth: '',",
				"  databases: 'not-an-array',",
				"  agents: [],",
				"};",
			].join("\n"),
		});

		await expect(loadConfig(configPath)).rejects.toThrow(
			"Invalid notion config shape",
		);
		await expect(loadConfig(configPath)).rejects.toThrow("auth");
	});

	test("getNotionConfig falls back to NOTION_KEY when no config file exists", async () => {
		const workspacePath = createTempWorkspace("config-env-fallback-");
		process.chdir(workspacePath);
		process.env.NOTION_KEY = "env-auth-token";

		const config = await getNotionConfig();
		expect(config).toEqual({
			auth: "env-auth-token",
			databases: [],
			agents: [],
		});
	});

	test("getNotionConfig loads NOTION_KEY from .env when shell env is absent", async () => {
		const workspacePath = createTempWorkspace("config-dotenv-fallback-");
		writeWorkspaceFile({
			workspacePath,
			relativePath: ".env",
			content: "NOTION_KEY=dotenv-auth-token\n",
		});
		process.chdir(workspacePath);
		delete process.env.NOTION_KEY;

		const config = await getNotionConfig();
		expect(config).toEqual({
			auth: "dotenv-auth-token",
			databases: [],
			agents: [],
		});
	});

	test("getNotionConfig loads NOTION_KEY from .env.local when .env is absent", async () => {
		const workspacePath = createTempWorkspace("config-dotenv-local-fallback-");
		writeWorkspaceFile({
			workspacePath,
			relativePath: ".env.local",
			content: "NOTION_KEY=dotenv-local-token\n",
		});
		process.chdir(workspacePath);
		delete process.env.NOTION_KEY;

		const config = await getNotionConfig();
		expect(config).toEqual({
			auth: "dotenv-local-token",
			databases: [],
			agents: [],
		});
	});

	test("getNotionConfig prefers .env.local over .env", async () => {
		const workspacePath = createTempWorkspace("config-dotenv-local-over-base-");
		writeWorkspaceFile({
			workspacePath,
			relativePath: ".env",
			content: "NOTION_KEY=dotenv-base-token\n",
		});
		writeWorkspaceFile({
			workspacePath,
			relativePath: ".env.local",
			content: "NOTION_KEY=dotenv-local-token\n",
		});
		process.chdir(workspacePath);
		delete process.env.NOTION_KEY;

		const config = await getNotionConfig();
		expect(config.auth).toBe("dotenv-local-token");
	});

	test("getNotionConfig prefers .env.<NODE_ENV> over .env", async () => {
		const workspacePath = createTempWorkspace("config-dotenv-env-over-base-");
		writeWorkspaceFile({
			workspacePath,
			relativePath: ".env",
			content: "NOTION_KEY=dotenv-base-token\n",
		});
		writeWorkspaceFile({
			workspacePath,
			relativePath: ".env.staging",
			content: "NOTION_KEY=dotenv-staging-token\n",
		});
		process.chdir(workspacePath);
		delete process.env.NOTION_KEY;
		process.env.NODE_ENV = "staging";

		const config = await getNotionConfig();
		expect(config.auth).toBe("dotenv-staging-token");
	});

	test("getNotionConfig prefers .env.<NODE_ENV>.local over all dotenv variants", async () => {
		const workspacePath = createTempWorkspace("config-dotenv-env-local-top-");
		writeWorkspaceFile({
			workspacePath,
			relativePath: ".env",
			content: "NOTION_KEY=dotenv-base-token\n",
		});
		writeWorkspaceFile({
			workspacePath,
			relativePath: ".env.local",
			content: "NOTION_KEY=dotenv-local-token\n",
		});
		writeWorkspaceFile({
			workspacePath,
			relativePath: ".env.staging",
			content: "NOTION_KEY=dotenv-staging-token\n",
		});
		writeWorkspaceFile({
			workspacePath,
			relativePath: ".env.staging.local",
			content: "NOTION_KEY=dotenv-staging-local-token\n",
		});
		process.chdir(workspacePath);
		delete process.env.NOTION_KEY;
		process.env.NODE_ENV = "staging";

		const config = await getNotionConfig();
		expect(config.auth).toBe("dotenv-staging-local-token");
	});

	test("getNotionConfig honors cache until clearConfigCache is called", async () => {
		const workspacePath = createTempWorkspace("config-cache-");
		process.chdir(workspacePath);

		process.env.NOTION_KEY = "cached-token";
		const first = await getNotionConfig();

		process.env.NOTION_KEY = "new-token";
		const second = await getNotionConfig();

		expect(first.auth).toBe("cached-token");
		expect(second.auth).toBe("cached-token");

		clearConfigCache();
		const third = await getNotionConfig();
		expect(third.auth).toBe("new-token");
	});

	test("getNotionConfig prefers project config file in cwd", async () => {
		const workspacePath = createTempWorkspace("config-cwd-file-");
		writeWorkspaceFile({
			workspacePath,
			relativePath: CODEGEN_EMIT_PATHS.notionConfigMjs,
			content: [
				"export default {",
				"  auth: 'config-auth-token',",
				`  databases: ['${MOCK_DATA_SOURCE_ID}', '${MOCK_DATA_SOURCE_ID_B}'],`,
				"  agents: ['agent-1'],",
				"};",
			].join("\n"),
		});
		process.chdir(workspacePath);
		process.env.NOTION_KEY = "env-fallback-should-not-win";

		const config = await getNotionConfig();
		expect(config.auth).toBe("config-auth-token");
		expect(config.databases).toEqual([
			MOCK_DATA_SOURCE_ID,
			MOCK_DATA_SOURCE_ID_B,
		]);
		expect(config.agents).toEqual(["agent-1"]);
	});

	test("getNotionConfig loads .env before importing notion.config", async () => {
		const workspacePath = createTempWorkspace("config-dotenv-module-");
		writeWorkspaceFile({
			workspacePath,
			relativePath: ".env",
			content: "NOTION_KEY=dotenv-module-token\n",
		});
		writeWorkspaceFile({
			workspacePath,
			relativePath: CODEGEN_EMIT_PATHS.notionConfigTs,
			content: [
				"const auth = process.env.NOTION_KEY || 'fallback-placeholder';",
				"export default {",
				"  auth,",
				`  databases: ['${MOCK_DATA_SOURCE_ID}'],`,
				"  agents: [],",
				"};",
			].join("\n"),
		});
		process.chdir(workspacePath);
		delete process.env.NOTION_KEY;

		const config = await getNotionConfig();
		expect(config.auth).toBe("dotenv-module-token");
		expect(config.databases).toEqual([MOCK_DATA_SOURCE_ID]);
		expect(config.agents).toEqual([]);
	});
});
