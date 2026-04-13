// @ts-nocheck — mock module template served to the website playground editor.
// Keep aligned with `src/helpers.ts`, `src/client/database/types/schema.ts`, `crud.ts`, and branded id helpers when those public types change.

import {
	DASHED_NOTION_ID_PATTERN,
	UNDASHED_NOTION_ID_PATTERN,
} from "./notion-id-patterns.ts";

type DateValue = { start: string; end?: string | null };

type NotionIdKind = "page" | "database" | "user";
type BrandedNotionId<K extends NotionIdKind> = string & {
	readonly __notionIdKind?: K;
};

export type NotionPageId = BrandedNotionId<"page">;
export type NotionDatabaseId = BrandedNotionId<"database">;
export type NotionUserId = BrandedNotionId<"user">;

/** Mirrors `src/helpers.ts` `toUndashedNotionId` (shared dashed/undashed patterns module). */
function playgroundCanonicalUndashedNotionId(id: string): string {
	const t = id.trim();
	if (t.length === 0) {
		throw new Error("Invalid Notion ID: expected a non-empty string.");
	}
	const l = t.toLowerCase();
	if (l.includes("-")) {
		if (!DASHED_NOTION_ID_PATTERN.test(l)) {
			throw new Error(
				`Invalid Notion ID. Expected UUID shape (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx), received '${id}'.`,
			);
		}
		return l.replace(/-/g, "");
	}
	if (!UNDASHED_NOTION_ID_PATTERN.test(l)) {
		throw new Error(
			`Invalid Notion ID. Expected 32 hexadecimal characters, received '${id}'.`,
		);
	}
	return l;
}

/** Same pattern as package `toNotionPageId` / `toNotionDatabaseId` / `toNotionUserId` — canonical string is assignable to the branded alias. */
export function toNotionPageId(id: string): NotionPageId {
	return playgroundCanonicalUndashedNotionId(id);
}

export function toNotionDatabaseId(id: string): NotionDatabaseId {
	return playgroundCanonicalUndashedNotionId(id);
}

export function toNotionUserId(id: string): NotionUserId {
	return playgroundCanonicalUndashedNotionId(id);
}

/** Same as `src/client/database/types/notion-id-brand.ts` — widens branded id arrays to `string[]`. */
export function brandedNotionIdsAsStringArray<K extends NotionIdKind>(
	ids: readonly BrandedNotionId<K>[] | BrandedNotionId<K>[] | null | undefined,
): string[] {
	return ids == null ? [] : [...ids];
}

export type DatabasePropertyValue =
	| string
	| number
	| boolean
	| undefined
	| null
	| string[]
	| NotionPageId[]
	| { name: string; url: string }[]
	| DateValue;

export type SupportedNotionColumnType =
	| "title"
	| "rich_text"
	| "email"
	| "phone_number"
	| "url"
	| "number"
	| "checkbox"
	| "date"
	| "select"
	| "status"
	| "multi_select"
	| "files"
	| "people"
	| "relation"
	| "created_by"
	| "last_edited_by"
	| "created_time"
	| "last_edited_time"
	| "unique_id";

export type ColumnTypesWithOptions = Extract<
	SupportedNotionColumnType,
	"select" | "status" | "multi_select"
>;

export type ColumnDefinitionBase = {
	columnName: string;
};

export type SelectColumnDefinition = ColumnDefinitionBase & {
	type: "select";
	options: readonly string[];
};

export type StatusColumnDefinition = ColumnDefinitionBase & {
	type: "status";
	options: readonly string[];
};

export type MultiSelectColumnDefinition = ColumnDefinitionBase & {
	type: "multi_select";
	options: readonly string[];
};

export type RelationColumnDefinition = ColumnDefinitionBase & {
	type: "relation";
	readonly relatedDatabaseId: NotionDatabaseId;
};

