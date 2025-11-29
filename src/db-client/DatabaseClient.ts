import { Client } from "@notionhq/client";
import type {
  CreatePageParameters,
  CreatePageResponse,
  QueryDataSourceParameters,
  QueryDataSourceResponse,
} from "@notionhq/client/build/src/api-endpoints";
import type { ZodTypeAny } from "zod";
import { buildPropertyValueForAddPage } from "./add";
import { buildQueryResponse, recursivelyBuildFilter } from "./query";
import type {
  Query,
  SimpleQueryResponse,
  SupportedNotionColumnType,
} from "./queryTypes";

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
    this.client = new Client({ auth: args.auth, notionVersion: "2025-09-03" });
    this.id = args.id;
    this.camelPropertyNameToNameAndTypeMap =
      args.camelPropertyNameToNameAndTypeMap;
    this.schema = args.schema;
    this.name = args.name;
    this.loggedSchemaValidationIssues = new Set();
  }

  // Add page to a database
  public async add(args: {
    properties: DatabaseSchemaType;
    icon?: CreatePageParameters["icon"];
  }): Promise<CreatePageParameters | CreatePageResponse> {
    const { properties: pageObject, icon } = args;
    const callBody: CreatePageParameters = {
      parent: {
        data_source_id: this.id,
        type: "data_source_id",
      },
      properties: {},
    };

    callBody.icon = icon;

    Object.entries(pageObject).forEach(([propertyName, value]) => {
      const { type, columnName } =
        this.camelPropertyNameToNameAndTypeMap[propertyName];
      const columnObject = buildPropertyValueForAddPage({
        type,
        value,
      });

      if (callBody.properties && columnObject) {
        callBody.properties[columnName] = columnObject;
      }
    });

    return await this.client.pages.create(callBody);
  }

  // Look for page inside the database
  public async query(
    query: Query<DatabaseSchemaType, ColumnNameToColumnType>
  ): Promise<SimpleQueryResponse<DatabaseSchemaType>> {
    const queryCall: QueryDataSourceParameters = {
      data_source_id: this.id,
    };

    const filters = query.filter
      ? recursivelyBuildFilter(
          query.filter,
          this.camelPropertyNameToNameAndTypeMap
        )
      : undefined;
    if (filters) {
      queryCall["sorts"] = query.sort ?? [];
      // @ts-expect-error errors vs notion api types
      queryCall["filter"] = filters;
    }

    const response = await this.client.dataSources.query(queryCall);
    const simplifiedResponse = buildQueryResponse<DatabaseSchemaType>(
      response,
      this.camelPropertyNameToNameAndTypeMap,
      (result) => this.validateDatabaseSchema(result)
    );

    return simplifiedResponse;
  }

  private validateDatabaseSchema(result: Partial<DatabaseSchemaType>) {
    if (!this.schema) {
      return;
    }

    const schemaLabel = this.name ?? this.id;
    const remoteColumnNames = new Set(Object.keys(result));

    // Check for missing expected properties (schema drift detection)
    const missingProperties: string[] = [];
    for (const propName in this.camelPropertyNameToNameAndTypeMap) {
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
        // biome-ignore lint/suspicious/noConsole: surface schema drift to the
        // developer console
        console.error(
          `⚠️ [@haustle/notion-orm] Schema drift detected for the following Notion database ${schemaLabel}
					\nMissing properties: ${missingProperties
            .map((prop) => `\`${prop}\``)
            .join(", ")}
					\n\n✅ To easily fix this, please run \`notion generate\` to refresh all database schemas.
					`
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
          // biome-ignore lint/suspicious/noConsole: surfaced for debugging
          // unexpected Notion payloads
          console.error(
            `⚠️ [@haustle/notion-orm] Schema drift detected for the following Notion database ${schemaLabel}
						\nUnexpected property found in remote data: \`${remoteColName}\`
						\n\n✅ To easily fix this, please run \`notion generate\` to refresh all database schemas.
						`
          );
        }
      }
    }

    // Validate against Zod schema
    const parseResult = this.schema.safeParse(result);
    if (parseResult.success) {
      return;
    }

    const issueSignature = JSON.stringify(
      parseResult.error.issues.map((issue) => ({
        code: issue.code,
        path: issue.path,
        message: issue.message,
      }))
    );

    if (this.loggedSchemaValidationIssues.has(issueSignature)) {
      return;
    }
    this.loggedSchemaValidationIssues.add(issueSignature);
    // biome-ignore lint/suspicious/noConsole: surface schema drift to the
    // developer console
    console.error(
      `⚠️ [@haustle/notion-orm] Schema drift detected for the following Notion database ${schemaLabel}
			\nValidation issues: ${parseResult.error.issues
        .map((issue) => `\`${issue.path.join(".")}: ${issue.message}\``)
        .join(", ")}
			\n\n✅ To easily fix this, please run \`notion generate\` to refresh all database schemas.
			`
    );
    // biome-ignore lint/suspicious/noConsole: surface schema drift to the
    // developer console
    console.log("Validation details:", {
      issues: parseResult.error.issues,
      result: result,
    });
  }
}
