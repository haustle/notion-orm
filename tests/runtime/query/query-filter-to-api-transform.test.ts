import { describe, expect, test } from "bun:test";
import type { camelPropertyNameToNameAndTypeMapType } from "../../../src/client/DatabaseClient";
import { transformQueryFilterToApiFilter } from "../../../src/client/query/filter";
import type { QueryFilter } from "../../../src/client/queryTypes";

type QuerySchema = {
	shopName: string;
	rating: number;
	visitStatus: string;
	website: string;
	contactEmail: string;
	contactPhone: string;
	hasWifi: boolean;
	openedOn: { start: string; end?: string };
	tags: string[];
	neighborhood: string;
	notes: string;
	attachments: Array<{ name: string; url: string }>;
	relatedPages: string[];
	owners: string[];
	createdByUser: string;
	lastEditedByUser: string;
	createdAt: string;
	updatedAt: string;
	recordId: number;
};

const map = {
	shopName: { columnName: "Shop Name", type: "title" },
	rating: { columnName: "Rating", type: "number" },
	visitStatus: { columnName: "Visit Status", type: "status" },
	website: { columnName: "Website", type: "url" },
	contactEmail: { columnName: "Contact Email", type: "email" },
	contactPhone: { columnName: "Contact Phone", type: "phone_number" },
	hasWifi: { columnName: "Has WiFi", type: "checkbox" },
	openedOn: { columnName: "Opened On", type: "date" },
	tags: { columnName: "Tags", type: "multi_select" },
	neighborhood: { columnName: "Neighborhood", type: "select" },
	notes: { columnName: "Notes", type: "rich_text" },
	attachments: { columnName: "Attachments", type: "files" },
	relatedPages: { columnName: "Related Pages", type: "relation" },
	owners: { columnName: "Owners", type: "people" },
	createdByUser: { columnName: "Created By User", type: "created_by" },
	lastEditedByUser: {
		columnName: "Last Edited By User",
		type: "last_edited_by",
	},
	createdAt: { columnName: "Created At", type: "created_time" },
	updatedAt: { columnName: "Updated At", type: "last_edited_time" },
	recordId: { columnName: "Record Id", type: "unique_id" },
} as const satisfies camelPropertyNameToNameAndTypeMapType;

type QueryColumns = {
	[Property in keyof typeof map]: (typeof map)[Property]["type"];
};

function transformFilter(queryFilter: QueryFilter<QuerySchema, QueryColumns>) {
	return transformQueryFilterToApiFilter<QuerySchema, QueryColumns>(
		queryFilter,
		map,
	);
}

describe("query filter transform", () => {
	test("transforms single leaf filters", () => {
		const output = transformFilter({
			shopName: { contains: "Blue" },
		});
		expect(output).toEqual({
			property: "Shop Name",
			title: { contains: "Blue" },
		});
	});

	test("transforms nested compound filters", () => {
		const output = transformFilter({
			and: [
				{ shopName: { contains: "Blue" } },
				{
					or: [
						{ rating: { greater_than: 3 } },
						{ visitStatus: { equals: "Want to Go" } },
					],
				},
			],
		});
		expect(output).toEqual({
			and: [
				{
					property: "Shop Name",
					title: { contains: "Blue" },
				},
				{
					or: [
						{
							property: "Rating",
							number: { greater_than: 3 },
						},
						{
							property: "Visit Status",
							status: { equals: "Want to Go" },
						},
					],
				},
			],
		});
	});

	test("drops unknown schema keys from runtime filters", () => {
		const runtimeFilter = JSON.parse(
			JSON.stringify({
				and: [
					{ unknownProp: { equals: "x" } },
					{ rating: { equals: 4 } },
				],
			}),
		);
		const output = transformQueryFilterToApiFilter(runtimeFilter, map);
		expect(output).toEqual({
			and: [
				{
					property: "Rating",
					number: { equals: 4 },
				},
			],
		});
	});

	test("transforms newly enabled filterable property types", () => {
		const output = transformFilter({
			and: [
				{ website: { contains: "coffee.dev" } },
				{ contactEmail: { contains: "@coffee.dev" } },
				{ contactPhone: { contains: "555" } },
				{ hasWifi: { equals: true } },
				{ openedOn: { on_or_after: "2026-01-01" } },
				{ tags: { contains: "quiet" } },
				{ neighborhood: { equals: "Downtown" } },
				{ notes: { contains: "espresso" } },
				{ attachments: { is_not_empty: true } },
				{ relatedPages: { contains: "page-1" } },
				{ owners: { contains: "user-1" } },
				{ createdByUser: { contains: "user-2" } },
				{ lastEditedByUser: { does_not_contain: "user-3" } },
				{ createdAt: { on_or_after: "2026-02-01" } },
				{ updatedAt: { before: "2026-03-01" } },
			],
		});

		expect(output).toEqual({
			and: [
				{
					property: "Website",
					url: { contains: "coffee.dev" },
				},
				{
					property: "Contact Email",
					email: { contains: "@coffee.dev" },
				},
				{
					property: "Contact Phone",
					phone_number: { contains: "555" },
				},
				{
					property: "Has WiFi",
					checkbox: { equals: true },
				},
				{
					property: "Opened On",
					date: { on_or_after: "2026-01-01" },
				},
				{
					property: "Tags",
					multi_select: { contains: "quiet" },
				},
				{
					property: "Neighborhood",
					select: { equals: "Downtown" },
				},
				{
					property: "Notes",
					rich_text: { contains: "espresso" },
				},
				{
					property: "Attachments",
					files: { is_not_empty: true },
				},
				{
					property: "Related Pages",
					relation: { contains: "page-1" },
				},
				{
					property: "Owners",
					people: { contains: "user-1" },
				},
				{
					property: "Created By User",
					created_by: { contains: "user-2" },
				},
				{
					property: "Last Edited By User",
					last_edited_by: { does_not_contain: "user-3" },
				},
				{
					property: "Created At",
					created_time: { on_or_after: "2026-02-01" },
				},
				{
					property: "Updated At",
					last_edited_time: { before: "2026-03-01" },
				},
			],
		});
	});

	test("transforms unique_id filters in runtime input", () => {
		const runtimeFilter = JSON.parse(
			JSON.stringify({
				and: [{ recordId: { equals: 42 } }],
			}),
		);
		const output = transformQueryFilterToApiFilter(runtimeFilter, map);

		expect(output).toEqual({
			and: [
				{
					property: "Record Id",
					unique_id: { equals: 42 },
				},
			],
		});
	});

	test("returns undefined when no valid filters survive", () => {
		const runtimeFilter = JSON.parse(
			JSON.stringify({
				and: [{ unknownProp: { equals: "x" } }],
			}),
		);
		const output = transformQueryFilterToApiFilter(runtimeFilter, map);
		expect(output).toEqual({ and: [] });
	});
});