export type NotionPropertyTypeToColumnDefinitionMap = {
	[K in Exclude<
		SupportedNotionColumnType,
		ColumnTypesWithOptions | "relation"
	>]: ColumnDefinitionBase & {
		type: K;
	};
} & {
	select: SelectColumnDefinition;
	status: StatusColumnDefinition;
	multi_select: MultiSelectColumnDefinition;
	relation: RelationColumnDefinition;
};

export type PlainColumnDefinition =
	NotionPropertyTypeToColumnDefinitionMap[Exclude<
		SupportedNotionColumnType,
		ColumnTypesWithOptions
	>];

/** Definition for one generated Notion column in the emitted `columns` object. */
export type ColumnDefinition =
	NotionPropertyTypeToColumnDefinitionMap[SupportedNotionColumnType];

/** The full generated `columns` object keyed by ORM property name. */
export type DatabaseColumns = Record<string, ColumnDefinition>;

type NotionTypeToValueMap = {
	title: string;
	rich_text: string;
	email: string;
	phone_number: string;
	url: string;
	number: number;
	checkbox: boolean;
	date: { start: string; end?: string };
	select: string;
	status: string;
	multi_select: string[];
	files: { name: string; url: string }[];
	people: string[];
	relation: NotionPageId[];
	created_by: string;
	last_edited_by: string;
	created_time: string;
	last_edited_time: string;
	unique_id: string;
};

type InferColumnValue<Column extends ColumnDefinition> =
	Column extends {
		type: "multi_select";
		options: infer Options extends readonly string[];
	}
		? Array<Options[number] | (string & {})>
		: Column extends {
					type: "select" | "status";
					options: infer Options extends readonly string[];
			  }
			? Options[number] | (string & {})
			: Column extends { type: infer Type extends SupportedNotionColumnType }
				? NotionTypeToValueMap[Type]
				: never;

/** Derives the typed row shape directly from a generated `columns` object. */
export type InferDatabaseSchema<Columns extends DatabaseColumns> = {
	[Property in keyof Columns as Columns[Property]["type"] extends "title"
		? Property
		: never]: InferColumnValue<Columns[Property]>;
} & {
	[Property in keyof Columns as Columns[Property]["type"] extends "title"
		? never
		: Property]?: InferColumnValue<Columns[Property]>;
};

export type NotWritableDatabaseColumnType =
	| "created_by"
	| "last_edited_by"
	| "created_time"
	| "last_edited_time"
	| "unique_id";

type NonWritablePropertyKeys<Columns extends DatabaseColumns> = {
	[K in keyof Columns]: Columns[K]["type"] extends NotWritableDatabaseColumnType
		? K
		: never;
}[keyof Columns];

export type InferCreateSchema<Columns extends DatabaseColumns> = Omit<
	InferDatabaseSchema<Columns>,
	NonWritablePropertyKeys<Columns>
>;

/** Bundles the row shape and property -> column-type map for one database. */
export type DatabaseDefinition<
	Columns extends DatabaseColumns = DatabaseColumns,
> = {
	/** The typed row shape exposed by the client for this database. */
	schema: InferDatabaseSchema<Columns>;
	/** The property -> Notion column type lookup derived from `columns`. */
	columns: {
		[Property in keyof Columns]: Columns[Property]["type"];
	};
};

export type InferDatabaseColumns<Definition extends DatabaseDefinition> =
	Definition extends DatabaseDefinition<infer Columns> ? Columns : never;

export type CreateSchema<Definition extends DatabaseDefinition> =
	InferCreateSchema<InferDatabaseColumns<Definition>>;

/** Extracts the row shape from a `DatabaseDefinition`. */
export type DatabaseSchema<
	Definition extends DatabaseDefinition,
> = Definition["schema"];
/** Extracts the property -> column-type map from a `DatabaseDefinition`. */
export type DatabaseColumnTypes<
	Definition extends DatabaseDefinition,
> = Definition["columns"];

type TextFilters = {
	equals?: string;
	does_not_equal?: string;
	contains?: string;
	does_not_contain?: string;
	starts_with?: string;
	ends_with?: string;
	is_empty?: true;
	is_not_empty?: true;
};

