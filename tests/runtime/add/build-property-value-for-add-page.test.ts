import { describe, expect, test } from "bun:test";
import { buildPropertyValueForAddPage } from "../../../src/client/database/create";

describe("buildPropertyValueForAddPage transformed property shape validation", () => {
	test("validates transformed property shape: select", () => {
		expect(
			buildPropertyValueForAddPage({
				type: "select",
				value: "Downtown",
			}),
		).toEqual({ select: { name: "Downtown" } });
	});

	test("validates transformed property shape: multi_select", () => {
		expect(
			buildPropertyValueForAddPage({
				type: "multi_select",
				value: ["quiet", "brunch"],
			}),
		).toEqual({ multi_select: [{ name: "quiet" }, { name: "brunch" }] });
	});

	test("validates transformed property shape: status", () => {
		expect(
			buildPropertyValueForAddPage({
				type: "status",
				value: "Want to Go",
			}),
		).toEqual({ status: { name: "Want to Go" } });
	});

	test("validates transformed property shape: number", () => {
		expect(
			buildPropertyValueForAddPage({
				type: "number",
				value: 5,
			}),
		).toEqual({ number: 5 });
	});

	test("validates transformed property shape: email", () => {
		expect(
			buildPropertyValueForAddPage({
				type: "email",
				value: "hello@coffee.dev",
			}),
		).toEqual({ email: "hello@coffee.dev" });
	});

	test("validates transformed property shape: date", () => {
		expect(
			buildPropertyValueForAddPage({
				type: "date",
				value: { start: "2026-03-01", end: "2026-03-02" },
			}),
		).toEqual({ date: { start: "2026-03-01", end: "2026-03-02" } });
	});

	test("validates transformed property shape: phone_number", () => {
		expect(
			buildPropertyValueForAddPage({
				type: "phone_number",
				value: "+1 555 222 1111",
			}),
		).toEqual({ phone_number: "+1 555 222 1111" });
	});

	test("validates transformed property shape: url", () => {
		expect(
			buildPropertyValueForAddPage({
				type: "url",
				value: "https://coffee.dev",
			}),
		).toEqual({ url: "https://coffee.dev" });
	});

	test("validates transformed property shape: checkbox", () => {
		expect(
			buildPropertyValueForAddPage({
				type: "checkbox",
				value: true,
			}),
		).toEqual({ checkbox: true });
	});

	test("validates transformed property shape: title", () => {
		expect(
			buildPropertyValueForAddPage({
				type: "title",
				value: "Blue Bottle",
			}),
		).toEqual({
			title: [{ text: { content: "Blue Bottle" } }],
		});
	});

	test("validates transformed property shape: rich_text", () => {
		expect(
			buildPropertyValueForAddPage({
				type: "rich_text",
				value: "Great espresso",
			}),
		).toEqual({
			rich_text: [{ text: { content: "Great espresso" } }],
		});
	});

	test("validates transformed property shape: people", () => {
		expect(
			buildPropertyValueForAddPage({
				type: "people",
				value: ["user-1", "user-2"],
			}),
		).toEqual({
			people: [{ id: "user-1" }, { id: "user-2" }],
		});
	});

	test("validates transformed property shape: relation", () => {
		expect(
			buildPropertyValueForAddPage({
				type: "relation",
				value: ["page-1", "page-2"],
			}),
		).toEqual({
			relation: [{ id: "page-1" }, { id: "page-2" }],
		});
	});

	test("validates transformed property shape: files", () => {
		expect(
			buildPropertyValueForAddPage({
				type: "files",
				value: [{ name: "menu.pdf", url: "https://files.dev/menu.pdf" }],
			}),
		).toEqual({
			files: [
				{
					name: "menu.pdf",
					type: "external",
					external: {
						url: "https://files.dev/menu.pdf",
					},
				},
			],
		});
	});

	test("normalizes nullable date end to undefined in transformed shape", () => {
		expect(
			buildPropertyValueForAddPage({
				type: "date",
				value: { start: "2026-03-01", end: null },
			}),
		).toEqual({ date: { start: "2026-03-01", end: undefined } });
	});

	test("throws descriptive error for unsupported add transformation", () => {
		expect(() =>
			buildPropertyValueForAddPage({
				type: "created_time",
				value: "2026-03-01T00:00:00.000Z",
			}),
		).toThrow("create() does not support property type 'created_time'");
	});

	test("throws descriptive error for invalid value shape on supported type", () => {
		expect(() =>
			buildPropertyValueForAddPage({
				type: "number",
				value: "not-a-number",
			}),
		).toThrow("create() received invalid value for property type 'number'");
	});

	test("throws descriptive error for invalid multi_select item types", () => {
		expect(() =>
			buildPropertyValueForAddPage({
				type: "multi_select",
				value: [{ name: "brief.pdf", url: "https://files.dev/brief.pdf" }],
			}),
		).toThrow(
			"create() received invalid value for property type 'multi_select'",
		);
	});

	test("throws descriptive error for invalid files value shape", () => {
		expect(() =>
			buildPropertyValueForAddPage({
				type: "files",
				value: ["https://files.dev/menu.pdf"],
			}),
		).toThrow("create() received invalid value for property type 'files'");
	});
});
