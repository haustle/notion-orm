import { PACKAGE_RUNTIME_CONSTANTS } from "../../../runtime-constants";
import { objectKeys } from "../../../typeUtils";
import type { DatabaseColumns } from "../types";
import type { DatabasePropertyValue } from "../types";

export type SchemaValidationIssue = {
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

export type SafeParseSchema = {
	safeParse: (input: unknown) => SafeParseSchemaResult;
};

/**
 * Logs schema drift (missing/unexpected columns, Zod failures) for normalized query rows.
 */
export function validateDatabaseQueryRow<
	DatabaseSchemaType extends Record<string, DatabasePropertyValue>,
>(args: {
	result: Partial<DatabaseSchemaType>;
	schema: SafeParseSchema;
	schemaLabel: string;
	columns: DatabaseColumns;
	loggedSchemaValidationIssues: Set<string>;
}): void {
	const { result, schemaLabel, columns } = args;
	const remoteColumnNames = new Set<string>(
		objectKeys(result).map((k) => String(k)),
	);

	const missingProperties: string[] = [];
	for (const propName of objectKeys(columns)) {
		if (!remoteColumnNames.has(propName)) {
			missingProperties.push(propName);
		}
	}

	if (missingProperties.length > 0) {
		const issueSignature = JSON.stringify({
			type: "missing_properties",
			properties: missingProperties,
		});

		if (!args.loggedSchemaValidationIssues.has(issueSignature)) {
			args.loggedSchemaValidationIssues.add(issueSignature);
			// biome-ignore lint/suspicious/noConsole: surface schema drift
			console.error(
				`⚠️ ${PACKAGE_RUNTIME_CONSTANTS.PACKAGE_LOG_PREFIX} ${
					PACKAGE_RUNTIME_CONSTANTS.SCHEMA_DRIFT_PREFIX
				} for the following Notion database ${schemaLabel}
					\nMissing properties: ${missingProperties
						.map((prop) => `\`${prop}\``)
						.join(", ")}
					\n\n✅ ${PACKAGE_RUNTIME_CONSTANTS.SCHEMA_DRIFT_HELP_MESSAGE}
					`,
			);
		}
	}

	for (const remoteColName of remoteColumnNames) {
		if (!columns[remoteColName]) {
			const issueSignature = JSON.stringify({
				type: "unexpected_property",
				property: remoteColName,
			});

			if (!args.loggedSchemaValidationIssues.has(issueSignature)) {
				args.loggedSchemaValidationIssues.add(issueSignature);
				// biome-ignore lint/suspicious/noConsole: unexpected remote properties
				console.error(
					`⚠️ ${PACKAGE_RUNTIME_CONSTANTS.PACKAGE_LOG_PREFIX} ${PACKAGE_RUNTIME_CONSTANTS.SCHEMA_DRIFT_PREFIX} for the following Notion database ${schemaLabel}
						\nUnexpected property found in remote data: \`${remoteColName}\`
						\n\n✅ ${PACKAGE_RUNTIME_CONSTANTS.SCHEMA_DRIFT_HELP_MESSAGE}
						`,
				);
			}
		}
	}

	const parseResult = args.schema.safeParse(result);
	if (parseResult.success === false) {
		const parseError = parseResult.error;
		const issueSignature = JSON.stringify(
			parseError.issues.map((issue: SchemaValidationIssue) => ({
				code: issue.code,
				path: issue.path,
				message: issue.message,
			})),
		);

		if (args.loggedSchemaValidationIssues.has(issueSignature)) {
			return;
		}
		args.loggedSchemaValidationIssues.add(issueSignature);
		// biome-ignore lint/suspicious/noConsole: schema validation failures
		console.error(
			`⚠️ ${PACKAGE_RUNTIME_CONSTANTS.PACKAGE_LOG_PREFIX} ${
				PACKAGE_RUNTIME_CONSTANTS.SCHEMA_DRIFT_PREFIX
			} for the following Notion database ${schemaLabel}
			\nValidation issues: ${parseError.issues
				.map(
					(issue: SchemaValidationIssue) =>
						`\`${issue.path.join(".")}: ${issue.message}\``,
				)
				.join(", ")}
			\n\n✅ ${PACKAGE_RUNTIME_CONSTANTS.SCHEMA_DRIFT_HELP_MESSAGE}
			`,
		);
	}
}