type NumberFilters = {
	equals?: number;
	does_not_equal?: number;
	greater_than?: number;
	less_than?: number;
	greater_than_or_equal_to?: number;
	less_than_or_equal_to?: number;
	is_empty?: true;
	is_not_empty?: true;
};

type CheckboxFilters = {
	equals?: boolean;
	does_not_equal?: boolean;
};

type SelectFilters<T extends string = string> = {
	equals?: T | (string & {});
	does_not_equal?: T | (string & {});
	is_empty?: true;
	is_not_empty?: true;
};

type MultiSelectFilters<T extends string = string> = {
	contains?: T | (string & {});
	does_not_contain?: T | (string & {});
	is_empty?: true;
	is_not_empty?: true;
};

type DateFilters = {
	equals?: string;
	before?: string;
	after?: string;
	on_or_before?: string;
	on_or_after?: string;
	is_empty?: true;
	is_not_empty?: true;
	past_week?: {};
	past_month?: {};
	past_year?: {};
	this_week?: {};
	next_week?: {};
	next_month?: {};
	next_year?: {};
};

type FilterForColumnType<
	PropertyValue,
	ColumnType extends string,
> = ColumnType extends "title" | "rich_text" | "url" | "email" | "phone_number"
	? TextFilters
	: ColumnType extends "number"
		? NumberFilters
		: ColumnType extends "checkbox"
			? CheckboxFilters
			: ColumnType extends "select"
				? SelectFilters<Extract<NonNullable<PropertyValue>, string>>
				: ColumnType extends "multi_select"
					? MultiSelectFilters<
							Extract<NonNullable<PropertyValue>, string[]>[number]
						>
					: ColumnType extends "date"
						? DateFilters
						: ColumnType extends "status"
							? SelectFilters<Extract<NonNullable<PropertyValue>, string>>
							: TextFilters;

type SingleFilter<Definition extends DatabaseDefinition> = {
	[K in keyof DatabaseSchema<Definition>]?: FilterForColumnType<
		DatabaseSchema<Definition>[K],
		DatabaseColumnTypes<Definition>[K]
	>;
};

type CompoundFilter<Definition extends DatabaseDefinition> =
	| {
			and: Array<SingleFilter<Definition> | CompoundFilter<Definition>>;
	  }
	| {
			or: Array<SingleFilter<Definition> | CompoundFilter<Definition>>;
	  };

export type QueryFilter<Definition extends DatabaseDefinition> =
	| SingleFilter<Definition>
	| CompoundFilter<Definition>;

type SortDirection = "ascending" | "descending";
type TimestampSort = {
	timestamp: "created_time" | "last_edited_time";
	direction: SortDirection;
};
type PropertySort<Definition extends DatabaseDefinition> = {
	property: Extract<keyof DatabaseColumnTypes<Definition>, string>;
	direction: SortDirection;
};
type SortBy<Definition extends DatabaseDefinition> = Array<
	PropertySort<Definition> | TimestampSort
>;

export type ProjectionPropertyName<Schema extends object> = Extract<
	keyof Schema,
	string
>;
export type ProjectionPropertyList<Schema extends object> =
	readonly ProjectionPropertyName<Schema>[];
export type Projection<Schema extends object> =
	| { select: ProjectionPropertyList<Schema>; omit?: never }
	| { omit: ProjectionPropertyList<Schema>; select?: never }
	| { select?: undefined; omit?: undefined };

type ResolvedProjection<
	Schema extends object,
	ProjectionSelection extends Projection<Schema> | undefined,
> = ProjectionSelection extends Projection<Schema>
	? ProjectionSelection
	: Projection<Schema>;

export type ResultProjection<
		Schema extends object,
		ProjectionSelection extends Projection<Schema> | undefined = undefined,
	> = [ProjectionSelection] extends [undefined]
		? Partial<Schema>
		: [ProjectionSelection] extends [
					{
						select: infer SelectedPropertyNames extends
							ProjectionPropertyList<Schema>;
					},
				]
			? Partial<Pick<Schema, SelectedPropertyNames[number]>>
			: [ProjectionSelection] extends [
						{
							omit: infer OmittedPropertyNames extends
								ProjectionPropertyList<Schema>;
						},
					]
				? Partial<Omit<Schema, OmittedPropertyNames[number]>>
				: Partial<Schema>;

