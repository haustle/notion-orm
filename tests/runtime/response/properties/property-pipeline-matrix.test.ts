import { randomUUID } from "node:crypto";
import { databasePropertyValue } from "../../../helpers/query-transform-fixtures";
import { toUndashedNotionId } from "../../../../src/helpers";
import {
	describePropertyPipelineCases,
	type PropertyPipelineCase,
} from "./_pipeline-test-helpers";

const relationPipelineDashedA = randomUUID();
const relationPipelineDashedB = randomUUID();
const relationPipelineExpectedUndashed = [
	toUndashedNotionId(relationPipelineDashedA),
	toUndashedNotionId(relationPipelineDashedB),
] as const;

const propertyPipelineCases: Array<{
	name: string;
	testCase: PropertyPipelineCase;
}> = [
	{
		name: "checkbox",
		testCase: {
			propertyType: "checkbox",
			validPropertyValue: databasePropertyValue.checkbox(false),
			expectedValidValue: false,
			mismatchedPropertyValue: databasePropertyValue.number(1),
			malformedPropertyValue: {
				id: "checkbox",
				type: "checkbox",
				checkbox: "yes",
			},
			expectedMalformedValue: true,
		},
	},
	{
		name: "created_by",
		testCase: {
			propertyType: "created_by",
			validPropertyValue: databasePropertyValue.createdBy("u1", "Author"),
			expectedValidValue: "Author",
			mismatchedPropertyValue: databasePropertyValue.number(1),
			malformedPropertyValue: {
				id: "created_by",
				type: "created_by",
				created_by: { id: 7, name: "" },
			},
			expectedMalformedValue: null,
		},
	},
	{
		name: "created_time",
		testCase: {
			propertyType: "created_time",
			validPropertyValue: databasePropertyValue.createdTime(
				"2026-03-01T00:00:00.000Z",
			),
			expectedValidValue: "2026-03-01T00:00:00.000Z",
			mismatchedPropertyValue: databasePropertyValue.number(1),
			malformedPropertyValue: {
				id: "created_time",
				type: "created_time",
				created_time: 123,
			},
			expectedMalformedValue: 123,
		},
	},
	{
		name: "date",
		testCase: {
			propertyType: "date",
			validPropertyValue: databasePropertyValue.date(
				"2026-03-01",
				"2026-03-05",
			),
			expectedValidValue: {
				start: "2026-03-01",
				end: "2026-03-05",
			},
			mismatchedPropertyValue: databasePropertyValue.number(1),
			malformedPropertyValue: {
				id: "date",
				type: "date",
				date: { start: 1, end: "2026-03-05" },
			},
			expectedMalformedValue: null,
		},
	},
	{
		name: "email",
		testCase: {
			propertyType: "email",
			validPropertyValue: databasePropertyValue.email("hello@coffee.dev"),
			expectedValidValue: "hello@coffee.dev",
			mismatchedPropertyValue: databasePropertyValue.number(1),
			malformedPropertyValue: {
				id: "email",
				type: "email",
				email: 42,
			},
			expectedMalformedValue: 42,
		},
	},
	{
		name: "files",
		testCase: {
			propertyType: "files",
			validPropertyValue: databasePropertyValue.files([
				{ name: "menu.pdf", url: "https://files.dev/menu.pdf" },
			]),
			expectedValidValue: [
				{ name: "menu.pdf", url: "https://files.dev/menu.pdf" },
			],
			mismatchedPropertyValue: databasePropertyValue.number(1),
			malformedPropertyValue: {
				id: "files",
				type: "files",
				files: [
					{ name: "broken", type: "external", external: {} },
					{
						name: 1,
						type: "external",
						external: { url: "https://files.dev/1" },
					},
				],
			},
			expectedMalformedValue: [],
		},
	},
	{
		name: "last_edited_by",
		testCase: {
			propertyType: "last_edited_by",
			validPropertyValue: databasePropertyValue.lastEditedBy("u2", "Reviewer"),
			expectedValidValue: "Reviewer",
			mismatchedPropertyValue: databasePropertyValue.number(1),
			malformedPropertyValue: {
				id: "last_edited_by",
				type: "last_edited_by",
				last_edited_by: { id: 9, name: "" },
			},
			expectedMalformedValue: null,
		},
	},
	{
		name: "last_edited_time",
		testCase: {
			propertyType: "last_edited_time",
			validPropertyValue: databasePropertyValue.lastEditedTime(
				"2026-03-02T00:00:00.000Z",
			),
			expectedValidValue: "2026-03-02T00:00:00.000Z",
			mismatchedPropertyValue: databasePropertyValue.number(1),
			malformedPropertyValue: {
				id: "last_edited_time",
				type: "last_edited_time",
				last_edited_time: 456,
			},
			expectedMalformedValue: 456,
		},
	},
	{
		name: "multi_select",
		testCase: {
			propertyType: "multi_select",
			validPropertyValue: databasePropertyValue.multiSelect([
				"quiet",
				"brunch",
			]),
			expectedValidValue: ["quiet", "brunch"],
			mismatchedPropertyValue: databasePropertyValue.number(1),
			malformedPropertyValue: {
				id: "multi_select",
				type: "multi_select",
				multi_select: [{ foo: "bar" }],
			},
			expectedMalformedValue: [undefined],
		},
	},
	{
		name: "number",
		testCase: {
			propertyType: "number",
			validPropertyValue: databasePropertyValue.number(42),
			expectedValidValue: 42,
			mismatchedPropertyValue: databasePropertyValue.title("not-a-number"),
			malformedPropertyValue: {
				id: "number",
				type: "number",
				number: "42",
			},
			expectedMalformedValue: "42",
		},
	},
	{
		name: "people",
		testCase: {
			propertyType: "people",
			validPropertyValue: databasePropertyValue.people([
				{ id: "u1", name: "Tyrus" },
				{ id: "u2" },
			]),
			expectedValidValue: ["Tyrus", "u2"],
			mismatchedPropertyValue: databasePropertyValue.number(1),
			malformedPropertyValue: {
				id: "people",
				type: "people",
				people: [{ id: 3 }, { foo: "bar" }],
			},
			expectedMalformedValue: [],
		},
	},
	{
		name: "phone_number",
		testCase: {
			propertyType: "phone_number",
			validPropertyValue: databasePropertyValue.phoneNumber("+1 555 222 1111"),
			expectedValidValue: "+1 555 222 1111",
			mismatchedPropertyValue: databasePropertyValue.number(1),
			malformedPropertyValue: {
				id: "phone_number",
				type: "phone_number",
				phone_number: false,
			},
			expectedMalformedValue: false,
		},
	},
	{
		name: "relation",
		testCase: {
			propertyType: "relation",
			validPropertyValue: databasePropertyValue.relation([
				relationPipelineDashedA,
				relationPipelineDashedB,
			]),
			expectedValidValue: [...relationPipelineExpectedUndashed],
			mismatchedPropertyValue: databasePropertyValue.number(1),
			malformedPropertyValue: {
				id: "relation",
				type: "relation",
				relation: [{ id: 42 }, {}],
			},
			expectedMalformedValue: [],
		},
	},
	{
		name: "rich_text",
		testCase: {
			propertyType: "rich_text",
			validPropertyValue: databasePropertyValue.richText("Great espresso"),
			expectedValidValue: "Great espresso",
			mismatchedPropertyValue: databasePropertyValue.number(1),
			malformedPropertyValue: {
				id: "rich_text",
				type: "rich_text",
				rich_text: [{ foo: "bar" }],
			},
			expectedMalformedValue: "",
		},
	},
	{
		name: "select",
		testCase: {
			propertyType: "select",
			validPropertyValue: databasePropertyValue.select("Cafe"),
			expectedValidValue: "Cafe",
			mismatchedPropertyValue: databasePropertyValue.number(1),
			malformedPropertyValue: {
				id: "select",
				type: "select",
				select: {},
			},
			expectedMalformedValue: undefined,
		},
	},
	{
		name: "status",
		testCase: {
			propertyType: "status",
			validPropertyValue: databasePropertyValue.status("Want to Go"),
			expectedValidValue: "Want to Go",
			mismatchedPropertyValue: databasePropertyValue.number(1),
			malformedPropertyValue: {
				id: "status",
				type: "status",
				status: {},
			},
			expectedMalformedValue: undefined,
		},
	},
	{
		name: "title",
		testCase: {
			propertyType: "title",
			validPropertyValue: databasePropertyValue.title("Blue Bottle"),
			expectedValidValue: "Blue Bottle",
			mismatchedPropertyValue: databasePropertyValue.number(1),
			malformedPropertyValue: {
				id: "title",
				type: "title",
				title: [{ foo: "bar" }],
			},
			expectedMalformedValue: "",
		},
	},
	{
		name: "unique_id",
		testCase: {
			propertyType: "unique_id",
			validPropertyValue: databasePropertyValue.uniqueId(42, "SHOP"),
			expectedValidValue: "SHOP-42",
			mismatchedPropertyValue: databasePropertyValue.number(1),
			malformedPropertyValue: {
				id: "unique_id",
				type: "unique_id",
				unique_id: { prefix: "SHOP" },
			},
			expectedMalformedValue: null,
		},
	},
	{
		name: "url",
		testCase: {
			propertyType: "url",
			validPropertyValue: databasePropertyValue.url("https://coffee.dev"),
			expectedValidValue: "https://coffee.dev",
			mismatchedPropertyValue: databasePropertyValue.number(1),
			malformedPropertyValue: {
				id: "url",
				type: "url",
				url: { href: "https://coffee.dev" },
			},
			expectedMalformedValue: { href: "https://coffee.dev" },
		},
	},
];

for (const { name, testCase } of propertyPipelineCases) {
	describePropertyPipelineCases(name, testCase);
}
