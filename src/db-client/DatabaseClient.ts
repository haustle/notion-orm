import { Client } from "@notionhq/client";
import type {
  CreatePageParameters,
  CreatePageResponse,
  QueryDataSourceParameters,
  QueryDataSourceResponse,
} from "@notionhq/client/build/src/api-endpoints";
import type { ZodTypeAny } from "zod";
import { buildPropertyValueForAddPage } from "./add";
import type {
  apiFilterType,
  apiSingleFilter,
  Query,
  QueryFilter,
  SimpleQueryResponse,
  SingleFilter,
  SupportedNotionColumnType,
} from "./queryTypes";

import { camelize } from "../helpers";

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
      ? this.recursivelyBuildFilter(query.filter)
      : undefined;
    if (filters) {
      queryCall["sorts"] = query.sort ?? [];
      // @ts-expect-error errors vs notion api types
      queryCall["filter"] = filters;
    }

    const response = await this.client.dataSources.query(queryCall);
    const simplifiedResponse = this.buildQueryResponse(response);

    return simplifiedResponse;
  }

  private buildQueryResponse(
    res: QueryDataSourceResponse
  ): SimpleQueryResponse<DatabaseSchemaType> {
    const rawResults = res.results;
    const rawResponse = res;

    const results: Array<Partial<DatabaseSchemaType>> = rawResults
      .map((result, index) => {
        if (result.object === "page" && !("properties" in result)) {
          // biome-ignore lint/suspicious/noConsole: surfaced for debugging
          // unexpected Notion payloads
          console.log("Skipping this page: ", { result });
          return undefined;
        }

        const simpleResult: Partial<DatabaseSchemaType> = {};
        const properties = Object.entries(result.properties);

        for (const [columnName, result] of properties) {
          const camelizeColumnName = camelize(columnName);
          const columnType =
            this.camelPropertyNameToNameAndTypeMap[camelizeColumnName]?.type;

          if (columnType) {
            // @ts-expect-error
            simpleResult[camelizeColumnName] = this.getResponseValue(
              columnType,
              result
            );
          }
        }

        if (index === 0) {
          this.validateDatabaseSchema(simpleResult);
        }
        return simpleResult;
      })
      .filter((result) => result !== undefined);

    return {
      results,
      rawResponse,
    };
  }

  private getResponseValue(
    prop: SupportedNotionColumnType,
    x: Record<string, any>
  ) {
    switch (prop) {
      case "select": {
        const { select } = x;
        if (select) {
          return select["name"];
        }
        return null;
      }
      case "title": {
        const { title } = x;
        if (title) {
          const combinedText = title.map(
            ({ plain_text }: { plain_text: string }) => plain_text
          );
          return combinedText.join("");
        }
        return null;
      }
      case "url": {
        const { url } = x;
        return url;
      }
      case "multi_select": {
        const { multi_select } = x;
        if (multi_select) {
          const multi_selectArr: string[] = multi_select.map(
            ({ name }: { name: string }) => name
          );
          return multi_selectArr;
        }
        return null;
      }
      case "checkbox": {
        const { checkbox } = x;
        return Boolean(checkbox);
      }
      case "status": {
        const { status } = x;
        if (status) {
          return status["name"];
        }
        return null;
      }
      case "rich_text": {
        const { rich_text } = x;
        if (rich_text && Array.isArray(rich_text)) {
          const combinedText = rich_text.map(
            ({ plain_text }: { plain_text: string }) => plain_text
          );
          return combinedText.join("");
        }
        return null;
      }
      case "number": {
        const { number } = x;
        return number;
      }
      default: {
        return null;
      }
    }
  }

  private recursivelyBuildFilter(
    queryFilter: QueryFilter<DatabaseSchemaType, ColumnNameToColumnType>
  ): apiFilterType {
    // Need to loop because we don't kno
    for (const prop in queryFilter) {
      // if the filter is "and" || "or" we need to recursively
      if (prop === "and" || prop === "or") {
        const compoundFilters: QueryFilter<
          DatabaseSchemaType,
          ColumnNameToColumnType
        >[] =
          // @ts-expect-error
          queryFilter[prop];

        const compoundApiFilters = compoundFilters.map(
          (i: QueryFilter<DatabaseSchemaType, ColumnNameToColumnType>) => {
            return this.recursivelyBuildFilter(i);
          }
        );

        // Either have an `and` or an `or` compound filter
        const temp: apiFilterType = {
          ...(prop === "and"
            ? { and: compoundApiFilters }
            : { or: compoundApiFilters }),
        };
        return temp;
      } else {
        const propType = this.camelPropertyNameToNameAndTypeMap[prop].type;
        const temp: apiSingleFilter = {
          property: this.camelPropertyNameToNameAndTypeMap[prop].columnName,
        };

        //@ts-expect-error
        temp[propType] = (queryFilter as SingleFilter<ColumnNameToColumnType>)[
          prop
        ];
        return temp;
      }
    }
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
