import type {
	CreatePageParameters,
	PageObjectResponse,
	PartialUserObjectResponse,
	QueryDataSourceResponse,
	RichTextItemResponse,
	UserObjectResponse,
} from "@notionhq/client/build/src/api-endpoints";
import type { PropertyNameToColumnMetadataMap } from "../../src/client/DatabaseClient";
import { buildQueryResponse } from "../../src/client/query";
import type { NotionPropertyValue } from "../../src/client/query/types";
import type {
	QueryResponseWithoutRawResponse,
	QueryResponseWithRawResponse,
	SupportedNotionColumnType,
} from "../../src/client/queryTypes";

// Narrows the Notion property union by the top-level `type` discriminator.
type NotionPropertyValueByType<Type extends NotionPropertyValue["type"]> =
	Extract<NotionPropertyValue, { type: Type }>;

// Borrow the file input contract from Notion's create-page API types.
type NotionCreatePagePropertyInput = NonNullable<
	CreatePageParameters["properties"]
>[string];
type NotionFilesPropertyInput = Extract<
	NotionCreatePagePropertyInput,
	{ files: unknown }
>;
type NotionFilePropertyInput = NotionFilesPropertyInput["files"][number];
type NotionExternalFilePropertyInput = Extract<
	NotionFilePropertyInput,
	{ external: unknown }
>;
type NotionInternalFilePropertyInput = Extract<
	NotionFilePropertyInput,
	{ file: unknown }
>;

// Ergonomic fixture input while staying linked to Notion SDK field types.
type FixtureFileInput = {
	name: NonNullable<NotionFilePropertyInput["name"]>;
	url:
		| NotionExternalFilePropertyInput["external"]["url"]
		| NotionInternalFilePropertyInput["file"]["url"];
	source?: Extract<
		NonNullable<NotionFilePropertyInput["type"]>,
		"external" | "file"
	>;
};

// Converts `snake_case` type keys to helper-style `camelCase` method keys.
type SnakeToCamelCase<Input extends string> =
	Input extends `${infer First}_${infer Rest}`
		? `${First}${Capitalize<SnakeToCamelCase<Rest>>}`
		: Input;

type SupportedTypeToHelperMethodName = {
	[K in SupportedNotionColumnType]: SnakeToCamelCase<K>;
};

/**
 * Runs a built query scenario through the same response normalization path used
 * by the runtime query pipeline, with optional raw-response passthrough.
 */
export function runQueryScenario<
	DatabaseSchemaType extends Record<string, unknown>,
>(
	args: ReturnType<typeof buildQueryScenario>,
	options: {
		includeRawResponse: true;
		validateSchema?: (result: Partial<DatabaseSchemaType>) => void;
	},
): QueryResponseWithRawResponse<DatabaseSchemaType>;
export function runQueryScenario<
	DatabaseSchemaType extends Record<string, unknown>,
>(
	args: ReturnType<typeof buildQueryScenario>,
	options?: {
		includeRawResponse?: false | undefined;
		validateSchema?: (result: Partial<DatabaseSchemaType>) => void;
	},
): QueryResponseWithoutRawResponse<DatabaseSchemaType>;
export function runQueryScenario<
	DatabaseSchemaType extends Record<string, unknown>,
>(
	args: ReturnType<typeof buildQueryScenario>,
	options?: {
		includeRawResponse?: boolean;
		validateSchema?: (result: Partial<DatabaseSchemaType>) => void;
	},
):
	| QueryResponseWithRawResponse<DatabaseSchemaType>
	| QueryResponseWithoutRawResponse<DatabaseSchemaType> {
	const validateSchema = options?.validateSchema ?? (() => undefined);
	if (options?.includeRawResponse) {
		return buildQueryResponse<DatabaseSchemaType>({
			response: args.response,
			columnNameToColumnProperties: args.columnNameToColumnProperties,
			validateSchema,
			options: { includeRawResponse: true },
		});
	}
	return buildQueryResponse<DatabaseSchemaType>({
		response: args.response,
		columnNameToColumnProperties: args.columnNameToColumnProperties,
		validateSchema,
	});
}

