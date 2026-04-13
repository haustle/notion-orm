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
		Schema extends object,
		ColumnTypes extends Record<keyof Schema, string>,
		ProjectionSelection extends Projection<Schema> | undefined = undefined,
	> = {
		where?: QueryFilter<Schema, ColumnTypes>;
		sortBy?: SortBy<ColumnTypes>;
		size?: number;
		stream?: number;
		after?: string | null;
	} & ResolvedProjection<Schema, ProjectionSelection>;

export type FindFirst<
		Schema extends object,
		ColumnTypes extends Record<keyof Schema, string>,
		ProjectionSelection extends Projection<Schema> | undefined = undefined,
	> = {
		where?: QueryFilter<Schema, ColumnTypes>;
		sortBy?: SortBy<ColumnTypes>;
	} & ResolvedProjection<Schema, ProjectionSelection>;

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
		Schema extends object,
		ColumnTypes extends Record<keyof Schema, string>,
	> = {
		where?: QueryFilter<Schema, ColumnTypes>;
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
		Schema extends object,
		ColumnTypes extends Record<keyof Schema, string>,
	> = {
		where: QueryFilter<Schema, ColumnTypes>;
		properties: Partial<Schema>;
	};

export type Upsert<
		Schema extends object,
		ColumnTypes extends Record<keyof Schema, string>,
	> = {
		where: QueryFilter<Schema, ColumnTypes>;
		create: Schema;
		update: Partial<Schema>;
	};

export type Delete = {
	where: { id: string };
};

export type DeleteMany<
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
				| Projection<Schema>
				| undefined = undefined,
		>(
			_args: FindMany<Schema, ColumnTypes, ProjectionSelection> & {
				stream: number;
			},
		): AsyncIterable<ResultProjection<Schema, ProjectionSelection>>;
		findMany<
			ProjectionSelection extends
				| Projection<Schema>
				| undefined = undefined,
		>(
			_args: FindMany<Schema, ColumnTypes, ProjectionSelection> & {
				after: string | null;
			},
		): Promise<PaginateResult<ResultProjection<Schema, ProjectionSelection>>>;
		findMany<
			ProjectionSelection extends
				| Projection<Schema>
				| undefined = undefined,
		>(
			_args?: FindMany<Schema, ColumnTypes, ProjectionSelection>,
		): Promise<Array<ResultProjection<Schema, ProjectionSelection>>>;
		findMany(): Promise<Array<ResultProjection<Schema>>> {
			return Promise.resolve([]);
		}

		async findFirst<
			ProjectionSelection extends
				| Projection<Schema>
				| undefined = undefined,
		>(
			_args?: FindFirst<Schema, ColumnTypes, ProjectionSelection>,
		): Promise<ResultProjection<Schema, ProjectionSelection> | null> {
			return null;
		}

		async findUnique<
			ProjectionSelection extends
				| Projection<Schema>
				| undefined = undefined,
		>(
			_args: FindUnique<Schema, ProjectionSelection>,
		): Promise<ResultProjection<Schema, ProjectionSelection> | null> {
			return null;
		}

		async count(_args?: Count<Schema, ColumnTypes>): Promise<number> {
			return 0;
		}

		async create(_args: Create<Schema>): Promise<{ id: string }> {
			return { id: "mock-page-id" };
		}

		async createMany(
			_args: CreateMany<Schema>,
		): Promise<Array<{ id: string }>> {
			return [];
		}

		async update(_args: Update<Schema>): Promise<void> {}

		async updateMany(
			_args: UpdateMany<Schema, ColumnTypes>,
		): Promise<void> {}

		async upsert(
			_args: Upsert<Schema, ColumnTypes>,
		): Promise<{ id: string } | undefined> {
			return { id: "mock-page-id" };
		}

		async delete(_args: Delete): Promise<void> {}

		async deleteMany(
			_args: DeleteMany<Schema, ColumnTypes>,
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
