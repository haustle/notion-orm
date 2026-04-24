import { afterEach, describe, expect, test } from "bun:test";
import {
	resolveNotionAuth,
} from "../../src/config/resolveNotionAuth";
import {
	cleanupTempWorkspaces,
	createTempWorkspace,
	writeWorkspaceFile,
} from "../helpers/temp-workspace";

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
	cleanupTempWorkspaces();
});

describe("resolveNotionAuth", () => {
	test("returns trimmed auth from config when set", () => {
		delete process.env.NOTION_KEY;
		expect(resolveNotionAuth({ auth: "  abc  " })).toBe("abc");
	});

	test("falls back to NOTION_KEY when config auth is absent", () => {
		process.env.NOTION_KEY = "env-token";
		expect(resolveNotionAuth({})).toBe("env-token");
	});

	test("loads NOTION_KEY from .env in the current project root", () => {
		const workspacePath = createTempWorkspace("resolve-auth-dotenv-");
		writeWorkspaceFile({
			workspacePath,
			relativePath: ".env",
			content: "NOTION_KEY=dotenv-token\n",
		});
		process.chdir(workspacePath);
		delete process.env.NOTION_KEY;

		expect(resolveNotionAuth({})).toBe("dotenv-token");
	});

	test("loads NOTION_KEY from .env.local in the current project root", () => {
		const workspacePath = createTempWorkspace("resolve-auth-dotenv-local-");
		writeWorkspaceFile({
			workspacePath,
			relativePath: ".env.local",
			content: "NOTION_KEY=dotenv-local-token\n",
		});
		process.chdir(workspacePath);
		delete process.env.NOTION_KEY;

		expect(resolveNotionAuth({})).toBe("dotenv-local-token");
	});

	test("prefers shell NOTION_KEY over the same key in .env", () => {
		const workspacePath = createTempWorkspace("resolve-auth-shell-over-dotenv-");
		writeWorkspaceFile({
			workspacePath,
			relativePath: ".env",
			content: "NOTION_KEY=dotenv-token\n",
		});
		process.chdir(workspacePath);
		process.env.NOTION_KEY = "shell-token";

		expect(resolveNotionAuth({})).toBe("shell-token");
	});

	test("prefers explicit config over environment", () => {
		process.env.NOTION_KEY = "env-token";
		expect(resolveNotionAuth({ auth: "from-config" })).toBe("from-config");
	});

	test("treats empty or whitespace-only config auth as unset", () => {
		process.env.NOTION_KEY = "env-token";
		expect(resolveNotionAuth({ auth: "" })).toBe("env-token");
		expect(resolveNotionAuth({ auth: "   " })).toBe("env-token");
	});

	test("throws a clear error when nothing is available", () => {
		delete process.env.NOTION_KEY;
		expect(() => resolveNotionAuth({})).toThrow(/Missing Notion API credentials/);
		expect(() => resolveNotionAuth({})).toThrow(/NOTION_KEY/);
	});
});
