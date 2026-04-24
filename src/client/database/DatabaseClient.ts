import { Client } from "@notionhq/client";
import type {
	CreatePageParameters,
	CreatePageResponse,
	GetPageResponse,
} from "@notionhq/client/build/src/api-endpoints";
import { PACKAGE_RUNTIME_CONSTANTS } from "../../runtime-constants";
import { objectKeys } from "../../typeUtils";
import {
	buildCreatePageParametersForDataSource,
	mapDatabaseSchemaToNotionPropertyMap,
} from "./create";
import { buildZodFromColumns } from "./schema-builder";
import { buildDataSourceQueryParams } from "./query/build-query-params";
import { buildQueryResponse } from "./query/build-query-response";
import { isNotFoundError } from "./query/http-guards";
import {
	isFullPage,
	isPageInDataSource,
	normalizePageResult,
} from "./query/normalize-page-result";
import {
	collectPageIdsMatchingFilter,
	findMatchingQueryRowsWithNotionPageIds,
	findRowWithPageId,
} from "./query/page-collection";
import {
	applyProjection,
	applyProjectionToRow,
	type NormalizedProjection,
	normalizeProjection,
} from "./query/projection";
import {
	type SafeParseSchema,
	validateDatabaseQueryRow,
} from "./query/schema-drift-validation";
import type {
	camelPropertyNameToNameAndTypeMapType,
	DatabaseColumns,
	Count,
	Create,
	CreateMany,
	CreateSchema,
	DatabaseDefinition,
	DatabaseSchema,
	Delete,
	DeleteMany,
	FindFirst,
	FindMany,
	FindManyList,
	FindManyPaginated,
	FindManyStream,
	FindUnique,
	PaginateResult,
	Projection,
	ProjectionPropertyName,
	ProjectionSelection,
	PropertyNameToColumnMetadataMap,
	QuerySort,
	ResultProjection,
	Update,
	UpdateMany,
	Upsert,
} from "./types";

export type {
	PropertyNameToColumnMetadataMap,
	camelPropertyNameToNameAndTypeMapType,
};

export class DatabaseClient<Definition extends DatabaseDefinition> {
	private client: Client;

	public name: string;
	public id: string;

	private columns: DatabaseColumns;
	private schema: SafeParseSchema;
	private loggedSchemaValidationIssues: Set<string>;

	constructor(args: {
		id: string;
		columns: DatabaseColumns;
		auth: string;
		name: string;
	}) {
		const fetchImpl =
			typeof fetch !== "undefined" ? fetch.bind(globalThis) : undefined;

		this.client = new Client({
			auth: args.auth,
			notionVersion: PACKAGE_RUNTIME_CONSTANTS.NOTION_API_VERSION,
			fetch: fetchImpl,
		});
		this.id = args.id;
		this.columns = args.columns;
		this.schema = buildZodFromColumns(args.columns);
		this.name = args.name;
		this.loggedSchemaValidationIssues = new Set();
	}

	private validateDatabaseSchema(
		result: Partial<DatabaseSchema<Definition>>,
	) {
		validateDatabaseQueryRow({
			result,
			schema: this.schema,
			schemaLabel: this.name ?? this.id,
			columns: this.columns,
			loggedSchemaValidationIssues: this.loggedSchemaValidationIssues,
		});
	}

	private async retrievePageForCurrentDataSource(args: {
		pageId: string;
		operationName: "findUnique" | "update" | "delete";
	}): Promise<GetPageResponse> {
		const page = await this.client.pages.retrieve({
			page_id: args.pageId,
		});
		if (!isFullPage(page) || !isPageInDataSource(page, this.id)) {
			throw new Error(
				`${PACKAGE_RUNTIME_CONSTANTS.PACKAGE_LOG_PREFIX} ${args.operationName}(): page ${args.pageId} does not belong to database ${this.name ?? this.id}.`,
			);
		}
		return page;
	}

	private async createPage(args: {
		properties: CreateSchema<Definition>;
		icon?: CreatePageParameters["icon"];
		cover?: CreatePageParameters["cover"];
		markdown?: CreatePageParameters["markdown"];
	}): Promise<CreatePageResponse> {
		const propertyMap = mapDatabaseSchemaToNotionPropertyMap({
			data: args.properties,
			columns: this.columns,
			partial: false,
		});
		const callBody = buildCreatePageParametersForDataSource({
			dataSourceId: this.id,
			properties: propertyMap,
			icon: args.icon,
			cover: args.cover,
			markdown: args.markdown,
		});
		return await this.client.pages.create(callBody);
	}

