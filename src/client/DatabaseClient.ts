import { Client } from "@notionhq/client";
import type {
	CreatePageParameters,
	CreatePageResponse,
	QueryDataSourceParameters,
} from "@notionhq/client/build/src/api-endpoints";
import { AST_RUNTIME_CONSTANTS } from "../ast/shared/constants";
import { buildPropertyValueForAddPage } from "./add";
import { buildQueryResponse, transformQueryFilterToApiFilter } from "./query";
import type {
	Query,
	QueryResponseWithoutRawResponse,
	QueryResponseWithRawResponse,
	QueryWithoutRawResponse,
	QueryWithRawResponse,
	SimpleQueryResponse,
	SupportedNotionColumnType,
} from "./queryTypes";

type AddPropertyValue = Parameters<
	typeof buildPropertyValueForAddPage
>[0]["value"];

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

export class DatabaseClient<
		DatabaseSchemaType extends Record<string, AddPropertyValue>,
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
			// Bind the global fetch implementation so runtimes like Cloudflare
			// Workers do not trip over illegal invocation when the Notion SDK calls it.
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

		// Add page to a database
		public async add(args: {
			properties: DatabaseSchemaType;
			icon?: CreatePageParameters["icon"];
		}): Promise<CreatePageResponse> {
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
			query: QueryWithRawResponse<DatabaseSchemaType, ColumnNameToColumnType>,
		): Promise<QueryResponseWithRawResponse<DatabaseSchemaType>>;
		public async query(
			query: QueryWithoutRawResponse<
				DatabaseSchemaType,
				ColumnNameToColumnType
			>,
		): Promise<QueryResponseWithoutRawResponse<DatabaseSchemaType>>;
		public async query(
			query: Query<DatabaseSchemaType, ColumnNameToColumnType>,
		): Promise<SimpleQueryResponse<DatabaseSchemaType>> {
			const queryCall: QueryDataSourceParameters = {
				data_source_id: this.id,
			};

			queryCall.sorts = query.sort ?? [];

			const filters = query.filter
				? transformQueryFilterToApiFilter(
						query.filter,
						this.camelPropertyNameToNameAndTypeMap,
					)
				: undefined;
			if (filters) {
				queryCall.filter = filters;
			}

			const response = await this.client.dataSources.query(queryCall);
			const responseArgs = {
				response,
				columnNameToColumnProperties: this.camelPropertyNameToNameAndTypeMap,
				validateSchema: (result: Partial<DatabaseSchemaType>) =>
					this.validateDatabaseSchema(result),
			};

			if (query.includeRawResponse === true) {
				return buildQueryResponse<DatabaseSchemaType>({
					...responseArgs,
					options: { includeRawResponse: true },
				});
			}

			return buildQueryResponse<DatabaseSchemaType>(responseArgs);
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
						// biome-ignore lint/suspicious/noConsole: surfaced for debugging
						// unexpected Notion payloads
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
			// biome-ignore lint/suspicious/noConsole: surface schema drift to the
			// developer console
			console.error(
				`⚠️ ${AST_RUNTIME_CONSTANTS.PACKAGE_LOG_PREFIX} ${
					AST_RUNTIME_CONSTANTS.SCHEMA_DRIFT_PREFIX
				} for the following Notion database ${schemaLabel}
			\nValidation issues: ${parseResult.error.issues
				.map((issue) => `\`${issue.path.join(".")}: ${issue.message}\``)
				.join(", ")}
			\n\n✅ ${AST_RUNTIME_CONSTANTS.SCHEMA_DRIFT_HELP_MESSAGE}
			`,
			);
			// biome-ignore lint/suspicious/noConsole: surface schema drift to the
			// developer console
			console.log("Validation details:", {
				issues: parseResult.error.issues,
				result: result,
			});
		}
	}
