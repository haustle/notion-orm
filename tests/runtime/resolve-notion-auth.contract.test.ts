import { afterEach, describe, expect, test } from "bun:test";
import {
	resolveNotionAuth,
} from "../../src/config/resolveNotionAuth";

const ORIGINAL_NOTION_KEY = process.env.NOTION_KEY;

afterEach(() => {
	if (ORIGINAL_NOTION_KEY === undefined) {
		delete process.env.NOTION_KEY;
	} else {
		process.env.NOTION_KEY = ORIGINAL_NOTION_KEY;
	}
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