	public findMany<
		Projection extends ProjectionSelection<
			DatabaseSchema<Definition>
		> = undefined,
	>(
		args: FindManyStream<Definition, Projection>,
	): AsyncIterable<
		ResultProjection<DatabaseSchema<Definition>, Projection>
	>;
	public findMany<
		Projection extends ProjectionSelection<
			DatabaseSchema<Definition>
		> = undefined,
	>(
		args: FindManyPaginated<Definition, Projection>,
	): Promise<
		PaginateResult<
			ResultProjection<DatabaseSchema<Definition>, Projection>
		>
	>;
	public findMany<
		Projection extends ProjectionSelection<
			DatabaseSchema<Definition>
		> = undefined,
	>(
		args?: FindManyList<Definition, Projection>,
	): Promise<
		Array<ResultProjection<DatabaseSchema<Definition>, Projection>>
	>;
	public findMany(
		args?: FindMany<
			Definition,
			Projection<DatabaseSchema<Definition>>
		>,
	):
		| AsyncIterable<Partial<DatabaseSchema<Definition>>>
		| Promise<PaginateResult<Partial<DatabaseSchema<Definition>>>>
		| Promise<Array<Partial<DatabaseSchema<Definition>>>> {
		const projection = normalizeProjection(args);
		if (args?.stream !== undefined) {
			return this.createStreamIterable(args, projection);
		}
		if (args?.after !== undefined) {
			return this.executeFindManyPaginated(args, projection);
		}
		return this.executeFindMany(args, projection);
	}

	public async findFirst<
		Projection extends ProjectionSelection<
			DatabaseSchema<Definition>
		> = undefined,
	>(
		args?: FindFirst<Definition, Projection>,
	): Promise<
		ResultProjection<DatabaseSchema<Definition>, Projection> | null
	>;
	public async findFirst(
		args?: FindFirst<
			Definition,
			Projection<DatabaseSchema<Definition>>
		>,
	): Promise<Partial<DatabaseSchema<Definition>> | null> {
		const projection = normalizeProjection(args);
		const params = buildDataSourceQueryParams({
			dataSourceId: this.id,
			columns: this.columns,
			where: args?.where,
			sortBy: args?.sortBy,
			size: 1,
		});
		const response = await this.client.dataSources.query(params);
		const { results } = buildQueryResponse<DatabaseSchema<Definition>>({
			response,
			columns: this.columns,
			validateSchema: (result) => this.validateDatabaseSchema(result),
		});
		if (results.length === 0) {
			return null;
		}
		const projected = applyProjection(results, projection);
		return projected[0] ?? null;
	}

	public async findUnique<
		Projection extends ProjectionSelection<
			DatabaseSchema<Definition>
		> = undefined,
	>(
		args: FindUnique<DatabaseSchema<Definition>, Projection>,
	): Promise<
		ResultProjection<DatabaseSchema<Definition>, Projection> | null
	>;
	public async findUnique(
		args: FindUnique<
			DatabaseSchema<Definition>,
			Projection<DatabaseSchema<Definition>>
		>,
	): Promise<Partial<DatabaseSchema<Definition>> | null> {
		const projection = normalizeProjection(args);
		if (!args.where.id) {
			throw new Error(
				`${PACKAGE_RUNTIME_CONSTANTS.PACKAGE_LOG_PREFIX} findUnique(): where.id must be a non-empty string (Notion page id).`,
			);
		}
		try {
			const page = await this.client.pages.retrieve({
				page_id: args.where.id,
			});
			if (!isFullPage(page) || !isPageInDataSource(page, this.id)) {
				return null;
			}
			const normalized = normalizePageResult<DatabaseSchema<Definition>>({
				result: page,
				columns: this.columns,
			});
			return applyProjectionToRow(normalized, projection);
		} catch (error: unknown) {
			if (isNotFoundError(error)) {
				return null;
			}
			throw error;
		}
	}

