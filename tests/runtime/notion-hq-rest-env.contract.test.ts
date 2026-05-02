import { afterEach, describe, expect, test } from "bun:test";
import {
	NOTION_BASE_URL_ENV,
	NOTION_LEGACY_REST_BASE_URL_ENV,
	resolveNotionApiBaseUrl,
} from "../../src/config/notionHqRestEnv";
import {
	cleanupTempWorkspaces,
	createTempWorkspace,
	writeWorkspaceFile,
} from "../helpers/temp-workspace";

const ORIGINAL_CWD = process.cwd();
const ORIGINAL_BASE = process.env[NOTION_BASE_URL_ENV];
const ORIGINAL_LEGACY = process.env[NOTION_LEGACY_REST_BASE_URL_ENV];

afterEach(() => {
	process.chdir(ORIGINAL_CWD);
	if (ORIGINAL_BASE === undefined) {
		delete process.env[NOTION_BASE_URL_ENV];
	} else {
		process.env[NOTION_BASE_URL_ENV] = ORIGINAL_BASE;
	}
	if (ORIGINAL_LEGACY === undefined) {
		delete process.env[NOTION_LEGACY_REST_BASE_URL_ENV];
	} else {
		process.env[NOTION_LEGACY_REST_BASE_URL_ENV] = ORIGINAL_LEGACY;
	}
	cleanupTempWorkspaces();
});

describe("notion HQ REST env (resolveNotionApiBaseUrl)", () => {
	test("returns undefined when unset so the SDK default applies", () => {
		delete process.env[NOTION_BASE_URL_ENV];
		delete process.env[NOTION_LEGACY_REST_BASE_URL_ENV];
		expect(resolveNotionApiBaseUrl()).toBeUndefined();
	});

	test(`loads ${NOTION_BASE_URL_ENV}`, () => {
		delete process.env[NOTION_LEGACY_REST_BASE_URL_ENV];
		process.env[NOTION_BASE_URL_ENV] = "https://preferred.example";
		expect(resolveNotionApiBaseUrl()).toBe("https://preferred.example");
	});

	test("strips trailing slashes", () => {
		delete process.env[NOTION_LEGACY_REST_BASE_URL_ENV];
		process.env[NOTION_BASE_URL_ENV] = "https://mock.local///";
		expect(resolveNotionApiBaseUrl()).toBe("https://mock.local");
	});

	test(`${NOTION_BASE_URL_ENV} wins over ${NOTION_LEGACY_REST_BASE_URL_ENV}`, () => {
		process.env[NOTION_BASE_URL_ENV] = "https://preferred.example";
		process.env[NOTION_LEGACY_REST_BASE_URL_ENV] = "https://legacy.example";
		expect(resolveNotionApiBaseUrl()).toBe("https://preferred.example");
	});

	test(`${NOTION_LEGACY_REST_BASE_URL_ENV} when primary is unset`, () => {
		delete process.env[NOTION_BASE_URL_ENV];
		process.env[NOTION_LEGACY_REST_BASE_URL_ENV] = "https://legacy.example/";
		expect(resolveNotionApiBaseUrl()).toBe("https://legacy.example");
	});

	test(`reads ${NOTION_BASE_URL_ENV} from .env in the cwd`, () => {
		const workspacePath = createTempWorkspace("resolve-rest-origin-dotenv-");
		writeWorkspaceFile({
			workspacePath,
			relativePath: ".env",
			content: `${NOTION_BASE_URL_ENV}=https://dotenv.example\n`,
		});
		process.chdir(workspacePath);
		delete process.env[NOTION_BASE_URL_ENV];
		delete process.env[NOTION_LEGACY_REST_BASE_URL_ENV];

		expect(resolveNotionApiBaseUrl()).toBe("https://dotenv.example");
	});
});
