import { Client } from "@notionhq/client";
import type {
	CreatePageParameters,
	CreatePageResponse,
	QueryDataSourceParameters,
	QueryDataSourceResponse,
} from "@notionhq/client/build/src/api-endpoints.js";
import type { ZodTypeAny } from "zod";
import { getCall } from "./BuildCall.js";
import type {
	apiFilterType,
	apiSingleFilter,
	Query,
	QueryFilter,
	SimpleQueryResponse,
	SingleFilter,
	SupportedNotionColumnType,
} from "./queryTypes.js";

import { camelize } from "./utils.js";

export type propNameToColumnNameType = Record<
	string,
	{ columnName: string; type: SupportedNotionColumnType }
>;

export class DatabaseClient<
	DatabaseSchemaType extends Record<string, any>,
	ColumnNameToColumnType extends Record<
		keyof DatabaseSchemaType,
		SupportedNotionColumnType
	>,
> {
	private client: Client;
	private databaseId: string;
	private propNameToColumnName: propNameToColumnNameType;
	// nocommit
	// Why are we passing ZodTypeAny here?
	private schema: ZodTypeAny;
	private dataSourceName: string;
	private loggedSchemaValidationIssues: Set<string>;

	constructor(args: {
		databaseId: string;
		propNameToColumnName: propNameToColumnNameType;
		auth: string;
		dataSourceName: string;
		schema: ZodTypeAny;
	}) {
		this.client = new Client({ auth: args.auth, notionVersion: "2025-09-03" });
		this.databaseId = args.databaseId;
		this.propNameToColumnName = args.propNameToColumnName;
		this.schema = args.schema;
		this.dataSourceName = args.dataSourceName;
		this.loggedSchemaValidationIssues = new Set();
	}

	// Add page to a database
	async add(
		pageObject: DatabaseSchemaType,
		getCallBody?: boolean,
	): Promise<CreatePageParameters | CreatePageResponse> {
		const callBody: CreatePageParameters = {
			parent: {
				data_source_id: this.databaseId,
				type: "data_source_id",
			},
			properties: {},
		};

		const columnTypePropNames = Object.keys(pageObject);
		columnTypePropNames.forEach((propName) => {
			const { type, columnName } = this.propNameToColumnName[propName];
			const columnObject = getCall({
				type,
				value: pageObject[propName],
			});

			if (callBody.properties) {
				callBody.properties[columnName] = columnObject!;
			}
		});

		// CORS: If user wants the body of the call. Can then send to API
		if (getCallBody) {
			return callBody;
		}

		return await this.client.pages.create(callBody);
	}

	// Look for page inside the database
	async query(
		query: Query<DatabaseSchemaType, ColumnNameToColumnType>,
	): Promise<SimpleQueryResponse<DatabaseSchemaType>> {
		const queryCall: QueryDataSourceParameters = {
			data_source_id: this.databaseId,
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
		res: QueryDataSourceResponse,
	): SimpleQueryResponse<DatabaseSchemaType> {
		const rawResults = res.results;
		const rawResponse = res;

		const results: Array<Partial<DatabaseSchemaType>> = rawResults
			.map((result, index) => {
				if (result.object === "page" && !("properties" in result)) {
					// biome-ignore lint/suspicious/noConsole: surfaced for debugging unexpected Notion payloads
					console.log("Skipping this page: ", { result });
					return undefined;
				}

				const simpleResult: Partial<DatabaseSchemaType> = {};
				const properties = Object.entries(result.properties);

				for (const [columnName, result] of properties) {
					const camelizeColumnName = camelize(columnName);
					const columnType =
						this.propNameToColumnName[camelizeColumnName]?.type;

					if (columnType) {
						// @ts-expect-error
						simpleResult[camelizeColumnName] = this.getResponseValue(
							columnType,
							result,
						);
					}
				}

				if (index === 0) {
					this.validateDatabaseSchema(simpleResult); }
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
		x: Record<string, any>,
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
						({ plain_text }: { plain_text: string }) => plain_text,
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
						({ name }: { name: string }) => name,
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
						({ plain_text }: { plain_text: string }) => plain_text,
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
		queryFilter: QueryFilter<DatabaseSchemaType, ColumnNameToColumnType>,
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
					},
				);

				// Either have an `and` or an `or` compound filter
				const temp: apiFilterType = {
					...(prop === "and"
						? { and: compoundApiFilters }
						: { or: compoundApiFilters }),
				};
				return temp;
			} else {
				const propType = this.propNameToColumnName[prop].type;
				const temp: apiSingleFilter = {
					property: this.propNameToColumnName[prop].columnName,
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

		const schemaLabel = this.dataSourceName ?? this.databaseId;
		const remoteColumnNames = new Set(Object.keys(result));

		// Check for missing expected properties (schema drift detection)
		const missingProperties: string[] = [];
		for (const propName in this.propNameToColumnName) {
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
				// biome-ignore lint/suspicious/noConsole: surface schema drift to the developer console
				console.error(
					`⚠️ [@haustle/notion-orm] Schema drift detected for the following Notion database ${schemaLabel}
					\nMissing properties: ${missingProperties.map((prop) => `\`${prop}\``).join(", ")}
					\n\n✅ To easily fix this, please run \`notion generate\` to refresh all database schemas.
					`,
				);
			}
		}

		// Check for unexpected properties
		for (const remoteColName of remoteColumnNames) {
			if (!this.propNameToColumnName[remoteColName]) {
				const issueSignature = JSON.stringify({
					type: "unexpected_property",
					property: remoteColName,
				});

				if (!this.loggedSchemaValidationIssues.has(issueSignature)) {
					this.loggedSchemaValidationIssues.add(issueSignature);
					// biome-ignore lint/suspicious/noConsole: surfaced for debugging unexpected Notion payloads
					console.error(
						`⚠️ [@haustle/notion-orm] Schema drift detected for the following Notion database ${schemaLabel}
						\nUnexpected property found in remote data: \`${remoteColName}\`
						\n\n✅ To easily fix this, please run \`notion generate\` to refresh all database schemas.
						`,
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
			})),
		);

		if (this.loggedSchemaValidationIssues.has(issueSignature)) {
			return;
		}
		this.loggedSchemaValidationIssues.add(issueSignature);
		// biome-ignore lint/suspicious/noConsole: surface schema drift to the developer console
		console.error(
			`⚠️ [@haustle/notion-orm] Schema drift detected for the following Notion database ${schemaLabel}
			\nValidation issues: ${parseResult.error.issues.map((issue) => `\`${issue.path.join(".")}: ${issue.message}\``).join(", ")}
			\n\n✅ To easily fix this, please run \`notion generate\` to refresh all database schemas.
			`,
		);
		// biome-ignore lint/suspicious/noConsole: surface schema drift to the developer console
		console.log("Validation details:", {
			issues: parseResult.error.issues,
			result: result,
		});
	}
}
