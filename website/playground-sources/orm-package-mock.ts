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

type SingleFilter<
	Schema extends object,
	ColumnTypes extends Record<keyof Schema, string>,
> = {
	[K in keyof Schema]?: FilterForColumnType<Schema[K], ColumnTypes[K]>;
};

type CompoundFilter<
	Schema extends object,
	ColumnTypes extends Record<keyof Schema, string>,
> =
	| {
			and: Array<
				SingleFilter<Schema, ColumnTypes> | CompoundFilter<Schema, ColumnTypes>
			>;
	  }
	| {
			or: Array<
				SingleFilter<Schema, ColumnTypes> | CompoundFilter<Schema, ColumnTypes>
			>;
	  };

export type QueryFilter<
	Schema extends object,
	ColumnTypes extends Record<keyof Schema, string>,
> = SingleFilter<Schema, ColumnTypes> | CompoundFilter<Schema, ColumnTypes>;

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

export type ProjectionPropertyName<Schema extends object> = Extract<
	keyof Schema,
	string | number
>;
export type ProjectionPropertyList<Schema extends object> =
	readonly ProjectionPropertyName<Schema>[];
export type ProjectionArgs<Schema extends object> =
	| { select: ProjectionPropertyList<Schema>; omit?: never }
	| { omit: ProjectionPropertyList<Schema>; select?: never }
	| { select?: undefined; omit?: undefined };

type ResolvedProjectionArgs<
	Schema extends object,
	ProjectionSelection extends ProjectionArgs<Schema> | undefined,
> = ProjectionSelection extends ProjectionArgs<Schema>
	? ProjectionSelection
	: ProjectionArgs<Schema>;

export type ProjectedFromArgs<
		Schema extends object,
		ProjectionSelection extends ProjectionArgs<Schema> | undefined = undefined,
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

export type FindManyArgs<
		Schema extends object,
		ColumnTypes extends Record<keyof Schema, string>,
		ProjectionSelection extends ProjectionArgs<Schema> | undefined = undefined,
	> = {
		where?: QueryFilter<Schema, ColumnTypes>;
		sortBy?: SortBy<ColumnTypes>;
		size?: number;
		stream?: number;
		after?: string | null;
	} & ResolvedProjectionArgs<Schema, ProjectionSelection>;

export type FindFirstArgs<
		Schema extends object,
		ColumnTypes extends Record<keyof Schema, string>,
		ProjectionSelection extends ProjectionArgs<Schema> | undefined = undefined,
	> = {
		where?: QueryFilter<Schema, ColumnTypes>;
		sortBy?: SortBy<ColumnTypes>;
	} & ResolvedProjectionArgs<Schema, ProjectionSelection>;

export type FindUniqueArgs<
		Schema extends object,
		ProjectionSelection extends ProjectionArgs<Schema> | undefined = undefined,
	> = {
		where: { id: string };
	} & ResolvedProjectionArgs<Schema, ProjectionSelection>;

export type PaginateResult<Row extends object> = {
	data: Row[];
	nextCursor: string | null;
	hasMore: boolean;
};

export type CountArgs<
		Schema extends object,
		ColumnTypes extends Record<keyof Schema, string>,
	> = {
		where?: QueryFilter<Schema, ColumnTypes>;
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
		ColumnTypes extends Record<keyof Schema, string>,
	> = {
		where: QueryFilter<Schema, ColumnTypes>;
		properties: Partial<Schema>;
	};

export type UpsertArgs<
		Schema extends object,
		ColumnTypes extends Record<keyof Schema, string>,
	> = {
		where: QueryFilter<Schema, ColumnTypes>;
		create: Schema;
		update: Partial<Schema>;
	};

export type DeleteArgs = {
	where: { id: string };
};

export type DeleteManyArgs<
		Schema extends object,
		ColumnTypes extends Record<keyof Schema, string>,
	> = {
		where: QueryFilter<Schema, ColumnTypes>;
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

		findMany<
			ProjectionSelection extends
				| ProjectionArgs<Schema>
				| undefined = undefined,
		>(
			_args: FindManyArgs<Schema, ColumnTypes, ProjectionSelection> & {
				stream: number;
			},
		): AsyncIterable<ProjectedFromArgs<Schema, ProjectionSelection>>;
		findMany<
			ProjectionSelection extends
				| ProjectionArgs<Schema>
				| undefined = undefined,
		>(
			_args: FindManyArgs<Schema, ColumnTypes, ProjectionSelection> & {
				after: string | null;
			},
		): Promise<PaginateResult<ProjectedFromArgs<Schema, ProjectionSelection>>>;
		findMany<
			ProjectionSelection extends
				| ProjectionArgs<Schema>
				| undefined = undefined,
		>(
			_args?: FindManyArgs<Schema, ColumnTypes, ProjectionSelection>,
		): Promise<Array<ProjectedFromArgs<Schema, ProjectionSelection>>>;
		findMany(): Promise<Array<ProjectedFromArgs<Schema>>> {
			return Promise.resolve([]);
		}

		async findFirst<
			ProjectionSelection extends
				| ProjectionArgs<Schema>
				| undefined = undefined,
		>(
			_args?: FindFirstArgs<Schema, ColumnTypes, ProjectionSelection>,
		): Promise<ProjectedFromArgs<Schema, ProjectionSelection> | null> {
			return null;
		}

		async findUnique<
			ProjectionSelection extends
				| ProjectionArgs<Schema>
				| undefined = undefined,
		>(
			_args: FindUniqueArgs<Schema, ProjectionSelection>,
		): Promise<ProjectedFromArgs<Schema, ProjectionSelection> | null> {
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

		async updateMany(
			_args: UpdateManyArgs<Schema, ColumnTypes>,
		): Promise<void> {}

		async upsert(
			_args: UpsertArgs<Schema, ColumnTypes>,
		): Promise<{ id: string } | undefined> {
			return { id: "mock-page-id" };
		}

		async delete(_args: DeleteArgs): Promise<void> {}

		async deleteMany(
			_args: DeleteManyArgs<Schema, ColumnTypes>,
		): Promise<void> {}
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
