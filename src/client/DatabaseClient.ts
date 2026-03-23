import { Client } from "@notionhq/client";
import type {
	CreatePageParameters,
	CreatePageResponse,
	GetPageResponse,
	QueryDataSourceParameters,
} from "@notionhq/client/build/src/api-endpoints";
import { AST_RUNTIME_CONSTANTS } from "../ast/shared/constants";
import { objectEntries, objectKeys } from "../typeUtils";
import { buildPropertyValueForAddPage } from "./add";
import {
	buildQueryResponse,
	isFullPage,
	normalizePageResult,
	transformQueryFilterToApiFilter,
	transformQuerySortToApiSorts,
} from "./query";
import type {
	CountArgs,
	CreateArgs,
	CreateManyArgs,
	DatabasePropertyValue,
	DeleteArgs,
	DeleteManyArgs,
	FindFirstArgs,
	FindManyArgs,
	FindUniqueArgs,
	PaginateResult,
	ProjectedFromArgs,
	ProjectionArgs,
	ProjectionPropertyName,
	QueryFilter,
	QuerySort,
	SupportedNotionColumnType,
	UpdateArgs,
	UpdateManyArgs,
	UpsertArgs,
} from "./queryTypes";

function hasStatus(error: unknown): error is { status: number } {
	return (
		typeof error === "object" &&
		error !== null &&
		"status" in error &&
		typeof error.status === "number"
	);
}

function isNotFoundError(error: unknown): boolean {
	return hasStatus(error) && error.status === 404;
}

export type PropertyNameToColumnMetadataMap = Record<
	string,
	{ columnName: string; type: SupportedNotionColumnType }
>;
export type camelPropertyNameToNameAndTypeMapType =
	PropertyNameToColumnMetadataMap;

type SchemaValidationIssue = {
	code?: string;
	path: PropertyKey[];
	message: string;
};

type SafeParseSchemaError = {
	issues: SchemaValidationIssue[];
};

type SafeParseSchemaResult =
	| { success: true }
	| { success: false; error: SafeParseSchemaError };

type SafeParseSchema = {
	safeParse: (input: unknown) => SafeParseSchemaResult;
};

type NormalizedProjection<PropertyName extends string | number> = {
	mode: "none" | "select" | "omit";
	keys: Set<PropertyName>;
};

type ProjectionSelection<
	DatabaseSchemaType extends Record<string, DatabasePropertyValue>,
> = ProjectionArgs<DatabaseSchemaType> | undefined;

type FindManyStreamArgs<
	DatabaseSchemaType extends Record<string, DatabasePropertyValue>,
	ColumnNameToColumnType extends Record<
		keyof DatabaseSchemaType,
		SupportedNotionColumnType
	>,
	Projection extends ProjectionSelection<DatabaseSchemaType>,
> = FindManyArgs<DatabaseSchemaType, ColumnNameToColumnType, Projection> & {
	stream: number;
	after?: never;
};

type FindManyPaginatedArgs<
	DatabaseSchemaType extends Record<string, DatabasePropertyValue>,
	ColumnNameToColumnType extends Record<
		keyof DatabaseSchemaType,
		SupportedNotionColumnType
	>,
	Projection extends ProjectionSelection<DatabaseSchemaType>,
> = FindManyArgs<DatabaseSchemaType, ColumnNameToColumnType, Projection> & {
	after: string | null;
	stream?: never;
};

type FindManyListArgs<
	DatabaseSchemaType extends Record<string, DatabasePropertyValue>,
	ColumnNameToColumnType extends Record<
		keyof DatabaseSchemaType,
		SupportedNotionColumnType
	>,
	Projection extends ProjectionSelection<DatabaseSchemaType>,
> = FindManyArgs<DatabaseSchemaType, ColumnNameToColumnType, Projection> & {
	after?: never;
	stream?: never;
};

