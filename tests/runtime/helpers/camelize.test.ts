import { describe, expect, test } from "bun:test";
import {
	camelize,
	toDashedNotionId,
	toUndashedNotionId,
} from "../../../src/helpers";

describe("camelize", () => {
	test("normalizes acronym words into stable camelCase", () => {
		expect(camelize("Has WiFi")).toBe("hasWifi");
		expect(camelize("WiFi")).toBe("wifi");
		expect(camelize("API Key")).toBe("apiKey");
		expect(camelize("URL Value")).toBe("urlValue");
	});

	test("handles punctuation and extra whitespace", () => {
		expect(camelize("  Coffee-Shop   Directory  ")).toBe("coffeeShopDirectory");
		expect(camelize("Menu & Recipes")).toBe("menuRecipes");
	});
});

describe("toUndashedNotionId", () => {
	test("normalizes dashed and uppercase UUID values", () => {
		expect(toUndashedNotionId("12345678-1234-1234-1234-123456789ABC")).toBe(
			"12345678123412341234123456789abc",
		);
	});

	test("accepts canonical undashed 32-hex ids", () => {
		expect(toUndashedNotionId("12345678123412341234123456789abc")).toBe(
			"12345678123412341234123456789abc",
		);
	});

	test("trims surrounding whitespace", () => {
		expect(toUndashedNotionId("  12345678-1234-1234-1234-123456789abc  ")).toBe(
			"12345678123412341234123456789abc",
		);
	});

	test("rejects dashed ids that are not standard UUID segment shape", () => {
		expect(() =>
			toUndashedNotionId("12-34-56-78-9a-bc-de-f0-12-34-56-78-9a-bc-de-f0"),
		).toThrow("UUID shape");
	});

	test("rejects wrong length undashed hex", () => {
		expect(() => toUndashedNotionId("1234567890123456789012345678901")).toThrow(
			"32 hexadecimal",
		);
	});

	test("rejects empty and whitespace-only strings", () => {
		expect(() => toUndashedNotionId("")).toThrow("non-empty");
		expect(() => toUndashedNotionId("   ")).toThrow("non-empty");
	});
});

describe("toDashedNotionId", () => {
	test("formats undashed IDs as dashed UUID values", () => {
		expect(toDashedNotionId("12345678123412341234123456789abc")).toBe(
			"12345678-1234-1234-1234-123456789abc",
		);
	});

	test("throws for invalid UUID values", () => {
		expect(() => toDashedNotionId("not-a-valid-id")).toThrow(
			"Invalid Notion ID",
		);
	});
});
