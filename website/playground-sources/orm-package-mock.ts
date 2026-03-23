// @ts-nocheck — mock module template served to the website playground editor
type DateValue = { start: string; end?: string | null };

export type DatabasePropertyValue =
	| string
	| number
	| boolean
	| null
	| string[]
	| { name: string; url: string }[]
	| DateValue;

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

type FilterTypeMap<Schema> = {
	[K in keyof Schema]?: Schema[K] extends string
		? TextFilters
		: Schema[K] extends number
			? NumberFilters
			: Schema[K] extends boolean
				? CheckboxFilters
				: Schema[K] extends string[]
					? MultiSelectFilters<Schema[K][number]>
					: Schema[K] extends DateValue
						? DateFilters
						: TextFilters;
};

type CompoundFilter<Schema> =
	| { and: Array<FilterTypeMap<Schema> | CompoundFilter<Schema>> }
	| { or: Array<FilterTypeMap<Schema> | CompoundFilter<Schema>> };

export type QueryFilter<Schema> =
	| FilterTypeMap<Schema>
	| CompoundFilter<Schema>;

type SortDirection = "ascending" | "descending";
type TimestampSort = {
	timestamp: "created_time" | "last_edited_time";
	direction: SortDirection;
};
type PropertySort<ColumnTypes extends Record<string, string>> = {
	property: Extract<keyof ColumnTypes, string>;
	direction: SortDirection;
};
type SortBy<ColumnTypes extends Record<string, string>> = Array<
	PropertySort<ColumnTypes> | TimestampSort
>;

export type Query<
		Schema extends object,
		ColumnTypes extends Record<string, string>,
	> = {
		filter?: QueryFilter<Schema>;
		sort?: SortBy<ColumnTypes>;
		includeRawResponse?: boolean;
	};

export type FindManyArgs<
		Schema extends object,
		ColumnTypes extends Record<string, string>,
	> = {
		where?: QueryFilter<Schema>;
		sortBy?: SortBy<ColumnTypes>;
		size?: number;
		select?: { [K in keyof Schema]?: true };
		omit?: { [K in keyof Schema]?: true };
		stream?: number;
		after?: string | null;
	};

export type FindFirstArgs<
		Schema extends object,
		ColumnTypes extends Record<string, string>,
	> = {
		where?: QueryFilter<Schema>;
		sortBy?: SortBy<ColumnTypes>;
		select?: { [K in keyof Schema]?: true };
		omit?: { [K in keyof Schema]?: true };
	};

export type FindUniqueArgs = {
	where: { id: string };
};

export type PaginateResult<Schema extends object> = {
	data: Partial<Schema>[];
	nextCursor: string | null;
	hasMore: boolean;
};

export type CountArgs<
	Schema extends object,
	_ColumnTypes extends Record<string, string>,
> = {
	where?: QueryFilter<Schema>;
};

export type CreateArgs<Schema extends object> = {
	properties: Schema;
	icon?:
		| { type: "emoji"; emoji: string }
		| { type: "external"; external: { url: string } };
	cover?: { type: "external"; external: { url: string } };
	markdown?: string;
};

export type CreateManyArgs<Schema extends object> = {
	properties: Schema[];
};

export type UpdateArgs<Schema extends object> = {
	where: { id: string };
	properties: Partial<Schema>;
};

export type UpdateManyArgs<
	Schema extends object,
	_ColumnTypes extends Record<string, string>,
> = {
	where: QueryFilter<Schema>;
	properties: Partial<Schema>;
};

export type UpsertArgs<
	Schema extends object,
	_ColumnTypes extends Record<string, string>,
> = {
	where: QueryFilter<Schema>;
	create: Schema;
	update: Partial<Schema>;
};

export type DeleteArgs = {
	where: { id: string };
};

export type DeleteManyArgs<
	Schema extends object,
	_ColumnTypes extends Record<string, string>,
> = {
	where: QueryFilter<Schema>;
};

export class DatabaseClient<
	Schema extends object,
	ColumnTypes extends Record<string, string>,
> {
	constructor(_args: {
		id: string;
		camelPropertyNameToNameAndTypeMap: Record<
			string,
			{ columnName: string; type: string }
		>;
		auth: string;
		name: string;
		schema: unknown;
	}) {}

	async add(_args: {
		properties: Schema;
		icon?: unknown;
		cover?: unknown;
		markdown?: unknown;
	}): Promise<{ id: string }> {
		return { id: "mock-page-id" };
	}

	async query(_query: Query<Schema, ColumnTypes>): Promise<{
		results: Partial<Schema>[];
		rawResponse?: unknown;
	}> {
		return { results: [] };
	}

	findMany(
		_args: FindManyArgs<Schema, ColumnTypes> & { stream: number },
	): AsyncIterable<Partial<Schema>>;
	findMany(
		_args: FindManyArgs<Schema, ColumnTypes> & { after: string | null },
	): Promise<PaginateResult<Schema>>;
	findMany(
		_args?: FindManyArgs<Schema, ColumnTypes>,
	): Promise<Partial<Schema>[]>;
	findMany(): Promise<Partial<Schema>[]> {
		return Promise.resolve([]);
	}

	async findFirst(
		_args?: FindFirstArgs<Schema, ColumnTypes>,
	): Promise<Partial<Schema> | null> {
		return null;
	}

	async findUnique(_args: FindUniqueArgs): Promise<Partial<Schema> | null> {
		return null;
	}

	async count(_args?: CountArgs<Schema, ColumnTypes>): Promise<number> {
		return 0;
	}

	async create(_args: CreateArgs<Schema>): Promise<{ id: string }> {
		return { id: "mock-page-id" };
	}

	async createMany(
		_args: CreateManyArgs<Schema>,
	): Promise<Array<{ id: string }>> {
		return [];
	}

	async update(_args: UpdateArgs<Schema>): Promise<void> {}

	async updateMany(_args: UpdateManyArgs<Schema, ColumnTypes>): Promise<void> {}

	async upsert(
		_args: UpsertArgs<Schema, ColumnTypes>,
	): Promise<{ id: string } | undefined> {
		return { id: "mock-page-id" };
	}

	async delete(_args: DeleteArgs): Promise<void> {}

	async deleteMany(_args: DeleteManyArgs<Schema, ColumnTypes>): Promise<void> {}
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
