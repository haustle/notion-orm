import type {
	GetDataSourceResponse,
	PartialDataSourceObjectResponse,
	RichTextItemResponse,
} from "@notionhq/client/build/src/api-endpoints";
import type { DatabasePropertyType } from "../../client/database/types";

export interface DataSourcePropertyFixtureSpec {
	type: DatabasePropertyType;
	options?: string[];
}

export interface DataSourceFixtureSpec {
	id: string;
	title: string;
	properties: Record<string, DataSourcePropertyFixtureSpec>;
}

function buildOptions(
	names: string[],
): Array<{ id: string; name: string; color: "default"; description: null }> {
	return names.map<{
		id: string;
		name: string;
		color: "default";
		description: null;
	}>((name, i) => ({
		id: `opt-${i}`,
		name,
		color: "default",
		description: null,
	}));
}

type DataSourcePropertyConfig =
	PartialDataSourceObjectResponse["properties"][string];
type DataSourcePropertyConfigByType<Type extends DatabasePropertyType> =
	Extract<DataSourcePropertyConfig, { type: Type }>;

function buildPropertyConfigCommon(args: {
	name: string;
	type: DatabasePropertyType;
}): {
	id: string;
	name: string;
	description: null;
	type: DatabasePropertyType;
} {
	return {
		id: `prop-${args.name.toLowerCase().replace(/\s+/g, "-")}`,
		name: args.name,
		description: null,
		type: args.type,
	};
}

function buildPropertyConfig(args: {
	name: string;
	spec: DataSourcePropertyFixtureSpec;
}): DataSourcePropertyConfig {
	const commonConfig = buildPropertyConfigCommon({
		name: args.name,
		type: args.spec.type,
	});

	switch (args.spec.type) {
		case "number":
			return {
				...commonConfig,
				type: "number",
				number: { format: "number" },
			} satisfies DataSourcePropertyConfigByType<"number">;
		case "formula":
			return {
				...commonConfig,
				type: "formula",
				formula: { expression: "1 + 1" },
			} satisfies DataSourcePropertyConfigByType<"formula">;
		case "select":
			return {
				...commonConfig,
				type: "select",
				select: { options: buildOptions(args.spec.options ?? []) },
			} satisfies DataSourcePropertyConfigByType<"select">;
		case "status":
			return {
				...commonConfig,
				type: "status",
				status: {
					options: buildOptions(args.spec.options ?? []),
					groups: [],
				},
			} satisfies DataSourcePropertyConfigByType<"status">;
		case "multi_select":
			return {
				...commonConfig,
				type: "multi_select",
				multi_select: { options: buildOptions(args.spec.options ?? []) },
			} satisfies DataSourcePropertyConfigByType<"multi_select">;
		case "relation":
			return {
				...commonConfig,
				type: "relation",
				relation: {
					data_source_id: "e5f6a1b2-c3d4-e5f6-a1b2-c3d4e5f6a1b2",
					database_id: "d4e5f6a1-b2c3-d4e5-f6a1-b2c3d4e5f6a1",
					type: "single_property",
					single_property: {},
				},
			} satisfies DataSourcePropertyConfigByType<"relation">;
		case "rollup":
			return {
				...commonConfig,
				type: "rollup",
				rollup: {
					function: "show_original",
					rollup_property_name: "Rollup Property",
					relation_property_name: "Relation Property",
					rollup_property_id: "rollup-prop-id",
					relation_property_id: "relation-prop-id",
				},
			} satisfies DataSourcePropertyConfigByType<"rollup">;
		case "unique_id":
			return {
				...commonConfig,
				type: "unique_id",
				unique_id: { prefix: null },
			} satisfies DataSourcePropertyConfigByType<"unique_id">;
		case "title":
			return {
				...commonConfig,
				type: "title",
				title: {},
			} satisfies DataSourcePropertyConfigByType<"title">;
		case "rich_text":
			return {
				...commonConfig,
				type: "rich_text",
				rich_text: {},
			} satisfies DataSourcePropertyConfigByType<"rich_text">;
		case "url":
			return {
				...commonConfig,
				type: "url",
				url: {},
			} satisfies DataSourcePropertyConfigByType<"url">;
		case "people":
			return {
				...commonConfig,
				type: "people",
				people: {},
			} satisfies DataSourcePropertyConfigByType<"people">;
		case "files":
			return {
				...commonConfig,
				type: "files",
				files: {},
			} satisfies DataSourcePropertyConfigByType<"files">;
		case "email":
			return {
				...commonConfig,
				type: "email",
				email: {},
			} satisfies DataSourcePropertyConfigByType<"email">;
		case "phone_number":
			return {
				...commonConfig,
				type: "phone_number",
				phone_number: {},
			} satisfies DataSourcePropertyConfigByType<"phone_number">;
		case "date":
			return {
				...commonConfig,
				type: "date",
				date: {},
			} satisfies DataSourcePropertyConfigByType<"date">;
		case "checkbox":
			return {
				...commonConfig,
				type: "checkbox",
				checkbox: {},
			} satisfies DataSourcePropertyConfigByType<"checkbox">;
		case "created_by":
			return {
				...commonConfig,
				type: "created_by",
				created_by: {},
			} satisfies DataSourcePropertyConfigByType<"created_by">;
		case "created_time":
			return {
				...commonConfig,
				type: "created_time",
				created_time: {},
			} satisfies DataSourcePropertyConfigByType<"created_time">;
		case "last_edited_by":
			return {
				...commonConfig,
				type: "last_edited_by",
				last_edited_by: {},
			} satisfies DataSourcePropertyConfigByType<"last_edited_by">;
		case "last_edited_time":
			return {
				...commonConfig,
				type: "last_edited_time",
				last_edited_time: {},
			} satisfies DataSourcePropertyConfigByType<"last_edited_time">;
		default:
			throw new Error(`Unsupported property type fixture: ${args.spec.type}`);
	}
}

