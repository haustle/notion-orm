import { afterEach, describe, expect, test } from "bun:test";
import {
	NOTION_BASE_URL_KEY,
	NOTION_DEFAULT_BASE_URL,
	resolveNotionApiBaseUrl,
} from "../../src/config/notionHqRestEnv";
import {
	cleanupTempWorkspaces,
	createTempWorkspace,
	writeWorkspaceFile,
} from "../helpers/temp-workspace";

const ORIGINAL_CWD = process.cwd();
const ORIGINAL_BASE = process.env[NOTION_BASE_URL_KEY];

afterEach(() => {
	process.chdir(ORIGINAL_CWD);
	if (ORIGINAL_BASE === undefined) {
		delete process.env[NOTION_BASE_URL_KEY];
	} else {
		process.env[NOTION_BASE_URL_KEY] = ORIGINAL_BASE;
	}
	cleanupTempWorkspaces();
});

describe("notion HQ REST env (resolveNotionApiBaseUrl)", () => {
	test("returns package default when unset", () => {
		delete process.env[NOTION_BASE_URL_KEY];
		expect(resolveNotionApiBaseUrl()).toBe(
			NOTION_DEFAULT_BASE_URL,
		);
	});

	test(`loads ${NOTION_BASE_URL_KEY}`, () => {
		process.env[NOTION_BASE_URL_KEY] = "https://preferred.example";
		expect(resolveNotionApiBaseUrl()).toBe("https://preferred.example");
	});

	test("strips trailing slashes", () => {
		process.env[NOTION_BASE_URL_KEY] = "https://mock.local///";
		expect(resolveNotionApiBaseUrl()).toBe("https://mock.local");
	});

	test(`reads ${NOTION_BASE_URL_KEY} from .env in the cwd`, () => {
		const workspacePath = createTempWorkspace("resolve-rest-origin-dotenv-");
		writeWorkspaceFile({
			workspacePath,
			relativePath: ".env",
			content: `${NOTION_BASE_URL_KEY}=https://dotenv.example\n`,
		});
		process.chdir(workspacePath);
		delete process.env[NOTION_BASE_URL_KEY];

		expect(resolveNotionApiBaseUrl()).toBe("https://dotenv.example");
	});

	test("treats blank env as default origin", () => {
		process.env[NOTION_BASE_URL_KEY] = "   ";
		expect(resolveNotionApiBaseUrl()).toBe(
			NOTION_DEFAULT_BASE_URL,
		);
	});
});
