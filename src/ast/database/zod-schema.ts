/**
 * Zod schema generation utilities.
 * Creates Zod validation schemas from database property metadata.
 */

import * as ts from "typescript";

import type { SupportedNotionColumnType } from "../../client/queryTypes";

export interface ZodMetadata {
		propName: string;
		columnName: string;
		type: SupportedNotionColumnType;
		isRequired: boolean;
		options?: string[];
		propertyValuesIdentifier?: string;
	}

/**
 * Creates the exported `const <SchemaName> = z.object({...})` statement
 * from per-column metadata collected during database AST generation.
 */
export function createZodSchema(args: {
	identifier: string;
	columns: ZodMetadata[];
}) {
	const { identifier, columns } = args;
	const properties = columns.map((column) =>
		ts.factory.createPropertyAssignment(
			ts.factory.createIdentifier(column.propName),
			createZodPropertyExpression(column),
		),
	);
	return ts.factory.createVariableStatement(
		[ts.factory.createToken(ts.SyntaxKind.ExportKeyword)],
		ts.factory.createVariableDeclarationList(
			[
				ts.factory.createVariableDeclaration(
					ts.factory.createIdentifier(identifier),
					undefined,
					undefined,
					ts.factory.createCallExpression(
						ts.factory.createPropertyAccessExpression(
							ts.factory.createIdentifier("z"),
							ts.factory.createIdentifier("object"),
						),
						undefined,
						[ts.factory.createObjectLiteralExpression(properties, true)],
					),
				),
			],
			ts.NodeFlags.Const,
		),
	);
}

/**
 * Maps each supported Notion property type to a matching Zod expression.
 * This keeps runtime validation aligned with generated TypeScript schema types.
 */
export function createZodPropertyExpression(column: ZodMetadata) {
	const optional = !column.isRequired;
	switch (column.type) {
		case "title": {
			return createZodPrimitiveCall("string");
		}
		case "rich_text":
		case "email":
		case "phone_number":
		case "url":
		case "unique_id":
		case "created_by":
		case "last_edited_by":
		case "created_time":
		case "last_edited_time": {
			return applyOptionalNullable(createZodPrimitiveCall("string"), {
				optional,
				nullable: true,
			});
		}
		case "number": {
			return applyOptionalNullable(createZodPrimitiveCall("number"), {
				optional,
				nullable: true,
			});
		}
		case "checkbox": {
			return applyOptionalNullable(createZodPrimitiveCall("boolean"), {
				optional,
				nullable: false,
			});
		}
		case "date": {
			return createZodDateExpression(optional);
		}
		case "select":
		case "status": {
			return applyOptionalNullable(createZodEnumExpression(column), {
				optional,
				nullable: true,
			});
		}
		case "multi_select": {
			return applyOptionalNullable(createZodArrayEnumExpression(column), {
				optional,
				nullable: true,
			});
		}
		case "people":
		case "relation": {
			return applyOptionalNullable(createZodStringArrayExpression(), {
				optional,
				nullable: true,
			});
		}
		case "files": {
			return applyOptionalNullable(createZodFilesExpression(), {
				optional,
				nullable: true,
			});
		}
		default: {
			return assertNever(column.type);
		}
	}
}

/**
 * Exhaustiveness guard so new supported column types cannot be silently ignored.
 */
function assertNever(value: never): never {
	throw new Error(`Unhandled supported property type: ${String(value)}`);
}

/**
 * Creates primitive `z.<type>()` calls.
 */
function createZodPrimitiveCall(method: "string" | "number" | "boolean") {
	return ts.factory.createCallExpression(
		ts.factory.createPropertyAccessExpression(
			ts.factory.createIdentifier("z"),
			ts.factory.createIdentifier(method),
		),
		undefined,
		[],
	);
}

/**
 * Applies `.nullable()` and `.optional()` wrappers in a predictable order.
 */