function createRichTextTitle(content: string): RichTextItemResponse {
	return {
		type: "text",
		text: {
			content,
			link: null,
		},
		plain_text: content,
		href: null,
		annotations: {
			bold: false,
			italic: false,
			strikethrough: false,
			underline: false,
			code: false,
			color: "default",
		},
	};
}

/**
 * Builds a minimal `GetDataSourceResponse` from a simplified spec.
 * Only populates the fields actually consumed by `buildDatabaseModuleNodes`.
 */
export function buildMockDataSourceResponse(
	spec: DataSourceFixtureSpec,
): GetDataSourceResponse {
	const properties: PartialDataSourceObjectResponse["properties"] = {};

	for (const [propertyName, propSpec] of Object.entries(spec.properties)) {
		properties[propertyName] = buildPropertyConfig({
			name: propertyName,
			spec: propSpec,
		});
	}

	return {
		object: "data_source",
		id: spec.id,
		title: [createRichTextTitle(spec.title)],
		properties,
	};
}

/**
 * Broad real-world schema covering text, title, number, date, checkbox,
 * email, phone, and url property types.
 */
export const CUSTOMER_ORDERS_FIXTURE: DataSourceFixtureSpec = {
	id: "a1b2c3d4-e5f6-a1b2-c3d4-e5f6a1b2c3d4",
	title: "Customer Orders",
	properties: {
		"Order Name": { type: "title" },
		Notes: { type: "rich_text" },
		Total: { type: "number" },
		"Order Date": { type: "date" },
		Paid: { type: "checkbox" },
		"Customer Email": { type: "email" },
		"Customer Phone": { type: "phone_number" },
		"Receipt URL": { type: "url" },
	},
};

/**
 * Option-heavy schema exercising select, status, multi_select enum emission,
 * plus unique_id and number.
 */
export const INVENTORY_ITEMS_FIXTURE: DataSourceFixtureSpec = {
	id: "b2c3d4e5-f6a1-b2c3-d4e5-f6a1b2c3d4e5",
	title: "Inventory Items",
	properties: {
		"Item Name": { type: "title" },
		Category: {
			type: "select",
			options: ["Electronics", "Clothing", "Food"],
		},
		Availability: {
			type: "status",
			options: ["In Stock", "Out of Stock", "Backordered"],
		},
		Tags: {
			type: "multi_select",
			options: ["New", "Sale", "Featured"],
		},
		SKU: { type: "unique_id" },
		Price: { type: "number" },
	},
};

/**
 * Edge-case schema covering files, people, relation, created_by,
 * last_edited_by, created_time, last_edited_time, plus unsupported formula
 * and rollup properties that should be silently skipped by the emitter.
 */
export const EDGE_CASES_FIXTURE: DataSourceFixtureSpec = {
	id: "c3d4e5f6-a1b2-c3d4-e5f6-a1b2c3d4e5f6",
	title: "Edge Cases",
	properties: {
		Name: { type: "title" },
		Score: { type: "formula" },
		Attachments: { type: "files" },
		Assignees: { type: "people" },
		"Related Items": { type: "relation" },
		"Created By": { type: "created_by" },
		"Last Edited By": { type: "last_edited_by" },
		"Created At": { type: "created_time" },
		"Updated At": { type: "last_edited_time" },
		Summary: { type: "rollup" },
	},
};

export const ALL_DATABASE_FIXTURES = {
	customerOrders: CUSTOMER_ORDERS_FIXTURE,
	inventoryItems: INVENTORY_ITEMS_FIXTURE,
	edgeCases: EDGE_CASES_FIXTURE,
} as const;