	public async count(args?: Count<Definition>): Promise<number> {
		let total = 0;
		let cursor: string | undefined;
		let hasMore = true;
		let hasValidatedFirstRow = false;
		while (hasMore) {
			const response: {
				rows: Array<{
					id: string;
					data: Partial<DatabaseSchema<Definition>>;
				}>;
				hasMore: boolean;
				nextCursor: string | undefined;
			} = await findRowWithPageId<Definition>({
				client: this.client,
				dataSourceId: this.id,
				columns: this.columns,
				where: args?.where,
				size: 100,
				after: cursor,
				validateSchema: hasValidatedFirstRow
					? () => {}
					: (result) => this.validateDatabaseSchema(result),
			});
			total += response.rows.length;
			hasValidatedFirstRow ||= response.rows.length > 0;
			hasMore = response.hasMore;
			cursor = response.nextCursor;
		}
		return total;
	}

	public async create(
		args: Create<CreateSchema<Definition>>,
	): Promise<CreatePageResponse> {
		return this.createPage({
			properties: args.properties,
			icon: args.icon,
			cover: args.cover,
			markdown: args.markdown,
		});
	}

	public async createMany(
		items: CreateMany<CreateSchema<Definition>>,
	): Promise<CreatePageResponse[]> {
		if (!Array.isArray(items)) {
			throw new Error(
				`${PACKAGE_RUNTIME_CONSTANTS.PACKAGE_LOG_PREFIX} createMany(): expected an array of create args (\`[{ properties, icon?, cover?, markdown? }]\`). The \`{ properties: [...] }\` and \`{ items: [...] }\` shapes were removed; pass the array directly.`,
			);
		}
		// Sequential: no bulk endpoint, Notion rate-limits ~3 req/sec, and this
		// preserves partial-failure order. Swap to bounded concurrency if needed.
		const results: CreatePageResponse[] = [];
		for (const item of items) {
			results.push(await this.create(item));
		}
		return results;
	}

	public async update(
		args: Update<CreateSchema<Definition>>,
	): Promise<void> {
		if (!args.where.id) {
			throw new Error(
				`${PACKAGE_RUNTIME_CONSTANTS.PACKAGE_LOG_PREFIX} update(): where.id must be a non-empty string (Notion page id).`,
			);
		}
		if (!args.properties || objectKeys(args.properties).length === 0) {
			throw new Error(
				`${PACKAGE_RUNTIME_CONSTANTS.PACKAGE_LOG_PREFIX} update(): pass at least one key in properties.`,
			);
		}
		const properties = mapDatabaseSchemaToNotionPropertyMap({
			data: args.properties,
			columns: this.columns,
			partial: true,
		});
		await this.retrievePageForCurrentDataSource({
			pageId: args.where.id,
			operationName: "update",
		});
		await this.client.pages.update({
			page_id: args.where.id,
			properties,
		});
	}

	public async updateMany(
		args: UpdateMany<Definition>,
	): Promise<void> {
		const pageIds = await collectPageIdsMatchingFilter({
			client: this.client,
			dataSourceId: this.id,
			columns: this.columns,
			where: args.where,
			validateSchema: (result) => this.validateDatabaseSchema(result),
		});
		const properties = mapDatabaseSchemaToNotionPropertyMap({
			data: args.properties,
			columns: this.columns,
			partial: true,
		});
		for (const pageId of pageIds) {
			await this.client.pages.update({
				page_id: pageId,
				properties,
			});
		}
	}

	public async upsert(
		args: Upsert<Definition>,
	): Promise<CreatePageResponse | undefined> {
		const sortBy: QuerySort<Definition> = args.sortBy ?? [
			{ timestamp: "created_time", direction: "ascending" },
		];
		const matches = await findMatchingQueryRowsWithNotionPageIds({
			client: this.client,
			dataSourceId: this.id,
			columns: this.columns,
			where: args.where,
			sortBy,
			size: 2,
			validateSchema: (result) => this.validateDatabaseSchema(result),
		});
		if (matches.length > 1) {
			throw new Error(
				`${PACKAGE_RUNTIME_CONSTANTS.PACKAGE_LOG_PREFIX} upsert(): more than one row matches where. Tighten where, delete duplicates, or use updateMany/create explicitly.`,
			);
		}
		const existing = matches[0];
		if (existing) {
			if (!args.update || objectKeys(args.update).length === 0) {
				throw new Error(
					`${PACKAGE_RUNTIME_CONSTANTS.PACKAGE_LOG_PREFIX} upsert(): when a matching row exists, pass at least one key in update.`,
				);
			}
			const properties = mapDatabaseSchemaToNotionPropertyMap({
				data: args.update,
				columns: this.columns,
				partial: true,
			});
			await this.client.pages.update({
				page_id: existing.id,
				properties,
			});
			return;
		}
		return this.create({ properties: args.create });
	}