function applyOptionalNullable(
	expression: ts.Expression,
	args: { optional?: boolean; nullable?: boolean },
) {
	const { optional, nullable } = args;
	let currentExpression = expression;
	if (nullable) {
		currentExpression = ts.factory.createCallExpression(
			ts.factory.createPropertyAccessExpression(
				currentExpression,
				ts.factory.createIdentifier("nullable"),
			),
			undefined,
			[],
		);
	}
	if (optional) {
		currentExpression = ts.factory.createCallExpression(
			ts.factory.createPropertyAccessExpression(
				currentExpression,
				ts.factory.createIdentifier("optional"),
			),
			undefined,
			[],
		);
	}
	return currentExpression;
}

/**
 * Select/status columns emit `z.enum(PropertyValues)` when options exist;
 * otherwise they degrade to `z.string()` for resilience.
 */
function createZodEnumExpression(column: ZodMetadata) {
	if (
		column.options &&
		column.options.length > 0 &&
		column.propertyValuesIdentifier
	) {
		return ts.factory.createCallExpression(
			ts.factory.createPropertyAccessExpression(
				ts.factory.createIdentifier("z"),
				ts.factory.createIdentifier("enum"),
			),
			undefined,
			[ts.factory.createIdentifier(column.propertyValuesIdentifier)],
		);
	}
	return createZodPrimitiveCall("string");
}

/**
 * Multi-select columns emit arrays of the same enum expression used by select/status.
 */
function createZodArrayEnumExpression(column: ZodMetadata) {
	const enumExpression = createZodEnumExpression(column);
	return ts.factory.createCallExpression(
		ts.factory.createPropertyAccessExpression(
			ts.factory.createIdentifier("z"),
			ts.factory.createIdentifier("array"),
		),
		undefined,
		[enumExpression],
	);
}

/**
 * Utility for Notion relation/people arrays represented as string IDs.
 */
function createZodStringArrayExpression() {
	return ts.factory.createCallExpression(
		ts.factory.createPropertyAccessExpression(
			ts.factory.createIdentifier("z"),
			ts.factory.createIdentifier("array"),
		),
		undefined,
		[createZodPrimitiveCall("string")],
	);
}

/**
 * Builds files validation shape:
 * `Array<{ name: string; url: string }>`
 */
function createZodFilesExpression() {
	const fileName = ts.factory.createPropertyAssignment(
		ts.factory.createIdentifier("name"),
		createZodPrimitiveCall("string"),
	);
	const fileUrl = ts.factory.createPropertyAssignment(
		ts.factory.createIdentifier("url"),
		createZodPrimitiveCall("string"),
	);

	const fileObject = ts.factory.createCallExpression(
		ts.factory.createPropertyAccessExpression(
			ts.factory.createIdentifier("z"),
			ts.factory.createIdentifier("object"),
		),
		undefined,
		[ts.factory.createObjectLiteralExpression([fileName, fileUrl], true)],
	);

	return ts.factory.createCallExpression(
		ts.factory.createPropertyAccessExpression(
			ts.factory.createIdentifier("z"),
			ts.factory.createIdentifier("array"),
		),
		undefined,
		[fileObject],
	);
}

/**
 * Builds date validation shape:
 * `{ start: string; end?: string | null }` with optionality inherited from column.
 */
function createZodDateExpression(optional: boolean) {
	const startAssignment = ts.factory.createPropertyAssignment(
		ts.factory.createIdentifier("start"),
		createZodPrimitiveCall("string"),
	);
	const endAssignment = ts.factory.createPropertyAssignment(
		ts.factory.createIdentifier("end"),
		applyOptionalNullable(createZodPrimitiveCall("string"), {
			optional: true,
			nullable: true,
		}),
	);
	const dateObjectExpression = ts.factory.createCallExpression(
		ts.factory.createPropertyAccessExpression(
			ts.factory.createIdentifier("z"),
			ts.factory.createIdentifier("object"),
		),
		undefined,
		[
			ts.factory.createObjectLiteralExpression(
				[startAssignment, endAssignment],
				true,
			),
		],
	);
	return applyOptionalNullable(dateObjectExpression, {
		optional,
		nullable: true,
	});
}

