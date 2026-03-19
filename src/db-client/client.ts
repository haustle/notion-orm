import { Client } from "@notionhq/client";
import type {
  QueryDataSourceParameters,
} from "@notionhq/client/build/src/api-endpoints";
import type { ZodTypeAny } from "zod";
import { AST_RUNTIME_CONSTANTS } from "../ast/constants";
import { camelize } from "../helpers";
import { buildPropertyValueForAddPage } from "./add";
import { buildQueryResponse, getResponseValue, recursivelyBuildFilter } from "./query";
import type {
  FindManyArgs,
  IconCoverResult,
  PaginateArgs,
  QueryFilter,
  QueryResult,
  SupportedNotionColumnType,
} from "./types";

export type ImageInput = string | Blob | Uint8Array;

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/svg+xml": "svg",
  "image/avif": "avif",
};

function sniffMimeType(bytes: Uint8Array): string {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return "image/gif";
  if (bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return "image/webp";
  return "application/octet-stream";
}

export type camelPropertyNameToNameAndTypeMapType = Record<
  string,
  { columnName: string; type: SupportedNotionColumnType }
>;

export class DatabaseClient<
  DatabaseSchemaType extends Record<string, any>,
  ColumnNameToColumnType extends Record<
    keyof DatabaseSchemaType,
    SupportedNotionColumnType
  >
> {
  private client: Client;
  private id: string;
  private camelPropertyNameToNameAndTypeMap: camelPropertyNameToNameAndTypeMapType;
  private schema: ZodTypeAny;
  public name: string;
  private loggedSchemaValidationIssues: Set<string>;

  constructor(args: {
    id: string;
    camelPropertyNameToNameAndTypeMap: camelPropertyNameToNameAndTypeMapType;
    auth: string;
    name: string;
    schema: ZodTypeAny;
  }) {
    const fetchImpl =
      typeof fetch !== "undefined" ? fetch.bind(globalThis) : undefined;

    this.client = new Client({
      auth: args.auth,
      notionVersion: AST_RUNTIME_CONSTANTS.NOTION_API_VERSION,
      fetch: fetchImpl,
    });
    this.id = args.id;
    this.camelPropertyNameToNameAndTypeMap = args.camelPropertyNameToNameAndTypeMap;
    this.schema = args.schema;
    this.name = args.name;
    this.loggedSchemaValidationIssues = new Set();
  }

  // ─── Read ────────────────────────────────────────────────────────────────────

  /** Find all matching records. When `stream` is set, returns an AsyncIterable fetching in batches of that size. */
  public findMany<Args extends FindManyArgs<DatabaseSchemaType, ColumnNameToColumnType> & { stream: number }>(args: Args): AsyncIterable<Partial<DatabaseSchemaType> & { id: string } & IconCoverResult<Args>>;
  public findMany<S extends Partial<Record<keyof DatabaseSchemaType, true>>, Args extends Omit<FindManyArgs<DatabaseSchemaType, ColumnNameToColumnType>, "stream" | "select"> & { select: S }>(
    args: Args
  ): Promise<({ [K in Extract<keyof S, keyof DatabaseSchemaType>]?: DatabaseSchemaType[K] } & { id: string } & IconCoverResult<Args>)[]>;
  public findMany<O extends Partial<Record<keyof DatabaseSchemaType, true>>, Args extends Omit<FindManyArgs<DatabaseSchemaType, ColumnNameToColumnType>, "stream" | "omit"> & { omit: O }>(
    args: Args
  ): Promise<({ [K in Exclude<keyof DatabaseSchemaType, keyof O>]?: DatabaseSchemaType[K] } & { id: string } & IconCoverResult<Args>)[]>;
  public findMany<Args extends Omit<FindManyArgs<DatabaseSchemaType, ColumnNameToColumnType>, "stream">>(args?: Args): Promise<(Partial<DatabaseSchemaType> & { id: string } & IconCoverResult<Args>)[]>;
  public findMany(args: FindManyArgs<DatabaseSchemaType, ColumnNameToColumnType> = {}): unknown {
    const queryCall = this.buildQueryCall(args);
    if (args.stream) return this.streamingIterable(queryCall, args);
    return this.fetchAllPages(queryCall, args);
  }

  /**
   * Fetch one page of results using Notion's native cursor.
   * Pass the returned `nextCursor` as `after` on the next call to get the next page.
   */
  public async paginate<S extends Partial<Record<keyof DatabaseSchemaType, true>>, Args extends Omit<PaginateArgs<DatabaseSchemaType, ColumnNameToColumnType>, "select"> & { select: S }>(
    args: Args
  ): Promise<{ data: ({ [K in Extract<keyof S, keyof DatabaseSchemaType>]?: DatabaseSchemaType[K] } & { id: string } & IconCoverResult<Args>)[]; nextCursor: string | null; hasMore: boolean }>;
  public async paginate<O extends Partial<Record<keyof DatabaseSchemaType, true>>, Args extends Omit<PaginateArgs<DatabaseSchemaType, ColumnNameToColumnType>, "omit"> & { omit: O }>(
    args: Args
  ): Promise<{ data: ({ [K in Exclude<keyof DatabaseSchemaType, keyof O>]?: DatabaseSchemaType[K] } & { id: string } & IconCoverResult<Args>)[]; nextCursor: string | null; hasMore: boolean }>;
  public async paginate<Args extends PaginateArgs<DatabaseSchemaType, ColumnNameToColumnType>>(args?: Args): Promise<{ data: (Partial<DatabaseSchemaType> & { id: string } & IconCoverResult<Args>)[]; nextCursor: string | null; hasMore: boolean }>;
  public async paginate(args?: PaginateArgs<DatabaseSchemaType, ColumnNameToColumnType>): Promise<{ data: (Partial<DatabaseSchemaType> & { id: string })[]; nextCursor: string | null; hasMore: boolean }> {
    const queryCall = this.buildQueryCall(args ?? {});
    const response = await this.client.dataSources.query({
      ...queryCall,
      page_size: args?.take ?? 100,
      start_cursor: args?.after,
    });
    const results = buildQueryResponse<DatabaseSchemaType>(
      response,
      this.camelPropertyNameToNameAndTypeMap,
      (r) => this.validateDatabaseSchema(r),
      { $icon: args?.$icon, $cover: args?.$cover }
    );
    return {
      data: this.applySelectOmit(results, args?.select, args?.omit),
      nextCursor: response.has_more ? (response.next_cursor ?? null) : null,
      hasMore: response.has_more,
    };
  }

  /** Find the first matching record, or null if none found. */
  public async findFirst<S extends Partial<Record<keyof DatabaseSchemaType, true>>, Args extends Omit<FindManyArgs<DatabaseSchemaType, ColumnNameToColumnType>, "stream" | "select"> & { select: S }>(
    args: Args
  ): Promise<({ [K in Extract<keyof S, keyof DatabaseSchemaType>]?: DatabaseSchemaType[K] } & { id: string } & IconCoverResult<Args>) | null>;
  public async findFirst<O extends Partial<Record<keyof DatabaseSchemaType, true>>, Args extends Omit<FindManyArgs<DatabaseSchemaType, ColumnNameToColumnType>, "stream" | "omit"> & { omit: O }>(
    args: Args
  ): Promise<({ [K in Exclude<keyof DatabaseSchemaType, keyof O>]?: DatabaseSchemaType[K] } & { id: string } & IconCoverResult<Args>) | null>;
  public async findFirst<Args extends Omit<FindManyArgs<DatabaseSchemaType, ColumnNameToColumnType>, "stream">>(args?: Args): Promise<(Partial<DatabaseSchemaType> & { id: string } & IconCoverResult<Args>) | null>;
  public async findFirst(args?: Omit<FindManyArgs<DatabaseSchemaType, ColumnNameToColumnType>, "stream">): Promise<(Partial<DatabaseSchemaType> & { id: string }) | null> {
    const queryCall = this.buildQueryCall(args ?? {});
    const response = await this.client.dataSources.query({ ...queryCall, page_size: 1 });
    const results = buildQueryResponse<DatabaseSchemaType>(
      response,
      this.camelPropertyNameToNameAndTypeMap,
      (r) => this.validateDatabaseSchema(r),
      { $icon: args?.$icon, $cover: args?.$cover }
    );
    if (results.length === 0) return null;
    const [item] = this.applySelectOmit(results, args?.select, args?.omit);
    return item ?? null;
  }

  /** Find a record by its Notion page ID. Returns null if not found. */
  public async findUnique<Args extends {
    where: { id: string };
    select?: Partial<Record<keyof DatabaseSchemaType, true>>;
    omit?: Partial<Record<keyof DatabaseSchemaType, true>>;
    $icon?: true;
    $cover?: true;
  }>(args: Args): Promise<(Partial<DatabaseSchemaType> & { id: string } & IconCoverResult<Args>) | null> {
    try {
      const page = await this.client.pages.retrieve({ page_id: args.where.id });
      if (!("properties" in page)) return null;
      const result = this.parsePage(page as { id: string; properties: Record<string, any>; icon?: any; cover?: any }, { $icon: args.$icon, $cover: args.$cover });
      const [item] = this.applySelectOmit([result], args.select, args.omit);
      return (item ?? null) as any;
    } catch {
      return null;
    }
  }

  // ─── Write ───────────────────────────────────────────────────────────────────

  /** Create a new record and return it. */
  public async create(args: {
    data: DatabaseSchemaType;
    $icon?: ImageInput | null;
    $cover?: ImageInput | null;
  }): Promise<Partial<DatabaseSchemaType> & { id: string }> {
    const callBody = await this.buildCreateBody(args.data, args.$icon, args.$cover);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const page = await this.client.pages.create(callBody as any);
    return this.parsePage(page as { id: string; properties: Record<string, any> });
  }

  /** Create multiple records and return them. */
  public async createMany(args: {
    data: DatabaseSchemaType[];
    $icon?: ImageInput | null;
    $cover?: ImageInput | null;
  }): Promise<(Partial<DatabaseSchemaType> & { id: string })[]> {
    return Promise.all(args.data.map((data) => this.create({ data, $icon: args.$icon, $cover: args.$cover })));
  }

  /** Update a record by its Notion page ID. */
  public async update(args: {
    where: { id: string };
    data: Partial<DatabaseSchemaType>;
    $icon?: ImageInput | null;
    $cover?: ImageInput | null;
  }): Promise<void> {
    const callBody: Record<string, unknown> = { page_id: args.where.id, properties: {} };
    const [icon, cover] = await Promise.all([this.resolveIconCover(args.$icon), this.resolveIconCover(args.$cover)]);
    if (icon !== undefined) callBody.icon = icon;
    if (cover !== undefined) callBody.cover = cover;
    for (const [propertyName, value] of Object.entries(args.data)) {
      const { type, columnName } = this.camelPropertyNameToNameAndTypeMap[propertyName];
      const columnObject = buildPropertyValueForAddPage({ type, value });
      if (callBody.properties && columnObject) (callBody.properties as Record<string, unknown>)[columnName] = columnObject;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await this.client.pages.update(callBody as any);
  }

  /** Update all records matching the filter. Returns the count of updated records. */
  public async updateMany(args: {
    where?: QueryFilter<DatabaseSchemaType, ColumnNameToColumnType>;
    data: Partial<DatabaseSchemaType>;
    $icon?: ImageInput | null;
    $cover?: ImageInput | null;
  }): Promise<{ count: number }> {
    const queryCall = this.buildQueryCall({ where: args.where });
    const results = await this.fetchAllPages(queryCall, {});
    await Promise.all(results.map((r) => this.update({ where: { id: r.id }, data: args.data, $icon: args.$icon, $cover: args.$cover })));
    return { count: results.length };
  }

  /** Create or update a record. If a record matches `where`, updates it; otherwise creates it. */
  public async upsert(args: {
    where: QueryFilter<DatabaseSchemaType, ColumnNameToColumnType>;
    create: DatabaseSchemaType;
    update: Partial<DatabaseSchemaType>;
    $icon?: ImageInput | null;
    $cover?: ImageInput | null;
  }): Promise<{ created: boolean; id: string }> {
    const queryCall = this.buildQueryCall({ where: args.where });
    const response = await this.client.dataSources.query({ ...queryCall, page_size: 1 });
    if (response.results.length > 0) {
      const existingId = response.results[0].id;
      await this.update({ where: { id: existingId }, data: args.update, $icon: args.$icon, $cover: args.$cover });
      return { created: false, id: existingId };
    }
    const created = await this.create({ data: args.create, $icon: args.$icon, $cover: args.$cover });
    return { created: true, id: created.id };
  }

  /** Archive (soft-delete) a record by its Notion page ID. */
  public async delete(args: { where: { id: string } }): Promise<void> {
    await this.client.pages.update({ page_id: args.where.id, archived: true });
  }

  /** Archive all records matching the filter. Returns the count of deleted records. */
  public async deleteMany(args?: {
    where?: QueryFilter<DatabaseSchemaType, ColumnNameToColumnType>;
  }): Promise<{ count: number }> {
    const queryCall = this.buildQueryCall({ where: args?.where });
    const results = await this.fetchAllPages(queryCall, {});
    await Promise.all(results.map((r) => this.delete({ where: { id: r.id } })));
    return { count: results.length };
  }

  /** Count records matching the filter. */
  public async count(args?: {
    where?: QueryFilter<DatabaseSchemaType, ColumnNameToColumnType>;
  }): Promise<number> {
    const queryCall = this.buildQueryCall({ where: args?.where });
    const results = await this.fetchAllPages(queryCall, {});
    return results.length;
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

  private async buildCreateBody(data: DatabaseSchemaType, $icon?: ImageInput | null, $cover?: ImageInput | null): Promise<Record<string, unknown>> {
    const callBody: Record<string, unknown> = {
      parent: { data_source_id: this.id, type: "data_source_id" },
      properties: {},
    };
    const [icon, cover] = await Promise.all([this.resolveIconCover($icon), this.resolveIconCover($cover)]);
    if (icon !== undefined) callBody.icon = icon;
    if (cover !== undefined) callBody.cover = cover;
    for (const [propertyName, value] of Object.entries(data)) {
      const { type, columnName } = this.camelPropertyNameToNameAndTypeMap[propertyName];
      const columnObject = buildPropertyValueForAddPage({ type, value });
      if (callBody.properties && columnObject) (callBody.properties as Record<string, unknown>)[columnName] = columnObject;
    }
    return callBody;
  }

  private async resolveIconCover(value: ImageInput | null | undefined): Promise<Record<string, unknown> | null | undefined> {
    if (value === undefined) return undefined;
    if (value === null) return null;
    if (typeof value === "string") return { type: "external", external: { url: value } };
    const bytes = value instanceof Blob ? new Uint8Array(await value.arrayBuffer()) : (value as Uint8Array<ArrayBuffer>);
    const contentType = (value instanceof Blob && value.type) ? value.type : sniffMimeType(bytes);
    const ext = MIME_TO_EXT[contentType] ?? "bin";
    const filename = `upload.${ext}`;
    const blob = new Blob([bytes], { type: contentType });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const upload = await (this.client.fileUploads as any).create({ filename, content_type: contentType });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (this.client.fileUploads as any).send({ file_upload_id: upload.id, file: { data: blob, filename } });
    return { type: "file_upload", file_upload: { id: upload.id } };
  }

  private parsePage(page: { id: string; properties: Record<string, any>; icon?: any; cover?: any }, meta?: { $icon?: true; $cover?: true }): Partial<DatabaseSchemaType> & { id: string } {
    const result = { id: page.id } as Partial<DatabaseSchemaType> & { id: string };
    for (const [columnName, value] of Object.entries(page.properties)) {
      const camelName = camelize(columnName);
      const colType = this.camelPropertyNameToNameAndTypeMap[camelName]?.type;
      if (colType) (result as Record<string, unknown>)[camelName] = getResponseValue(colType, value);
    }
    if (meta?.$icon) {
      if (page.icon?.type === "external") (result as any).$icon = page.icon.external?.url ?? null;
      else if (page.icon?.type === "file") (result as any).$icon = page.icon.file?.url ?? null;
      else (result as any).$icon = null;
    }
    if (meta?.$cover) {
      if (page.cover?.type === "external") (result as any).$cover = page.cover.external?.url ?? null;
      else if (page.cover?.type === "file") (result as any).$cover = page.cover.file?.url ?? null;
      else (result as any).$cover = null;
    }
    return result;
  }

  private buildQueryCall(args: {
    where?: QueryFilter<DatabaseSchemaType, ColumnNameToColumnType>;
    orderBy?: FindManyArgs<DatabaseSchemaType, ColumnNameToColumnType>["orderBy"];
  }): QueryDataSourceParameters {
    const queryCall: QueryDataSourceParameters = { data_source_id: this.id };

    if (args.orderBy) {
      const orderByArr = Array.isArray(args.orderBy) ? args.orderBy : [args.orderBy];
      queryCall["sorts"] = orderByArr.flatMap((obj) =>
        Object.entries(obj).map(([prop, dir]) => ({
          property: this.camelPropertyNameToNameAndTypeMap[prop]?.columnName ?? prop,
          direction: dir === "asc" ? "ascending" : "descending",
        }))
      ) as QueryDataSourceParameters["sorts"];
    }

    if (args.where) {
      // @ts-expect-error errors vs notion api types
      queryCall["filter"] = recursivelyBuildFilter(args.where, this.camelPropertyNameToNameAndTypeMap);
    }

    return queryCall;
  }

  private async fetchAllPages(
    queryCall: QueryDataSourceParameters,
    args: Pick<FindManyArgs<DatabaseSchemaType, ColumnNameToColumnType>, "select" | "omit" | "take" | "skip" | "$icon" | "$cover">
  ): Promise<QueryResult<DatabaseSchemaType>[]> {
    const allResults: QueryResult<DatabaseSchemaType>[] = [];
    let cursor: string | undefined;
    let isFirst = true;
    const take = args.take;
    const skip = args.skip ?? 0;
    let fetched = 0;

    do {
      const response = await this.client.dataSources.query({ ...queryCall, start_cursor: cursor, page_size: 100 });
      const page = buildQueryResponse<DatabaseSchemaType>(
        response,
        this.camelPropertyNameToNameAndTypeMap,
        isFirst ? (r) => this.validateDatabaseSchema(r) : () => {},
        { $icon: args.$icon, $cover: args.$cover }
      );
      isFirst = false;

      for (const item of this.applySelectOmit(page, args.select, args.omit)) {
        fetched++;
        if (fetched <= skip) continue;
        allResults.push(item);
        if (take && allResults.length >= take) return allResults;
      }

      cursor = response.has_more ? (response.next_cursor ?? undefined) : undefined;
    } while (cursor);

    return allResults;
  }

  private streamingIterable(
    queryCall: QueryDataSourceParameters,
    args: FindManyArgs<DatabaseSchemaType, ColumnNameToColumnType>
  ): AsyncIterable<QueryResult<DatabaseSchemaType>> {
    const self = this;
    const pageSize = args.stream!;

    return {
      [Symbol.asyncIterator]: async function* () {
        let cursor: string | undefined;
        let isFirst = true;
        let yielded = 0;
        let skipped = 0;
        const skip = args.skip ?? 0;

        do {
          const response = await self.client.dataSources.query({ ...queryCall, start_cursor: cursor, page_size: pageSize });
          const page = buildQueryResponse<DatabaseSchemaType>(
            response,
            self.camelPropertyNameToNameAndTypeMap,
            isFirst ? (r) => self.validateDatabaseSchema(r) : () => {},
            { $icon: args.$icon, $cover: args.$cover }
          );
          isFirst = false;

          for (const item of self.applySelectOmit(page, args.select, args.omit)) {
            if (skipped < skip) { skipped++; continue; }
            yield item;
            if (args.take && ++yielded >= args.take) return;
          }

          cursor = response.has_more ? (response.next_cursor ?? undefined) : undefined;
        } while (cursor);
      },
    };
  }

  private applySelectOmit(
    results: QueryResult<DatabaseSchemaType>[],
    select?: Partial<Record<keyof DatabaseSchemaType, true>>,
    omit?: Partial<Record<keyof DatabaseSchemaType, true>>
  ): QueryResult<DatabaseSchemaType>[] {
    if (!select && !omit) return results;
    return results.map((result) => {
      const out: Record<string, unknown> = { id: result.id };
      if (select) {
        for (const key of Object.keys(select)) if (key in result) out[key] = (result as Record<string, unknown>)[key];
      } else if (omit) {
        for (const key of Object.keys(result) as string[])
          if (key !== "id" && !(omit as Record<string, unknown>)[key]) out[key] = (result as Record<string, unknown>)[key];
      }
      return out as QueryResult<DatabaseSchemaType>;
    });
  }

  private validateDatabaseSchema(result: Partial<DatabaseSchemaType>) {
    if (!this.schema) return;

    const schemaLabel = this.name ?? this.id;
    const remoteColumnNames = new Set(Object.keys(result));

    const missingProperties: string[] = [];
    for (const propName in this.camelPropertyNameToNameAndTypeMap) {
      if (!remoteColumnNames.has(propName)) missingProperties.push(propName);
    }

    if (missingProperties.length > 0) {
      const issueSignature = JSON.stringify({ type: "missing_properties", properties: missingProperties });
      if (!this.loggedSchemaValidationIssues.has(issueSignature)) {
        this.loggedSchemaValidationIssues.add(issueSignature);
        // biome-ignore lint/suspicious/noConsole: surface schema drift to the developer console
        console.error(
          `⚠️ ${AST_RUNTIME_CONSTANTS.PACKAGE_LOG_PREFIX} ${AST_RUNTIME_CONSTANTS.SCHEMA_DRIFT_PREFIX} for the following Notion database ${schemaLabel}
					\nMissing properties: ${missingProperties.map((prop) => `\`${prop}\``).join(", ")}
					\n\n✅ ${AST_RUNTIME_CONSTANTS.SCHEMA_DRIFT_HELP_MESSAGE}
					`
        );
      }
    }

    for (const remoteColName of remoteColumnNames) {
      if (remoteColName === "id") continue;
      if (!this.camelPropertyNameToNameAndTypeMap[remoteColName]) {
        const issueSignature = JSON.stringify({ type: "unexpected_property", property: remoteColName });
        if (!this.loggedSchemaValidationIssues.has(issueSignature)) {
          this.loggedSchemaValidationIssues.add(issueSignature);
          // biome-ignore lint/suspicious/noConsole: surfaced for debugging unexpected Notion payloads
          console.error(
            `⚠️ ${AST_RUNTIME_CONSTANTS.PACKAGE_LOG_PREFIX} ${AST_RUNTIME_CONSTANTS.SCHEMA_DRIFT_PREFIX} for the following Notion database ${schemaLabel}
						\nUnexpected property found in remote data: \`${remoteColName}\`
						\n\n✅ ${AST_RUNTIME_CONSTANTS.SCHEMA_DRIFT_HELP_MESSAGE}
						`
          );
        }
      }
    }

    const parseResult = this.schema.safeParse(result);
    if (parseResult.success) return;

    const issueSignature = JSON.stringify(
      parseResult.error.issues.map((issue) => ({ code: issue.code, path: issue.path, message: issue.message }))
    );

    if (this.loggedSchemaValidationIssues.has(issueSignature)) return;
    this.loggedSchemaValidationIssues.add(issueSignature);
    // biome-ignore lint/suspicious/noConsole: surface schema drift to the developer console
    console.error(
      `⚠️ ${AST_RUNTIME_CONSTANTS.PACKAGE_LOG_PREFIX} ${AST_RUNTIME_CONSTANTS.SCHEMA_DRIFT_PREFIX} for the following Notion database ${schemaLabel}
			\nValidation issues: ${parseResult.error.issues.map((issue) => `\`${issue.path.join(".")}: ${issue.message}\``).join(", ")}
			\n\n✅ ${AST_RUNTIME_CONSTANTS.SCHEMA_DRIFT_HELP_MESSAGE}
			`
    );
    // biome-ignore lint/suspicious/noConsole: surface schema drift to the developer console
    console.log("Validation details:", { issues: parseResult.error.issues, result });
  }
}