	public async delete(args: Delete): Promise<void> {
		if (!args.where.id) {
			throw new Error(
				`${PACKAGE_RUNTIME_CONSTANTS.PACKAGE_LOG_PREFIX} delete(): where.id must be a non-empty string (Notion page id).`,
			);
		}
		await this.retrievePageForCurrentDataSource({
			pageId: args.where.id,
			operationName: "delete",
		});
		await this.client.pages.update({
			page_id: args.where.id,
			in_trash: true,
		});
	}

	public async deleteMany(
		args: DeleteMany<Definition>,
	): Promise<void> {
		const pageIds = await collectPageIdsMatchingFilter({
			client: this.client,
			dataSourceId: this.id,
			columns: this.columns,
			where: args.where,
			validateSchema: (result) => this.validateDatabaseSchema(result),
		});
		for (const pageId of pageIds) {
			await this.client.pages.update({
				page_id: pageId,
				in_trash: true,
			});
		}
	}

	private async executeFindMany(
		args?: FindMany<
			Definition,
			Projection<DatabaseSchema<Definition>>
		>,
		projection: NormalizedProjection<
			ProjectionPropertyName<DatabaseSchema<Definition>>
		> = { mode: "none", keys: new Set() },
	): Promise<Array<Partial<DatabaseSchema<Definition>>>> {
		const params = buildDataSourceQueryParams({
			dataSourceId: this.id,
			columns: this.columns,
			where: args?.where,
			sortBy: args?.sortBy,
			size: args?.size,
		});
		const response = await this.client.dataSources.query(params);
		const { results } = buildQueryResponse<DatabaseSchema<Definition>>({
			response,
			columns: this.columns,
			validateSchema: (result) => this.validateDatabaseSchema(result),
		});
		return applyProjection(results, projection);
	}

	private async executeFindManyPaginated(
		args: FindMany<
			Definition,
			Projection<DatabaseSchema<Definition>>
		>,
		projection: NormalizedProjection<
			ProjectionPropertyName<DatabaseSchema<Definition>>
		> = { mode: "none", keys: new Set() },
	): Promise<PaginateResult<Partial<DatabaseSchema<Definition>>>> {
		const params = buildDataSourceQueryParams({
			dataSourceId: this.id,
			columns: this.columns,
			where: args.where,
			sortBy: args.sortBy,
			size: args.size,
			after: args.after ?? undefined,
		});
		const response = await this.client.dataSources.query(params);
		const { results } = buildQueryResponse<DatabaseSchema<Definition>>({
			response,
			columns: this.columns,
			validateSchema: (result) => this.validateDatabaseSchema(result),
		});
		return {
			data: applyProjection(results, projection),
			nextCursor: response.next_cursor ?? null,
			hasMore: response.has_more,
		};
	}

	private async *createStreamIterable(
		args: FindMany<
			Definition,
			Projection<DatabaseSchema<Definition>>
		>,
		projection: NormalizedProjection<
			ProjectionPropertyName<DatabaseSchema<Definition>>
		> = { mode: "none", keys: new Set() },
	): AsyncGenerator<Partial<DatabaseSchema<Definition>>> {
		const batchSize = args.stream ?? 100;
		let cursor: string | undefined;
		let hasMore = true;
		while (hasMore) {
			const params = buildDataSourceQueryParams({
				dataSourceId: this.id,
				columns: this.columns,
				where: args.where,
				sortBy: args.sortBy,
				size: batchSize,
				after: cursor,
			});
			const response = await this.client.dataSources.query(params);
			const { results } = buildQueryResponse<DatabaseSchema<Definition>>({
				response,
				columns: this.columns,
				validateSchema: (result) => this.validateDatabaseSchema(result),
			});
			const projected = applyProjection(results, projection);
			for (const item of projected) {
				yield item;
			}
			hasMore = response.has_more;
			cursor = response.next_cursor ?? undefined;
		}
	}
}
