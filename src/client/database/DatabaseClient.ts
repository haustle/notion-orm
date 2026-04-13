import { Client } from "@notionhq/client";
import type {
	CreatePageParameters,
	CreatePageResponse,
	GetPageResponse,
} from "@notionhq/client/build/src/api-endpoints";
import { AST_RUNTIME_CONSTANTS } from "../../ast/shared/constants";
import { objectKeys } from "../../typeUtils";
import {
	buildCreatePageParametersForDataSource,
	mapDatabaseSchemaToNotionPropertyMap,
} from "./create";
import { buildDataSourceQueryParams } from "./query/build-query-params";
import { buildQueryResponse } from "./query/build-query-response";
import { isNotFoundError } from "./query/http-guards";
import { isFullPage, normalizePageResult } from "./query/normalize-page-result";
import {
	collectPageIdsMatchingFilter,
	findFirstQueryRowWithNotionPageId,
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
	Count,
	Create,
	CreateMany,
	DatabasePropertyValue,
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
	ResultProjection,
	SupportedNotionColumnType,
	Update,
	UpdateMany,
	Upsert,
} from "./types";

export type {
	PropertyNameToColumnMetadataMap,
	camelPropertyNameToNameAndTypeMapType,
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

	private validateDatabaseSchema(result: Partial<DatabaseSchemaType>) {
		validateDatabaseQueryRow({
			result,
			schema: this.schema,
			schemaLabel: this.name ?? this.id,
			camelPropertyNameToNameAndTypeMap: this.camelPropertyNameToNameAndTypeMap,
			loggedSchemaValidationIssues: this.loggedSchemaValidationIssues,
		});
	}

	private async createPage(args: {
		properties: DatabaseSchemaType;
		icon?: CreatePageParameters["icon"];
		cover?: CreatePageParameters["cover"];
		markdown?: CreatePageParameters["markdown"];
	}): Promise<CreatePageResponse> {
		const propertyMap = mapDatabaseSchemaToNotionPropertyMap({
			data: args.properties,
			camelPropertyNameToNameAndTypeMap: this.camelPropertyNameToNameAndTypeMap,
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
		Projection extends ProjectionSelection<DatabaseSchemaType> = undefined,
	>(
		args: FindManyStream<
			DatabaseSchemaType,
			ColumnNameToColumnType,
			Projection
		>,
	): AsyncIterable<ResultProjection<DatabaseSchemaType, Projection>>;
	public findMany<
		Projection extends ProjectionSelection<DatabaseSchemaType> = undefined,
	>(
		args: FindManyPaginated<
			DatabaseSchemaType,
			ColumnNameToColumnType,
			Projection
		>,
	): Promise<PaginateResult<ResultProjection<DatabaseSchemaType, Projection>>>;
	public findMany<
		Projection extends ProjectionSelection<DatabaseSchemaType> = undefined,
	>(
		args?: FindManyList<
			DatabaseSchemaType,
			ColumnNameToColumnType,
			Projection
		>,
	): Promise<Array<ResultProjection<DatabaseSchemaType, Projection>>>;
	public findMany(
		args?: FindMany<
			DatabaseSchemaType,
			ColumnNameToColumnType,
			Projection<DatabaseSchemaType>
		>,
	):
		| AsyncIterable<Partial<DatabaseSchemaType>>
		| Promise<PaginateResult<Partial<DatabaseSchemaType>>>
		| Promise<Array<Partial<DatabaseSchemaType>>> {
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
		Projection extends ProjectionSelection<DatabaseSchemaType> = undefined,
	>(
		args?: FindFirst<
			DatabaseSchemaType,
			ColumnNameToColumnType,
			Projection
		>,
	): Promise<ResultProjection<DatabaseSchemaType, Projection> | null>;
	public async findFirst(
		args?: FindFirst<
			DatabaseSchemaType,
			ColumnNameToColumnType,
			Projection<DatabaseSchemaType>
		>,
	): Promise<Partial<DatabaseSchemaType> | null> {
		const projection = normalizeProjection(args);
		const params = buildDataSourceQueryParams({
			dataSourceId: this.id,
			camelPropertyNameToNameAndTypeMap: this.camelPropertyNameToNameAndTypeMap,
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
		const projected = applyProjection(results, projection);
		return projected[0] ?? null;
	}

	public async findUnique<
		Projection extends ProjectionSelection<DatabaseSchemaType> = undefined,
	>(
		args: FindUnique<DatabaseSchemaType, Projection>,
	): Promise<ResultProjection<DatabaseSchemaType, Projection> | null>;
	public async findUnique(
		args: FindUnique<
			DatabaseSchemaType,
			Projection<DatabaseSchemaType>
		>,
	): Promise<Partial<DatabaseSchemaType> | null> {
		const projection = normalizeProjection(args);
		if (!args?.where?.id) {
			throw new Error(
				`${AST_RUNTIME_CONSTANTS.PACKAGE_LOG_PREFIX} findUnique(): where.id must be a non-empty string (Notion page id).`,
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
			return applyProjectionToRow(normalized, projection);
		} catch (error: unknown) {
			if (isNotFoundError(error)) {
				return null;
			}
			throw error;
		}
	}

	public async count(
		args?: Count<DatabaseSchemaType, ColumnNameToColumnType>,
	): Promise<number> {
		let total = 0;
		let cursor: string | undefined;
		let hasMore = true;
		while (hasMore) {
			const params = buildDataSourceQueryParams({
				dataSourceId: this.id,
				camelPropertyNameToNameAndTypeMap:
					this.camelPropertyNameToNameAndTypeMap,
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
		args: Create<DatabaseSchemaType>,
	): Promise<CreatePageResponse> {
		return this.createPage({
			properties: args.properties,
			icon: args.icon,
			cover: args.cover,
			markdown: args.markdown,
		});
	}

	public async createMany(
		args: CreateMany<DatabaseSchemaType>,
	): Promise<CreatePageResponse[]> {
		const results: CreatePageResponse[] = [];
		for (const properties of args.properties) {
			results.push(await this.create({ properties }));
		}
		return results;
	}

	public async update(args: Update<DatabaseSchemaType>): Promise<void> {
		if (!args?.where?.id) {
			throw new Error(
				`${AST_RUNTIME_CONSTANTS.PACKAGE_LOG_PREFIX} update(): where.id must be a non-empty string (Notion page id).`,
			);
		}
		if (!args.properties || objectKeys(args.properties).length === 0) {
			throw new Error(
				`${AST_RUNTIME_CONSTANTS.PACKAGE_LOG_PREFIX} update(): pass at least one key in properties.`,
			);
		}
		const properties = mapDatabaseSchemaToNotionPropertyMap({
			data: args.properties,
			camelPropertyNameToNameAndTypeMap: this.camelPropertyNameToNameAndTypeMap,
			partial: true,
		});
		await this.client.pages.update({
			page_id: args.where.id,
			properties,
		});
	}

	public async updateMany(
		args: UpdateMany<DatabaseSchemaType, ColumnNameToColumnType>,
	): Promise<void> {
		const pageIds = await collectPageIdsMatchingFilter({
			client: this.client,
			dataSourceId: this.id,
			camelPropertyNameToNameAndTypeMap: this.camelPropertyNameToNameAndTypeMap,
			where: args.where,
		});
		const properties = mapDatabaseSchemaToNotionPropertyMap({
			data: args.properties,
			camelPropertyNameToNameAndTypeMap: this.camelPropertyNameToNameAndTypeMap,
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
		args: Upsert<DatabaseSchemaType, ColumnNameToColumnType>,
	): Promise<CreatePageResponse | undefined> {
		const existing = await findFirstQueryRowWithNotionPageId({
			client: this.client,
			dataSourceId: this.id,
			camelPropertyNameToNameAndTypeMap: this.camelPropertyNameToNameAndTypeMap,
			where: args.where,
			validateSchema: (result) => this.validateDatabaseSchema(result),
		});
		if (existing) {
			const properties = mapDatabaseSchemaToNotionPropertyMap({
				data: args.update,
				camelPropertyNameToNameAndTypeMap:
					this.camelPropertyNameToNameAndTypeMap,
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
		if (!args?.where?.id) {
			throw new Error(
				`${AST_RUNTIME_CONSTANTS.PACKAGE_LOG_PREFIX} delete(): where.id must be a non-empty string (Notion page id).`,
			);
		}
		await this.client.pages.update({
			page_id: args.where.id,
			in_trash: true,
		});
	}

	public async deleteMany(
		args: DeleteMany<DatabaseSchemaType, ColumnNameToColumnType>,
	): Promise<void> {
		const pageIds = await collectPageIdsMatchingFilter({
			client: this.client,
			dataSourceId: this.id,
			camelPropertyNameToNameAndTypeMap: this.camelPropertyNameToNameAndTypeMap,
			where: args.where,
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
			DatabaseSchemaType,
			ColumnNameToColumnType,
			Projection<DatabaseSchemaType>
		>,
		projection: NormalizedProjection<
			ProjectionPropertyName<DatabaseSchemaType>
		> = { mode: "none", keys: new Set() },
	): Promise<Array<Partial<DatabaseSchemaType>>> {
		const params = buildDataSourceQueryParams({
			dataSourceId: this.id,
			camelPropertyNameToNameAndTypeMap: this.camelPropertyNameToNameAndTypeMap,
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
		return applyProjection(results, projection);
	}

	private async executeFindManyPaginated(
		args: FindMany<
			DatabaseSchemaType,
			ColumnNameToColumnType,
			Projection<DatabaseSchemaType>
		>,
		projection: NormalizedProjection<
			ProjectionPropertyName<DatabaseSchemaType>
		> = { mode: "none", keys: new Set() },
	): Promise<PaginateResult<Partial<DatabaseSchemaType>>> {
		const params = buildDataSourceQueryParams({
			dataSourceId: this.id,
			camelPropertyNameToNameAndTypeMap: this.camelPropertyNameToNameAndTypeMap,
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
			data: applyProjection(results, projection),
			nextCursor: response.next_cursor ?? null,
			hasMore: response.has_more,
		};
	}

	private async *createStreamIterable(
		args: FindMany<
			DatabaseSchemaType,
			ColumnNameToColumnType,
			Projection<DatabaseSchemaType>
		>,
		projection: NormalizedProjection<
			ProjectionPropertyName<DatabaseSchemaType>
		> = { mode: "none", keys: new Set() },
	): AsyncGenerator<Partial<DatabaseSchemaType>> {
		const batchSize = args.stream ?? 100;
		let cursor: string | undefined;
		let hasMore = true;
		while (hasMore) {
			const params = buildDataSourceQueryParams({
				dataSourceId: this.id,
				camelPropertyNameToNameAndTypeMap:
					this.camelPropertyNameToNameAndTypeMap,
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
			const projected = applyProjection(results, projection);
			for (const item of projected) {
				yield item;
			}
			hasMore = response.has_more;
			cursor = response.next_cursor ?? undefined;
		}
	}
}