export function defineDatabaseSchema<
	Schema extends PropertyNameToColumnMetadataMap,
>(schema: Schema): Schema {
	return schema;
}

export function buildColumnNameToColumnProperties<
	Schema extends PropertyNameToColumnMetadataMap,
>(schema: Schema): PropertyNameToColumnMetadataMap {
	return schema;
}

const DEFAULT_TIMESTAMP = "2026-03-01T00:00:00.000Z";

export function createMockUuid(): string {
	return crypto.randomUUID();
}

export function createMockShortId(length = 4): string {
	return crypto.randomUUID().replace(/-/g, "").slice(0, length);
}

function createRichText(content: string): RichTextItemResponse {
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

function createUserValue(args: {
	id: string;
	name?: string;
}): PartialUserObjectResponse | UserObjectResponse {
	if (!args.name) {
		return {
			id: args.id,
			object: "user",
		};
	}

	return {
		id: args.id,
		object: "user",
		name: args.name,
		avatar_url: null,
		type: "person",
		person: {},
	};
}

export function page(
	properties: Record<string, NotionPropertyValue>,
): PageObjectResponse {
	const pageId = createMockUuid();
	const userId = createMockUuid();

	return {
		parent: {
			type: "workspace",
			workspace: true,
		},
		properties,
		icon: null,
		cover: null,
		created_by: {
			id: userId,
			object: "user",
		},
		last_edited_by: {
			id: userId,
			object: "user",
		},
		is_locked: false,
		object: "page",
		id: pageId,
		created_time: DEFAULT_TIMESTAMP,
		last_edited_time: DEFAULT_TIMESTAMP,
		archived: false,
		in_trash: false,
		url: `https://www.notion.so/${pageId}`,
		public_url: null,
	};
}

export function buildQueryScenario(args: {
	schema: PropertyNameToColumnMetadataMap;
	pages: Array<Record<string, NotionPropertyValue>>;
}) {
	const response: QueryDataSourceResponse = {
		type: "page_or_data_source",
		page_or_data_source: {},
		object: "list",
		next_cursor: null,
		has_more: false,
		results: args.pages.map((entry) => page(entry)),
	};

	return {
		schema: args.schema,
		columnNameToColumnProperties: buildColumnNameToColumnProperties(
			args.schema,
		),
		response,
	};
}

export const databasePropertyValue = {
	files(value: FixtureFileInput[]): NotionPropertyValueByType<"files"> {
		return {
			id: createMockShortId(),
			type: "files",
			files: value.map((file) =>
				file.source === "file"
					? {
							name: file.name,
							type: "file",
							file: {
								url: file.url,
								expiry_time: DEFAULT_TIMESTAMP,
							},
						}
					: { name: file.name, type: "external", external: { url: file.url } },
			),
		};
	},
	people(
		value: Array<{ id: string; name?: string }>,
	): NotionPropertyValueByType<"people"> {
		return {
			id: createMockShortId(),
			type: "people",
			people: value.map((person) =>
				createUserValue({ id: person.id, name: person.name }),
			),
		};
	},
	relation(ids: string[]): NotionPropertyValueByType<"relation"> {
		return {
			id: createMockShortId(),
			type: "relation",
			relation: ids.map((id) => ({ id })),
		};
	},
	createdBy(
		id: string,
		name?: string,
	): NotionPropertyValueByType<"created_by"> {
		return {
			id: createMockShortId(),
			type: "created_by",
			created_by: createUserValue({ id, name }),
		};
	},
	lastEditedBy(
		id: string,
		name?: string,
	): NotionPropertyValueByType<"last_edited_by"> {
		return {
			id: createMockShortId(),
			type: "last_edited_by",
			last_edited_by: createUserValue({ id, name }),
		};
	},
	createdTime(value: string): NotionPropertyValueByType<"created_time"> {
		return {
			id: createMockShortId(),
			type: "created_time",
			created_time: value,
		};
	},
	lastEditedTime(value: string): NotionPropertyValueByType<"last_edited_time"> {
		return {
			id: createMockShortId(),
			type: "last_edited_time",
			last_edited_time: value,
		};
	},
	url(value: string): NotionPropertyValueByType<"url"> {
		return {
			id: createMockShortId(),
			type: "url",
			url: value,
		};
	},
	phoneNumber(value: string): NotionPropertyValueByType<"phone_number"> {
		return {
			id: createMockShortId(),
			type: "phone_number",
			phone_number: value,
		};
	},
	title(value: string): NotionPropertyValueByType<"title"> {
		return {
			id: createMockShortId(),
			type: "title",
			title: [createRichText(value)],
		};
	},
	email(value: string): NotionPropertyValueByType<"email"> {
		return {
			id: createMockShortId(),
			type: "email",
			email: value,
		};
	},
	checkbox(value: boolean): NotionPropertyValueByType<"checkbox"> {
		return {
			id: createMockShortId(),
			type: "checkbox",
			checkbox: value,
		};
	},
	date(start: string, end?: string): NotionPropertyValueByType<"date"> {
		return {
			id: createMockShortId(),
			type: "date",
			date: {
				start,
				end: end ?? null,
				time_zone: null,
			},
		};
	},
	multiSelect(values: string[]): NotionPropertyValueByType<"multi_select"> {
		return {
			id: createMockShortId(),
			type: "multi_select",
			multi_select: values.map((name) => ({
				id: createMockShortId(),
				name,
				color: "default",
			})),
		};
	},
	status(value: string): NotionPropertyValueByType<"status"> {
		return {
			id: createMockShortId(),
			type: "status",
			status: {
				id: createMockShortId(),
				name: value,
				color: "default",
			},
		};
	},
	number(value: number): NotionPropertyValueByType<"number"> {
		return {
			id: createMockShortId(),
			type: "number",
			number: value,
		};
	},
	richText(value: string): NotionPropertyValueByType<"rich_text"> {
		return {
			id: createMockShortId(),
			type: "rich_text",
			rich_text: [createRichText(value)],
		};
	},
	select(value: string): NotionPropertyValueByType<"select"> {
		return {
			id: createMockShortId(),
			type: "select",
			select: {
				id: createMockShortId(),
				name: value,
				color: "default",
			},
		};
	},
	uniqueId(
		number: number,
		prefix?: string,
	): NotionPropertyValueByType<"unique_id"> {
		return {
			id: createMockShortId(),
			type: "unique_id",
			unique_id: {
				number,
				prefix: prefix ?? null,
			},
		};
	},
} as const;

type DatabasePropertyValueFunctionByType = {
	[K in SupportedNotionColumnType]: (typeof databasePropertyValue)[SupportedTypeToHelperMethodName[K]];
};

// Exhaustive + linked registry: every supported type must map to a real helper.
export const databasePropertyValueFunctionByType = {
	files: databasePropertyValue.files,
	people: databasePropertyValue.people,
	relation: databasePropertyValue.relation,
	created_by: databasePropertyValue.createdBy,
	last_edited_by: databasePropertyValue.lastEditedBy,
	created_time: databasePropertyValue.createdTime,
	last_edited_time: databasePropertyValue.lastEditedTime,
	url: databasePropertyValue.url,
	phone_number: databasePropertyValue.phoneNumber,
	title: databasePropertyValue.title,
	email: databasePropertyValue.email,
	checkbox: databasePropertyValue.checkbox,
	date: databasePropertyValue.date,
	multi_select: databasePropertyValue.multiSelect,
	status: databasePropertyValue.status,
	number: databasePropertyValue.number,
	rich_text: databasePropertyValue.richText,
	select: databasePropertyValue.select,
	unique_id: databasePropertyValue.uniqueId,
} as const satisfies DatabasePropertyValueFunctionByType;