export class DatabaseClient<
		DatabaseSchemaType extends Record<string, DatabasePropertyValue>,
		ColumnNameToColumnType extends Record<
			keyof DatabaseSchemaType,
			SupportedNotionColumnType
		>,
	> {
		private client: Client;

		public name: string;
		public id: string;

		private camelPropertyNameToNameAndTypeMap: PropertyNameToColumnMetadataMap;
		private schema: SafeParseSchema;
		private loggedSchemaValidationIssues: Set<string>;

		constructor(args: {
			id: string;
			camelPropertyNameToNameAndTypeMap: camelPropertyNameToNameAndTypeMapType;
			auth: string;
			name: string;
			schema: SafeParseSchema;
		}) {
			// Bind the global fetch implementation so edge runtimes do not trip
			// over illegal invocation when the Notion SDK calls it.
			const fetchImpl =
				typeof fetch !== "undefined" ? fetch.bind(globalThis) : undefined;

			this.client = new Client({
				auth: args.auth,
				notionVersion: AST_RUNTIME_CONSTANTS.NOTION_API_VERSION,
				fetch: fetchImpl,
			});
			this.id = args.id;
			this.camelPropertyNameToNameAndTypeMap =
				args.camelPropertyNameToNameAndTypeMap;
			this.schema = args.schema;
			this.name = args.name;
			this.loggedSchemaValidationIssues = new Set();
		}

		private async createPage(args: {
			properties: DatabaseSchemaType;
			icon?: CreatePageParameters["icon"];
			cover?: CreatePageParameters["cover"];
			markdown?: CreatePageParameters["markdown"];
		}): Promise<CreatePageResponse> {
			const { properties: pageObject, icon, cover, markdown } = args;
			const callBody: CreatePageParameters = {
				parent: {
					data_source_id: this.id,
					type: "data_source_id",
				},
				properties: {},
			};

			callBody.icon = icon;
			callBody.cover = cover;
			callBody.markdown = markdown;

			for (const [propertyName, value] of objectEntries(pageObject)) {
				const metadata = this.camelPropertyNameToNameAndTypeMap[propertyName];
				if (!metadata) {
					continue;
				}
				const columnObject = buildPropertyValueForAddPage({
					type: metadata.type,
					value,
				});

				if (callBody.properties && columnObject) {
					callBody.properties[metadata.columnName] = columnObject;
				}
			}

			return await this.client.pages.create(callBody);
		}

		public findMany<
			Projection extends ProjectionSelection<DatabaseSchemaType> = undefined,
		>(
			args: FindManyStreamArgs<
				DatabaseSchemaType,
				ColumnNameToColumnType,
				Projection
			>,
		): AsyncIterable<ProjectedFromArgs<DatabaseSchemaType, Projection>>;
		public findMany<
			Projection extends ProjectionSelection<DatabaseSchemaType> = undefined,
		>(
			args: FindManyPaginatedArgs<
				DatabaseSchemaType,
				ColumnNameToColumnType,
				Projection
			>,
		): Promise<
			PaginateResult<ProjectedFromArgs<DatabaseSchemaType, Projection>>
		>;
		public findMany<
			Projection extends ProjectionSelection<DatabaseSchemaType> = undefined,
		>(
			args?: FindManyListArgs<
				DatabaseSchemaType,
				ColumnNameToColumnType,
				Projection
			>,
		): Promise<Array<ProjectedFromArgs<DatabaseSchemaType, Projection>>>;
		public findMany(
			args?: FindManyArgs<
				DatabaseSchemaType,
				ColumnNameToColumnType,
				ProjectionArgs<DatabaseSchemaType>
			>,
		): AsyncIterable<unknown> | Promise<unknown> {
			const projection = this.normalizeProjection(args);
			if (args?.stream !== undefined) {
				return this.createStreamIterable(args, projection);
			}
			if (args?.after !== undefined) {
				return this.executeFindManyPaginated(args, projection);
			}
			return this.executeFindMany(args, projection);
		}

		public async findFirst<
			Projection extends ProjectionSelection<DatabaseSchemaType> = undefined,
		>(
			args?: FindFirstArgs<
				DatabaseSchemaType,
				ColumnNameToColumnType,
				Projection
			>,
		): Promise<ProjectedFromArgs<DatabaseSchemaType, Projection> | null>;
		public async findFirst(
			args?: FindFirstArgs<
				DatabaseSchemaType,
				ColumnNameToColumnType,
				ProjectionArgs<DatabaseSchemaType>
			>,
		): Promise<Partial<DatabaseSchemaType> | null> {
			const projection = this.normalizeProjection(args);
			const params = this.buildQueryParams({
				where: args?.where,
				sortBy: args?.sortBy,
				size: 1,
			});
			const response = await this.client.dataSources.query(params);
			const { results } = buildQueryResponse<DatabaseSchemaType>({
				response,
				columnNameToColumnProperties: this.camelPropertyNameToNameAndTypeMap,
				validateSchema: (result) => this.validateDatabaseSchema(result),
			});
			if (results.length === 0) {
				return null;
			}
			const projected = this.applyProjection(results, projection);
			return projected[0] ?? null;
		}

		public async findUnique<
			Projection extends ProjectionSelection<DatabaseSchemaType> = undefined,
		>(
			args: FindUniqueArgs<DatabaseSchemaType, Projection>,
		): Promise<ProjectedFromArgs<DatabaseSchemaType, Projection> | null>;
		public async findUnique(
			args: FindUniqueArgs<
				DatabaseSchemaType,
				ProjectionArgs<DatabaseSchemaType>
			>,
		): Promise<Partial<DatabaseSchemaType> | null> {
			const projection = this.normalizeProjection(args);
			if (!args?.where?.id) {
				throw new Error(
					`${AST_RUNTIME_CONSTANTS.PACKAGE_LOG_PREFIX} findUnique() requires 'where.id' to be a non-empty string.`,
				);
			}
			try {
				const page: GetPageResponse = await this.client.pages.retrieve({
					page_id: args.where.id,
				});
				if (!isFullPage(page)) {
					return null;
				}
				const normalized = normalizePageResult<DatabaseSchemaType>({
					result: page,
					camelPropertyNameToNameAndTypeMap:
						this.camelPropertyNameToNameAndTypeMap,
				});
				return this.applyProjectionToRow(normalized, projection);
			} catch (error: unknown) {
				if (isNotFoundError(error)) {
					return null;
				}
				throw error;
			}
		}

		public async count(
			args?: CountArgs<DatabaseSchemaType, ColumnNameToColumnType>,
		): Promise<number> {
			let total = 0;
			let cursor: string | undefined;
			let hasMore = true;
			while (hasMore) {
				const params = this.buildQueryParams({
					where: args?.where,
					size: 100,
					after: cursor,
				});
				const response = await this.client.dataSources.query(params);
				total += response.results.length;
				hasMore = response.has_more;
				cursor = response.next_cursor ?? undefined;
			}
			return total;
		}

		public async create(
			args: CreateArgs<DatabaseSchemaType>,
		): Promise<CreatePageResponse> {
			return this.createPage({
				properties: args.properties,
				icon: args.icon,
				cover: args.cover,
				markdown: args.markdown,
			});
		}

		public async createMany(
			args: CreateManyArgs<DatabaseSchemaType>,
		): Promise<CreatePageResponse[]> {
			const results: CreatePageResponse[] = [];
			for (const properties of args.properties) {
				results.push(await this.create({ properties }));
			}
			return results;
		}

		public async update(args: UpdateArgs<DatabaseSchemaType>): Promise<void> {
			if (!args?.where?.id) {
				throw new Error(
					`${AST_RUNTIME_CONSTANTS.PACKAGE_LOG_PREFIX} update() requires 'where.id' to be a non-empty string.`,
				);
			}
			if (!args.properties || objectKeys(args.properties).length === 0) {
				throw new Error(
					`${AST_RUNTIME_CONSTANTS.PACKAGE_LOG_PREFIX} update() requires 'properties' to contain at least one property.`,
				);
			}
			const properties = this.buildProperties(args.properties);
			await this.client.pages.update({
				page_id: args.where.id,
				properties,
			});
		}

		public async updateMany(
			args: UpdateManyArgs<DatabaseSchemaType, ColumnNameToColumnType>,
		): Promise<void> {
			const pageIds = await this.queryPageIds({ where: args.where });
			const properties = this.buildProperties(args.properties);
			for (const pageId of pageIds) {
				await this.client.pages.update({
					page_id: pageId,
					properties,
				});
			}
		}

		public async upsert(
			args: UpsertArgs<DatabaseSchemaType, ColumnNameToColumnType>,
		): Promise<CreatePageResponse | undefined> {
			const existing = await this.findFirstWithId({
				where: args.where,
			});
			if (existing) {
				const properties = this.buildProperties(args.update);
				await this.client.pages.update({
					page_id: existing.id,
					properties,
				});
				return;
			}
			return this.create({ properties: args.create });
		}

		public async delete(args: DeleteArgs): Promise<void> {
			if (!args?.where?.id) {
				throw new Error(
					`${AST_RUNTIME_CONSTANTS.PACKAGE_LOG_PREFIX} delete() requires 'where.id' to be a non-empty string.`,
				);
			}
			await this.client.pages.update({
				page_id: args.where.id,
				in_trash: true,
			});
		}

		public async deleteMany(
			args: DeleteManyArgs<DatabaseSchemaType, ColumnNameToColumnType>,
		): Promise<void> {
			const pageIds = await this.queryPageIds({ where: args.where });
			for (const pageId of pageIds) {
				await this.client.pages.update({
					page_id: pageId,
					in_trash: true,
				});
			}
		}

		private buildQueryParams(args: {
			where?: QueryFilter<DatabaseSchemaType, ColumnNameToColumnType>;
			sortBy?: QuerySort<ColumnNameToColumnType>;
			size?: number;
			after?: string;
		}): QueryDataSourceParameters {
			const params: QueryDataSourceParameters = {
				data_source_id: this.id,
			};
			if (args.sortBy) {
				params.sorts = transformQuerySortToApiSorts(
					args.sortBy,
					this.camelPropertyNameToNameAndTypeMap,
				);
			}
			if (args.where) {
				const filters = transformQueryFilterToApiFilter(
					args.where,
					this.camelPropertyNameToNameAndTypeMap,
				);
				if (filters) {
					params.filter = filters;
				}
			}
			if (args.size !== undefined) {
				params.page_size = args.size;
			}
			if (args.after) {
				params.start_cursor = args.after;
			}
			return params;
		}

		private buildProperties(
			data: Partial<DatabaseSchemaType>,
		): CreatePageParameters["properties"] {
			const properties: NonNullable<CreatePageParameters["properties"]> = {};
			for (const [propertyName, value] of objectEntries(data)) {
				if (typeof propertyName !== "string") {
					continue;
				}
				if (value === undefined) {
					continue;
				}
				const meta = this.camelPropertyNameToNameAndTypeMap[propertyName];
				if (!meta) {
					continue;
				}
				const columnObject = buildPropertyValueForAddPage({
					type: meta.type,
					value,
				});
				if (columnObject) {
					properties[meta.columnName] = columnObject;
				}
			}
			return properties;
		}

		private normalizeProjection(
			projectionArgs?: ProjectionArgs<DatabaseSchemaType>,
		): NormalizedProjection<ProjectionPropertyName<DatabaseSchemaType>> {
			const select = projectionArgs?.select;
			const omit = projectionArgs?.omit;
			const hasSelect = select != null && select.length > 0;
			const hasOmit = omit != null && omit.length > 0;
			if (hasSelect && hasOmit) {
				throw new Error(
					`${AST_RUNTIME_CONSTANTS.PACKAGE_LOG_PREFIX} Cannot use both 'select' and 'omit' at the same time.`,
				);
			}
			if (hasSelect) {
				return { mode: "select", keys: new Set(select) };
			}
			if (hasOmit) {
				return { mode: "omit", keys: new Set(omit) };
			}
			return { mode: "none", keys: new Set() };
		}

		private applyProjectionToRow(
			row: Partial<DatabaseSchemaType>,
			projection: NormalizedProjection<
				ProjectionPropertyName<DatabaseSchemaType>
			>,
		): Partial<DatabaseSchemaType> {
			if (projection.mode === "select") {
				const projected: Partial<DatabaseSchemaType> = {};
				for (const key of projection.keys) {
					if (key in row) {
						projected[key] = row[key];
					}
				}
				return projected;
			}
			if (projection.mode === "omit") {
				const projected: Partial<DatabaseSchemaType> = { ...row };
				for (const key of projection.keys) {
					delete projected[key];
				}
				return projected;
			}
			return row;
		}

		private applyProjection(
			results: Partial<DatabaseSchemaType>[],
			projection: NormalizedProjection<
				ProjectionPropertyName<DatabaseSchemaType>
			>,
		): Partial<DatabaseSchemaType>[] {
			if (projection.mode === "none") {
				return results;
			}
			return results.map((row) => this.applyProjectionToRow(row, projection));
		}

		private async executeFindMany(
			args?: FindManyArgs<
				DatabaseSchemaType,
				ColumnNameToColumnType,
				ProjectionArgs<DatabaseSchemaType>
			>,
			projection: NormalizedProjection<
				ProjectionPropertyName<DatabaseSchemaType>
			> = { mode: "none", keys: new Set() },
		): Promise<Array<Partial<DatabaseSchemaType>>> {
			const params = this.buildQueryParams({
				where: args?.where,
				sortBy: args?.sortBy,
				size: args?.size,
			});
			const response = await this.client.dataSources.query(params);
			const { results } = buildQueryResponse<DatabaseSchemaType>({
				response,
				columnNameToColumnProperties: this.camelPropertyNameToNameAndTypeMap,
				validateSchema: (result) => this.validateDatabaseSchema(result),
			});
			return this.applyProjection(results, projection);
		}

		private async executeFindManyPaginated(
			args: FindManyArgs<
				DatabaseSchemaType,
				ColumnNameToColumnType,
				ProjectionArgs<DatabaseSchemaType>
			>,
			projection: NormalizedProjection<
				ProjectionPropertyName<DatabaseSchemaType>
			> = { mode: "none", keys: new Set() },
		): Promise<PaginateResult<Partial<DatabaseSchemaType>>> {
			const params = this.buildQueryParams({
				where: args.where,
				sortBy: args.sortBy,
				size: args.size,
				after: args.after ?? undefined,
			});
			const response = await this.client.dataSources.query(params);
			const { results } = buildQueryResponse<DatabaseSchemaType>({
				response,
				columnNameToColumnProperties: this.camelPropertyNameToNameAndTypeMap,
				validateSchema: (result) => this.validateDatabaseSchema(result),
			});
			return {
				data: this.applyProjection(results, projection),
				nextCursor: response.next_cursor ?? null,
				hasMore: response.has_more,
			};
		}

		private async *createStreamIterable(
			args: FindManyArgs<
				DatabaseSchemaType,
				ColumnNameToColumnType,
				ProjectionArgs<DatabaseSchemaType>
			>,
			projection: NormalizedProjection<
				ProjectionPropertyName<DatabaseSchemaType>
			> = { mode: "none", keys: new Set() },
		): AsyncGenerator<Partial<DatabaseSchemaType>> {
			const batchSize = args.stream ?? 100;
			let cursor: string | undefined;
			let hasMore = true;
			while (hasMore) {
				const params = this.buildQueryParams({
					where: args.where,
					sortBy: args.sortBy,
					size: batchSize,
					after: cursor,
				});
				const response = await this.client.dataSources.query(params);
				const { results } = buildQueryResponse<DatabaseSchemaType>({
					response,
					columnNameToColumnProperties: this.camelPropertyNameToNameAndTypeMap,
					validateSchema: (result) => this.validateDatabaseSchema(result),
				});
				const projected = this.applyProjection(results, projection);
				for (const item of projected) {
					yield item;
				}
				hasMore = response.has_more;
				cursor = response.next_cursor ?? undefined;
			}
		}

		/** Queries for page IDs matching a filter (used by updateMany/deleteMany). */
		private async queryPageIds(args: {
			where: QueryFilter<DatabaseSchemaType, ColumnNameToColumnType>;
		}): Promise<string[]> {
			const ids: string[] = [];
			let cursor: string | undefined;
			let hasMore = true;
			while (hasMore) {
				const params = this.buildQueryParams({
					where: args.where,
					size: 100,
					after: cursor,
				});
				const response = await this.client.dataSources.query(params);
				for (const result of response.results) {
					if (result.object === "page" && "id" in result) {
						ids.push(result.id);
					}
				}
				hasMore = response.has_more;
				cursor = response.next_cursor ?? undefined;
			}
			return ids;
		}

		/** findFirst variant that also returns the Notion page ID (for upsert). */
		private async findFirstWithId(args: {
			where: QueryFilter<DatabaseSchemaType, ColumnNameToColumnType>;
		}): Promise<{ id: string; data: Partial<DatabaseSchemaType> } | null> {
			const params = this.buildQueryParams({ where: args.where, size: 1 });
			const response = await this.client.dataSources.query(params);
			const { results } = buildQueryResponse<DatabaseSchemaType>({
				response,
				columnNameToColumnProperties: this.camelPropertyNameToNameAndTypeMap,
				validateSchema: (result) => this.validateDatabaseSchema(result),
			});
			if (results.length === 0) {
				return null;
			}
			const firstResult = response.results[0];
			if (
				!firstResult ||
				firstResult.object !== "page" ||
				!("id" in firstResult)
			) {
				return null;
			}
			return { id: firstResult.id, data: results[0] };
		}

		private validateDatabaseSchema(result: Partial<DatabaseSchemaType>) {
			if (!this.schema) {
				return;
			}

			const schemaLabel = this.name ?? this.id;
			const remoteColumnNames = new Set<string>(
				objectKeys(result).map((k) => String(k)),
			);

			// Check for missing expected properties (schema drift detection)
			const missingProperties: string[] = [];
			for (const propName of objectKeys(
				this.camelPropertyNameToNameAndTypeMap,
			)) {
				if (!remoteColumnNames.has(propName)) {
					missingProperties.push(propName);
				}
			}

			if (missingProperties.length > 0) {
				const issueSignature = JSON.stringify({
					type: "missing_properties",
					properties: missingProperties,
				});

				if (!this.loggedSchemaValidationIssues.has(issueSignature)) {
					this.loggedSchemaValidationIssues.add(issueSignature);
					// biome-ignore lint/suspicious/noConsole: surface schema drift
					console.error(
						`⚠️ ${AST_RUNTIME_CONSTANTS.PACKAGE_LOG_PREFIX} ${
							AST_RUNTIME_CONSTANTS.SCHEMA_DRIFT_PREFIX
						} for the following Notion database ${schemaLabel}
					\nMissing properties: ${missingProperties
						.map((prop) => `\`${prop}\``)
						.join(", ")}
					\n\n✅ ${AST_RUNTIME_CONSTANTS.SCHEMA_DRIFT_HELP_MESSAGE}
					`,
					);
				}
			}

			// Check for unexpected properties
			for (const remoteColName of remoteColumnNames) {
				if (!this.camelPropertyNameToNameAndTypeMap[remoteColName]) {
					const issueSignature = JSON.stringify({
						type: "unexpected_property",
						property: remoteColName,
					});

					if (!this.loggedSchemaValidationIssues.has(issueSignature)) {
						this.loggedSchemaValidationIssues.add(issueSignature);
						// biome-ignore lint/suspicious/noConsole: unexpected remote properties
						console.error(
							`⚠️ ${AST_RUNTIME_CONSTANTS.PACKAGE_LOG_PREFIX} ${AST_RUNTIME_CONSTANTS.SCHEMA_DRIFT_PREFIX} for the following Notion database ${schemaLabel}
						\nUnexpected property found in remote data: \`${remoteColName}\`
						\n\n✅ ${AST_RUNTIME_CONSTANTS.SCHEMA_DRIFT_HELP_MESSAGE}
						`,
						);
					}
				}
			}

			// Validate against Zod schema
			const parseResult = this.schema.safeParse(result);
			if (parseResult.success === false) {
				const parseError = parseResult.error;
				const issueSignature = JSON.stringify(
					parseError.issues.map((issue: SchemaValidationIssue) => ({
						code: issue.code,
						path: issue.path,
						message: issue.message,
					})),
				);

				if (this.loggedSchemaValidationIssues.has(issueSignature)) {
					return;
				}
				this.loggedSchemaValidationIssues.add(issueSignature);
				// biome-ignore lint/suspicious/noConsole: schema validation failures
				console.error(
					`⚠️ ${AST_RUNTIME_CONSTANTS.PACKAGE_LOG_PREFIX} ${
						AST_RUNTIME_CONSTANTS.SCHEMA_DRIFT_PREFIX
					} for the following Notion database ${schemaLabel}
			\nValidation issues: ${parseError.issues
				.map(
					(issue: SchemaValidationIssue) =>
						`\`${issue.path.join(".")}: ${issue.message}\``,
				)
				.join(", ")}
			\n\n✅ ${AST_RUNTIME_CONSTANTS.SCHEMA_DRIFT_HELP_MESSAGE}
			`,
				);
			}
		}
	}