export type FindMany<
		Definition extends DatabaseDefinition,
		ProjectionSelection extends
			| Projection<DatabaseSchema<Definition>>
			| undefined = undefined,
	> = {
		where?: QueryFilter<Definition>;
		sortBy?: SortBy<Definition>;
		size?: number;
		stream?: number;
		after?: string | null;
	} & ResolvedProjection<DatabaseSchema<Definition>, ProjectionSelection>;

export type FindFirst<
		Definition extends DatabaseDefinition,
		ProjectionSelection extends
			| Projection<DatabaseSchema<Definition>>
			| undefined = undefined,
	> = {
		where?: QueryFilter<Definition>;
		sortBy?: SortBy<Definition>;
	} & ResolvedProjection<DatabaseSchema<Definition>, ProjectionSelection>;

export type FindUnique<
		Schema extends object,
		ProjectionSelection extends Projection<Schema> | undefined = undefined,
	> = {
		where: { id: string };
	} & ResolvedProjection<Schema, ProjectionSelection>;

export type PaginateResult<Row extends object> = {
	data: Row[];
	nextCursor: string | null;
	hasMore: boolean;
};

export type Count<
		Definition extends DatabaseDefinition,
	> = {
		where?: QueryFilter<Definition>;
	};

export type Create<Schema extends object> = {
	properties: Schema;
	icon?:
		| { type: "emoji"; emoji: string }
		| { type: "external"; external: { url: string } };
	cover?: { type: "external"; external: { url: string } };
	markdown?: string;
};

export type CreateMany<Schema extends object> = {
	properties: Schema[];
};

export type Update<Schema extends object> = {
	where: { id: string };
	properties: Partial<Schema>;
};

export type UpdateMany<
		Definition extends DatabaseDefinition,
	> = {
		where: QueryFilter<Definition>;
		properties: Partial<CreateSchema<Definition>>;
	};

export type Upsert<
		Definition extends DatabaseDefinition,
	> = {
		where: QueryFilter<Definition>;
		create: CreateSchema<Definition>;
		update: Partial<CreateSchema<Definition>>;
		sortBy?: SortBy<Definition>;
	};

export type Delete = {
	where: { id: string };
};

export type DeleteMany<
		Definition extends DatabaseDefinition,
	> = {
		where: QueryFilter<Definition>;
	};

export type Query<Definition extends DatabaseDefinition> = {
	filter?: QueryFilter<Definition>;
	sort?: SortBy<Definition>;
	includeRawResponse?: boolean;
};

export class DatabaseClient<Definition extends DatabaseDefinition> {
		constructor(_args: {
			id: string;
			columns: DatabaseColumns;
			auth: string;
			name: string;
		}) {}

		findMany<
			ProjectionSelection extends
				| Projection<DatabaseSchema<Definition>>
				| undefined = undefined,
		>(
			_args: FindMany<Definition, ProjectionSelection> & {
				stream: number;
			},
		): AsyncIterable<
			ResultProjection<
				DatabaseSchema<Definition>,
				ProjectionSelection
			>
		>;
		findMany<
			ProjectionSelection extends
				| Projection<DatabaseSchema<Definition>>
				| undefined = undefined,
		>(
			_args: FindMany<Definition, ProjectionSelection> & {
				after: string | null;
			},
		): Promise<
			PaginateResult<
				ResultProjection<
					DatabaseSchema<Definition>,
					ProjectionSelection
				>
			>
		>;
		findMany<
			ProjectionSelection extends
				| Projection<DatabaseSchema<Definition>>
				| undefined = undefined,
		>(
			_args?: FindMany<Definition, ProjectionSelection>,
		): Promise<
			Array<
				ResultProjection<
					DatabaseSchema<Definition>,
					ProjectionSelection
				>
			>
		>;
		findMany(): Promise<
			Array<ResultProjection<DatabaseSchema<Definition>>>
		> {
			return Promise.resolve([]);
		}

