import { describe, expect, test } from "bun:test";
import {
	buildQueryScenario,
	databasePropertyValue,
	defineDatabaseSchema,
	runQueryScenario,
} from "../helpers/query-transform-fixtures";

type ExampleDatabaseSchema = {
	attachments: Array<{ name: string; url: string }>;
	owners: string[];
	relatedPages: string[];
	createdByUser: string | null;
	lastEditedByUser: string | null;
	createdAt: string | null;
	updatedAt: string | null;
	website: string | null;
	contactPhone: string | null;
	shopName: string | null;
	contactEmail: string | null;
	hasWifi: boolean | null;
	openedOn: { start: string; end?: string } | null;
	tags: string[] | null;
	visitStatus: string | null;
	rating: number | null;
	notes: string | null;
	category: string | null;
	recordId: string | null;
};

const e2eTagOptions = ["quiet", "brunch"] as const;
const e2eVisitStatusOptions = ["Want to Go", "Favorite"] as const;
const e2eCategoryOptions = ["Cafe", "Bakery"] as const;

describe("runtime database capability", () => {
	test("build schema + mock API results + transform normalized response", () => {
		const schema = defineDatabaseSchema({
			attachments: { type: "files", columnName: "Attachments" },
			owners: { type: "people", columnName: "Owners" },
					relatedPages: {
						type: "relation",
						columnName: "Related Pages",
						relatedDatabaseId: "b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5",
					},
			createdByUser: { type: "created_by", columnName: "Created By User" },
			lastEditedByUser: {
				type: "last_edited_by",
				columnName: "Last Edited By User",
			},
			createdAt: { type: "created_time", columnName: "Created At" },
			updatedAt: { type: "last_edited_time", columnName: "Updated At" },
			website: { type: "url", columnName: "Website" },
			contactPhone: { type: "phone_number", columnName: "Contact Phone" },
			shopName: { type: "title", columnName: "Shop Name" },
			contactEmail: { type: "email", columnName: "Contact Email" },
			hasWifi: { type: "checkbox", columnName: "Has WiFi" },
			openedOn: { type: "date", columnName: "Opened On" },
			tags: {
				type: "multi_select",
				columnName: "Tags",
				options: e2eTagOptions,
			},
			visitStatus: {
				type: "status",
				columnName: "Visit Status",
				options: e2eVisitStatusOptions,
			},
			rating: { type: "number", columnName: "Rating" },
			notes: { type: "rich_text", columnName: "Notes" },
			category: {
				type: "select",
				columnName: "Category",
				options: e2eCategoryOptions,
			},
			recordId: { type: "unique_id", columnName: "Record Id" },
		});

		const scenario = buildQueryScenario({
			schema,
			pages: [
				{
					Attachments: databasePropertyValue.files([
						{ name: "menu.pdf", url: "https://files.dev/menu.pdf" },
					]),
					Owners: databasePropertyValue.people([
						{ id: "user-1", name: "Tyrus" },
					]),
					"Related Pages": databasePropertyValue.relation(["page-1", "page-2"]),
					"Created By User": databasePropertyValue.createdBy(
						"created-1",
						"Admin",
					),
					"Last Edited By User": databasePropertyValue.lastEditedBy(
						"editor-1",
						"Reviewer",
					),
					"Created At": databasePropertyValue.createdTime(
						"2026-03-01T10:00:00.000Z",
					),
					"Updated At": databasePropertyValue.lastEditedTime(
						"2026-03-02T10:00:00.000Z",
					),
					Website: databasePropertyValue.url("https://coffee.dev"),
					"Contact Phone": databasePropertyValue.phoneNumber("+1 555 222 1111"),
					"Shop Name": databasePropertyValue.title("Blue Bottle"),
					"Contact Email": databasePropertyValue.email("hello@coffee.dev"),
					"Has WiFi": databasePropertyValue.checkbox(true),
					"Opened On": databasePropertyValue.date("2026-03-01"),
					Tags: databasePropertyValue.multiSelect(["quiet", "brunch"]),
					"Visit Status": databasePropertyValue.status("Want to Go"),
					Rating: databasePropertyValue.number(5),
					Notes: databasePropertyValue.richText("Great espresso"),
					Category: databasePropertyValue.select("Cafe"),
					"Record Id": databasePropertyValue.uniqueId(42, "SHOP"),
					"Ignored Column": databasePropertyValue.number(999),
				},
			],
		});

		let validateCallCount = 0;
		let validatedResult: Partial<ExampleDatabaseSchema> | undefined;

		const output = runQueryScenario<ExampleDatabaseSchema>(scenario, {
			includeRawResponse: true,
			validateSchema: (result) => {
				validateCallCount += 1;
				validatedResult = result;
			},
		});

		expect(validateCallCount).toBe(1);
		expect(validatedResult).toEqual({
			attachments: [{ name: "menu.pdf", url: "https://files.dev/menu.pdf" }],
			owners: ["Tyrus"],
			relatedPages: ["page-1", "page-2"],
			createdByUser: "Admin",
			lastEditedByUser: "Reviewer",
			createdAt: "2026-03-01T10:00:00.000Z",
			updatedAt: "2026-03-02T10:00:00.000Z",
			website: "https://coffee.dev",
			contactPhone: "+1 555 222 1111",
			shopName: "Blue Bottle",
			contactEmail: "hello@coffee.dev",
			hasWifi: true,
			openedOn: { start: "2026-03-01", end: undefined },
			tags: ["quiet", "brunch"],
			visitStatus: "Want to Go",
			rating: 5,
			notes: "Great espresso",
			category: "Cafe",
			recordId: "SHOP-42",
		});

		expect(output.results).toEqual([
			{
				attachments: [{ name: "menu.pdf", url: "https://files.dev/menu.pdf" }],
				owners: ["Tyrus"],
				relatedPages: ["page-1", "page-2"],
				createdByUser: "Admin",
				lastEditedByUser: "Reviewer",
				createdAt: "2026-03-01T10:00:00.000Z",
				updatedAt: "2026-03-02T10:00:00.000Z",
				website: "https://coffee.dev",
				contactPhone: "+1 555 222 1111",
				shopName: "Blue Bottle",
				contactEmail: "hello@coffee.dev",
				hasWifi: true,
				openedOn: { start: "2026-03-01", end: undefined },
				tags: ["quiet", "brunch"],
				visitStatus: "Want to Go",
				rating: 5,
				notes: "Great espresso",
				category: "Cafe",
				recordId: "SHOP-42",
			},
		]);

		expect(output.rawResponse.results).toHaveLength(1);
	});
});
