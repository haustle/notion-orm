import { describe, expect, test } from "bun:test";
import { resolveCheckbox } from "../../../src/client/query/response/checkbox";
import { resolveCreatedBy } from "../../../src/client/query/response/created_by";
import { resolveCreatedTime } from "../../../src/client/query/response/created_time";
import { resolveDate } from "../../../src/client/query/response/date";
import { resolveEmail } from "../../../src/client/query/response/email";
import { resolveFiles } from "../../../src/client/query/response/files";
import { resolveLastEditedBy } from "../../../src/client/query/response/last_edited_by";
import { resolveLastEditedTime } from "../../../src/client/query/response/last_edited_time";
import { resolveMultiSelect } from "../../../src/client/query/response/multi_select";
import { resolveNumber } from "../../../src/client/query/response/number";
import { resolvePeople } from "../../../src/client/query/response/people";
import { resolvePhoneNumber } from "../../../src/client/query/response/phone_number";
import { resolveRelation } from "../../../src/client/query/response/relation";
import { resolveRichText } from "../../../src/client/query/response/rich_text";
import { resolveSelect } from "../../../src/client/query/response/select";
import { resolveStatus } from "../../../src/client/query/response/status";
import { resolveTitle } from "../../../src/client/query/response/title";
import { resolveUniqueId } from "../../../src/client/query/response/unique_id";
import { resolveUrl } from "../../../src/client/query/response/url";
import { databasePropertyValue } from "../../helpers/query-transform-fixtures";

describe("individual property transformers", () => {
	test("files", () => {
		expect(
			resolveFiles(
				databasePropertyValue.files([
					{ name: "one.pdf", url: "https://files.dev/one.pdf" },
					{
						name: "two.pdf",
						url: "https://files.dev/two.pdf",
						source: "file",
					},
				]),
			),
		).toEqual([
			{ name: "one.pdf", url: "https://files.dev/one.pdf" },
			{ name: "two.pdf", url: "https://files.dev/two.pdf" },
		]);
		expect(resolveFiles(databasePropertyValue.number(1))).toBeNull();
	});

	test("people", () => {
		expect(
			resolvePeople(
				databasePropertyValue.people([
					{ id: "u1", name: "Tyrus" },
					{ id: "u2" },
				]),
			),
		).toEqual(["Tyrus", "u2"]);
		expect(resolvePeople(databasePropertyValue.number(1))).toBeNull();
	});

	test("relation", () => {
		expect(
			resolveRelation(databasePropertyValue.relation(["p1", "p2"])),
		).toEqual(["p1", "p2"]);
		expect(resolveRelation(databasePropertyValue.number(1))).toBeNull();
	});

	test("created_by", () => {
		expect(
			resolveCreatedBy(databasePropertyValue.createdBy("u1", "Author")),
		).toBe("Author");
		expect(resolveCreatedBy(databasePropertyValue.createdBy("u2"))).toBe("u2");
		expect(resolveCreatedBy(databasePropertyValue.number(1))).toBeNull();
	});

	test("last_edited_by", () => {
		expect(
			resolveLastEditedBy(databasePropertyValue.lastEditedBy("u9", "Reviewer")),
		).toBe("Reviewer");
		expect(resolveLastEditedBy(databasePropertyValue.lastEditedBy("u8"))).toBe(
			"u8",
		);
		expect(resolveLastEditedBy(databasePropertyValue.number(1))).toBeNull();
	});

	test("created_time", () => {
		expect(
			resolveCreatedTime(
				databasePropertyValue.createdTime("2026-03-01T00:00:00.000Z"),
			),
		).toBe("2026-03-01T00:00:00.000Z");
		expect(resolveCreatedTime(databasePropertyValue.number(1))).toBeNull();
	});

	test("last_edited_time", () => {
		expect(
			resolveLastEditedTime(
				databasePropertyValue.lastEditedTime("2026-03-02T00:00:00.000Z"),
			),
		).toBe("2026-03-02T00:00:00.000Z");
		expect(resolveLastEditedTime(databasePropertyValue.number(1))).toBeNull();
	});

	test("url", () => {
		expect(resolveUrl(databasePropertyValue.url("https://example.com"))).toBe(
			"https://example.com",
		);
		expect(resolveUrl(databasePropertyValue.number(1))).toBeNull();
	});

	test("phone_number", () => {
		expect(
			resolvePhoneNumber(databasePropertyValue.phoneNumber("+1 555 000 0000")),
		).toBe("+1 555 000 0000");
		expect(resolvePhoneNumber(databasePropertyValue.number(1))).toBeNull();
	});

	test("title", () => {
		expect(resolveTitle(databasePropertyValue.title("Coffee Shop"))).toBe(
			"Coffee Shop",
		);
		expect(resolveTitle(databasePropertyValue.number(1))).toBeNull();
	});

	test("email", () => {
		expect(resolveEmail(databasePropertyValue.email("hello@coffee.dev"))).toBe(
			"hello@coffee.dev",
		);
		expect(resolveEmail(databasePropertyValue.number(1))).toBeNull();
	});

	test("checkbox", () => {
		expect(resolveCheckbox(databasePropertyValue.checkbox(true))).toBe(true);
		expect(resolveCheckbox(databasePropertyValue.checkbox(false))).toBe(false);
		expect(resolveCheckbox(databasePropertyValue.number(1))).toBeNull();
	});

	test("date", () => {
		expect(
			resolveDate(databasePropertyValue.date("2026-03-01", "2026-03-05")),
		).toEqual({
			start: "2026-03-01",
			end: "2026-03-05",
		});
		expect(resolveDate(databasePropertyValue.date("2026-03-01"))).toEqual({
			start: "2026-03-01",
			end: undefined,
		});
		expect(resolveDate(databasePropertyValue.number(1))).toBeNull();
	});

	test("multi_select", () => {
		expect(
			resolveMultiSelect(
				databasePropertyValue.multiSelect(["quiet", "brunch"]),
			),
		).toEqual(["quiet", "brunch"]);
		expect(resolveMultiSelect(databasePropertyValue.number(1))).toBeNull();
	});

	test("status", () => {
		expect(resolveStatus(databasePropertyValue.status("Open"))).toBe("Open");
		expect(resolveStatus(databasePropertyValue.number(1))).toBeNull();
	});

	test("number", () => {
		expect(resolveNumber(databasePropertyValue.number(42))).toBe(42);
		expect(
			resolveNumber(databasePropertyValue.title("not-a-number")),
		).toBeNull();
	});

	test("rich_text", () => {
		expect(
			resolveRichText(databasePropertyValue.richText("Long form notes")),
		).toBe("Long form notes");
		expect(resolveRichText(databasePropertyValue.number(1))).toBeNull();
	});

	test("select", () => {
		expect(resolveSelect(databasePropertyValue.select("Cafe"))).toBe("Cafe");
		expect(resolveSelect(databasePropertyValue.number(1))).toBeNull();
	});

	test("unique_id", () => {
		expect(resolveUniqueId(databasePropertyValue.uniqueId(7, "SHOP"))).toBe(
			"SHOP-7",
		);
		expect(resolveUniqueId(databasePropertyValue.uniqueId(8))).toBe("8");
		expect(resolveUniqueId(databasePropertyValue.number(1))).toBeNull();
	});
});