		async findFirst<
			ProjectionSelection extends
				| Projection<DatabaseSchema<Definition>>
				| undefined = undefined,
		>(
			_args?: FindFirst<Definition, ProjectionSelection>,
		): Promise<
			ResultProjection<
				DatabaseSchema<Definition>,
				ProjectionSelection
			> | null
		> {
			return null;
		}

		async findUnique<
			ProjectionSelection extends
				| Projection<DatabaseSchema<Definition>>
				| undefined = undefined,
		>(
			_args: FindUnique<
				DatabaseSchema<Definition>,
				ProjectionSelection
			>,
		): Promise<
			ResultProjection<
				DatabaseSchema<Definition>,
				ProjectionSelection
			> | null
		> {
			return null;
		}

		async count(_args?: Count<Definition>): Promise<number> {
			return 0;
		}

		async create(
			_args: Create<CreateSchema<Definition>>,
		): Promise<{ id: string }> {
			return { id: "mock-page-id" };
		}

		async createMany(
			_args: CreateMany<CreateSchema<Definition>>,
		): Promise<Array<{ id: string }>> {
			return [];
		}

		async update(
			_args: Update<CreateSchema<Definition>>,
		): Promise<void> {}

		async updateMany(_args: UpdateMany<Definition>): Promise<void> {}

		async upsert(
			_args: Upsert<Definition>,
		): Promise<{ id: string } | undefined> {
			return { id: "mock-page-id" };
		}

		async delete(_args: Delete): Promise<void> {}

		async deleteMany(_args: DeleteMany<Definition>): Promise<void> {}
	}

export type AgentIcon =
	| { type: "emoji"; emoji: string }
	| { type: "external"; external: { url: string } }
	| null;

export type ThreadInfo = {
	threadId: string;
	agentId: string;
	messages: Array<{ role: "user" | "agent"; content: string }>;
};

export class AgentClient {
	readonly id: string;
	readonly name: string;
	readonly icon: AgentIcon;

	constructor(args: {
		auth: string;
		id: string;
		name: string;
		icon?: AgentIcon;
	}) {
		this.id = args.id;
		this.name = args.name;
		this.icon = args.icon ?? null;
	}

	async listThreads(): Promise<
		Array<{ id: string; title: string; status: "active" | "archived" }>
	> {
		return [];
	}

	async getThreadInfo(
		threadId: string,
	): Promise<{ id: string; title: string; status: "active" | "archived" }> {
		return { id: threadId, title: "Mock Thread", status: "active" };
	}

	async chat(_props: { message: string; threadId?: string }): Promise<{
		status: "active" | "archived";
		threadId: string;
		isNewChat: boolean;
	}> {
		return {
			status: "active",
			threadId: "mock-thread-id",
			isNewChat: true,
		};
	}

	async chatStream(_props: {
		message: string;
		threadId?: string;
		onMessage?: (message: { role: "user" | "agent"; content: string }) => void;
	}): Promise<ThreadInfo> {
		return {
			threadId: "mock-thread-id",
			agentId: this.id,
			messages: [],
		};
	}

	static getAgentResponse(threadInfo: ThreadInfo): string {
		return threadInfo.messages
			.filter((message) => message.role === "agent")
			.map((message) => message.content)
			.join("");
	}

	async getMessages(
		_threadId: string,
		_options?: { role?: "user" | "agent" },
	): Promise<Array<{ role: "user" | "agent"; content: string }>> {
		return [];
	}

	async pollThread(_threadId: string): Promise<{
		status: "active" | "archived";
		threadId: string;
		title?: string;
	}> {
		return {
			status: "active",
			threadId: "mock-thread-id",
			title: "Mock Thread",
		};
	}
}

export type NotionConfigType = {
	auth: string;
	databases?: string[];
	agents?: string[];
};
