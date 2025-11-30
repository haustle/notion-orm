import type { GetDataSourceResponse } from "@notionhq/client/build/src/api-endpoints.js";
import fs from "fs";
import path from "path";
import * as ts from "typescript";
import { DATABASES_DIR } from "./constants.js";
import {
	type DatabasePropertyType,
	isSupportedPropertyType,
} from "./queryTypes.js";
import { camelize } from "./utils.js";
import {
	type ZodMetadata,
	type PropertyASTResult,
	propertyASTGenerators,
} from "./PropertyASTGenerators.js";

type propNameToColumnNameType = Record<
	string,
	{ columnName: string; type: DatabasePropertyType }
>;

/* 
Responsible for generating `.ts` files
*/
export async function createTypescriptFileForDatabase(
	dataSourceResponse: GetDataSourceResponse,
) {
	const { id: dataSourceId, properties } = dataSourceResponse;

	const propNameToColumnName: propNameToColumnNameType = {};
	const enumConstStatements: ts.Statement[] = [];
	const zodColumns: ZodMetadata[] = [];

	// Due to the type not being a descriminated union, we need to check if the title is in the response.
	// I don't like this pattern, but we'll have to settle for now
	const databaseName: string =
		"title" in dataSourceResponse
			? dataSourceResponse.title[0].plain_text
			: "DEFAULT_DATABASE_NAME";

	const databaseClassName = camelize(databaseName);

	const databaseColumnTypeProps: ts.TypeElement[] = [];

	// Looping through each column of database
	Object.entries(properties).forEach(([columnName, value], index) => {
		const { type: columnType } = value;
		const isValidPropertyType = isSupportedPropertyType(columnType);
		if (!isValidPropertyType) {
			// biome-ignore lint/suspicious/noConsole: provide feedback when skipping unsupported schema columns
			console.error(`${index === 0 ? "\n" : ""}
				[${databaseClassName}] Property '${columnName}' with type '${columnType}' is not supported and will be skipped.`,
			);
			return;
		}

		// Taking the column name and camelizing it for typescript use
		const camelizedColumnName = camelize(columnName);

		// Creating map of column name to the column's name in the database's typescript type
		propNameToColumnName[camelizedColumnName] = {
			columnName,
			type: columnType,
		};

		// Get handler for this column type
		const handler = propertyASTGenerators[columnType];
		if (!handler) {
			console.warn(`No handler found for column type '${columnType}'`);
			return;
		}

		// Execute handler to get all data at once
		const result = handler({
			columnName,
			camelizedName: camelizedColumnName,
			columnValue: value,
		});
		if (!result) {
			return;
		}

		// Destructure the complete result
		const { tsPropertySignature, zodMeta, enumConstStatement } =
			result;

		// Add to appropriate collections
		databaseColumnTypeProps.push(tsPropertySignature);

		if (enumConstStatement) {
			enumConstStatements.push(enumConstStatement);
		}

		zodColumns.push({
			propName: camelizedColumnName,
			columnName,
			type: columnType,
			...zodMeta,
		});
	});

	const schemaIdentifier = `${toPascalCase(databaseClassName)}Schema`;
	const zodSchemaStatement = createZodSchema({
		identifier: schemaIdentifier,
		columns: zodColumns,
	});

	// Object type that represents the database schema
	const DatabaseSchemaType = ts.factory.createTypeAliasDeclaration(
		[ts.factory.createToken(ts.SyntaxKind.ExportKeyword)],
		ts.factory.createIdentifier("DatabaseSchemaType"),
		undefined,
		ts.factory.createTypeLiteralNode(databaseColumnTypeProps),
	);

	// Top level non-nested variable, functions, types for database files
	const TsNodesForDatabaseFile = ts.factory.createNodeArray([
		createNameImport({
			namedImport: "DatabaseClient",
			path: "../src/DatabaseClient",
		}),
		createNameImport({
			namedImport: "z",
			path: "zod",
		}),
		createNameImport({
			namedImport: "Query",
			path: "../src/queryTypes",
			typeOnly: true,
		}),
		createDatabaseIdVariable(dataSourceId),
		...enumConstStatements,
		zodSchemaStatement,
		DatabaseSchemaType,
		createColumnNameToColumnProperties(propNameToColumnName),
		createColumnNameToColumnType(),
		createQueryTypeExport(),
		createDatabaseClassExport({
			databaseName: databaseClassName,
			schemaIdentifier,
			schemaTitle: databaseName,
		}),
		// Export class-specific type aliases for the custom NotionORM class
		...createClassSpecificTypeExports({
			databaseName: databaseClassName,
			schemaIdentifier,
		}),
	]);

	const sourceFile = ts.createSourceFile(
		"",
		"",
		ts.ScriptTarget.ESNext,
		true,
		ts.ScriptKind.TS,
	);
	const printer = ts.createPrinter();

	const typescriptCodeToString = printer.printList(
		ts.ListFormat.MultiLine,
		TsNodesForDatabaseFile,
		sourceFile,
	);
	const transpileToJavaScript = ts.transpile(typescriptCodeToString, {
		module: ts.ModuleKind.None,
		target: ts.ScriptTarget.ESNext,
	});

	// Create databases output folder
	if (!fs.existsSync(DATABASES_DIR)) {
		fs.mkdirSync(DATABASES_DIR);
	}

	// Create TypeScript and JavaScript files
	fs.writeFileSync(
		path.resolve(DATABASES_DIR, `${databaseClassName}.ts`),
		typescriptCodeToString,
	);
	fs.writeFileSync(
		path.resolve(DATABASES_DIR, `${databaseClassName}.js`),
		transpileToJavaScript,
	);

	return { databaseName, databaseClassName, databaseId: dataSourceId };
}

// generate text property
export function createTextProperty(args: { name: string; isTitle: boolean }) {
	const { name, isTitle } = args;
	const text = ts.factory.createPropertySignature(
		undefined,
		ts.factory.createIdentifier(name),
		!isTitle ? ts.factory.createToken(ts.SyntaxKind.QuestionToken) : undefined,
		ts.factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword),
	);
	return text;
}

/**
 * Generate number property to go inside a type
 * name: number
 */
export function createNumberProperty(name: string) {
	const number = ts.factory.createPropertySignature(
		undefined,
		ts.factory.createIdentifier(name),
		ts.factory.createToken(ts.SyntaxKind.QuestionToken),
		ts.factory.createKeywordTypeNode(ts.SyntaxKind.NumberKeyword),
	);
	return number;
}

/**
 * For selects and multi-select collection properties
 * array = true for multi-select
 */
export function createMultiOptionProp(args: {
	name: string;
	arrayIdentifier: string;
	isArray: boolean;
}) {
	const { arrayIdentifier, isArray, name } = args;
	const propertyValueUnion = ts.factory.createUnionTypeNode([
		createPropertyValuesElementType(arrayIdentifier),
		createOtherStringProp(),
	]);
	return ts.factory.createPropertySignature(
		undefined,
		ts.factory.createIdentifier(name),
		ts.factory.createToken(ts.SyntaxKind.QuestionToken),
		isArray
			? ts.factory.createArrayTypeNode(
					ts.factory.createParenthesizedType(propertyValueUnion),
				)
			: propertyValueUnion,
	);
}

// string & {}. Allows users to pass in values
function createOtherStringProp() {
	return ts.factory.createIntersectionTypeNode([
		ts.factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword),
		ts.factory.createTypeLiteralNode([]),
	]);
}

export function createPropertyValuesArray(args: {
	identifier: string;
	options: string[];
}) {
	const { identifier, options } = args;
	return ts.factory.createVariableStatement(
		[ts.factory.createToken(ts.SyntaxKind.ExportKeyword)],
		ts.factory.createVariableDeclarationList(
			[
				ts.factory.createVariableDeclaration(
					ts.factory.createIdentifier(identifier),
					undefined,
					undefined,
					ts.factory.createAsExpression(
						ts.factory.createArrayLiteralExpression(
							options.map((option) => ts.factory.createStringLiteral(option)),
							true,
						),
						ts.factory.createTypeReferenceNode(
							ts.factory.createIdentifier("const"),
							undefined,
						),
					),
				),
			],
			ts.NodeFlags.Const,
		),
	);
}

function createPropertyValuesElementType(arrayIdentifier: string) {
	return ts.factory.createIndexedAccessTypeNode(
		ts.factory.createTypeQueryNode(
			ts.factory.createIdentifier(arrayIdentifier),
			undefined,
		),
		ts.factory.createKeywordTypeNode(ts.SyntaxKind.NumberKeyword),
	);
}

export function toPascalCase(value: string) {
	if (!value) {
		return value;
	}
	return value[0].toUpperCase() + value.slice(1);
}

export function createDateProperty(name: string) {
	return ts.factory.createPropertySignature(
		undefined,
		ts.factory.createIdentifier(name),
		ts.factory.createToken(ts.SyntaxKind.QuestionToken),
		ts.factory.createTypeLiteralNode([
			ts.factory.createPropertySignature(
				undefined,
				ts.factory.createIdentifier("start"),
				undefined,
				ts.factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword),
			),
			ts.factory.createPropertySignature(
				undefined,
				ts.factory.createIdentifier("end"),
				ts.factory.createToken(ts.SyntaxKind.QuestionToken),
				ts.factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword),
			),
		]),
	);
}

/**
 * Generate checkbox property to go inside a type
 * name?: boolean
 */
export function createCheckboxProperty(name: string) {
	const checkbox = ts.factory.createPropertySignature(
		undefined,
		ts.factory.createIdentifier(name),
		ts.factory.createToken(ts.SyntaxKind.QuestionToken),
		ts.factory.createKeywordTypeNode(ts.SyntaxKind.BooleanKeyword),
	);
	return checkbox;
}

// Generate database Id variable
// const id = <database-id>
function createDatabaseIdVariable(databaseId: string) {
  return ts.factory.createVariableStatement(
    undefined,
    ts.factory.createVariableDeclarationList(
      [
        ts.factory.createVariableDeclaration(
          ts.factory.createIdentifier("id"),
          undefined,
          undefined,
          ts.factory.createStringLiteral(databaseId)
        ),
      ],
      ts.NodeFlags.Const
    )
  );
}

/**
 * Instead of refering to the column names 1:1 such as "Book Rating", we transform them to
 * camelcase (eg. bookRating). So we need to keep track of the original name and the type
 * for when we construct request for API
 *
 * Example
 *
 * const columnNameToColumnProperties = {
 *
 *      "bookRating": {
 *          columnName: "Book Rating",
 *          type: "select"
 *      },
 *      "genre": {
 *          columnName: "Genre",
 *          type: "multi_select"
 *      }
 *
 * }
 */
function createColumnNameToColumnProperties(colMap: propNameToColumnNameType) {
  return ts.factory.createVariableDeclarationList(
    [
      ts.factory.createVariableDeclaration(
        ts.factory.createIdentifier("columnNameToColumnProperties"),
        undefined,
        undefined,
        ts.factory.createAsExpression(
          ts.factory.createObjectLiteralExpression(
            [
              ...Object.entries(colMap).map(([propName, value]) =>
                ts.factory.createPropertyAssignment(
                  ts.factory.createStringLiteral(propName),
                  ts.factory.createObjectLiteralExpression(
                    [
                      ts.factory.createPropertyAssignment(
                        ts.factory.createIdentifier("columnName"),
                        ts.factory.createStringLiteral(value.columnName)
                      ),
                      ts.factory.createPropertyAssignment(
                        ts.factory.createIdentifier("type"),
                        ts.factory.createStringLiteral(value.type)
                      ),
                    ],
                    true
                  )
                )
              ),
            ],
            true
          ),
          ts.factory.createTypeReferenceNode(
            ts.factory.createIdentifier("const"),
            undefined
          )
        )
      ),
    ],
    ts.NodeFlags.Const
  );
}

function createColumnNameToColumnType() {
  return ts.factory.createTypeAliasDeclaration(
    undefined,
    ts.factory.createIdentifier("ColumnNameToColumnType"),
    undefined,
    ts.factory.createMappedTypeNode(
      undefined,
      ts.factory.createTypeParameterDeclaration(
        undefined,
        ts.factory.createIdentifier("Property"),
        ts.factory.createTypeOperatorNode(
          ts.SyntaxKind.KeyOfKeyword,
          ts.factory.createTypeQueryNode(
            ts.factory.createIdentifier("columnNameToColumnProperties"),
            undefined
          )
        ),
        undefined
      ),
      undefined,
      undefined,
      ts.factory.createIndexedAccessTypeNode(
        ts.factory.createIndexedAccessTypeNode(
          ts.factory.createTypeQueryNode(
            ts.factory.createIdentifier("columnNameToColumnProperties"),
            undefined
          ),
          ts.factory.createTypeReferenceNode(
            ts.factory.createIdentifier("Property"),
            undefined
          )
        ),
        ts.factory.createLiteralTypeNode(ts.factory.createStringLiteral("type"))
      ),
      undefined
      /* unknown */
    )
  );
}

// Need to import the database class used to execute database actions (adding + querying)
function createNameImport(args: {
  namedImport: string;
  path: string;
  typeOnly?: boolean;
}) {
  const { namedImport, path, typeOnly } = args;
  return ts.factory.createImportDeclaration(
    undefined,
    ts.factory.createImportClause(
      typeOnly ?? false,
      undefined,
      ts.factory.createNamedImports([
        ts.factory.createImportSpecifier(
          false,
          undefined,
          ts.factory.createIdentifier(namedImport)
        ),
      ])
    ),
    ts.factory.createStringLiteral(path),
    undefined
  );
}

function createQueryTypeExport() {
  return ts.factory.createTypeAliasDeclaration(
    [ts.factory.createToken(ts.SyntaxKind.ExportKeyword)],
    ts.factory.createIdentifier("QuerySchemaType"),
    undefined,
    ts.factory.createTypeReferenceNode(ts.factory.createIdentifier("Query"), [
      ts.factory.createTypeReferenceNode(
        ts.factory.createIdentifier("DatabaseSchemaType"),
        undefined
      ),
      ts.factory.createTypeReferenceNode(
        ts.factory.createIdentifier("ColumnNameToColumnType"),
        undefined
      ),
    ])
  );
}

/**
 * Create export statement for the database constructor function
 * export const <databaseName> = (auth: string) => new DatabaseClient<DatabaseSchemaType>({databaseId, columnNameToColumnProperties, auth})
 */
function createDatabaseClassExport(args: {
  databaseName: string;
  schemaIdentifier: string;
  schemaTitle: string;
}) {
  const { databaseName, schemaIdentifier, schemaTitle } = args;
  return ts.factory.createVariableStatement(
    [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)],
    ts.factory.createVariableDeclarationList(
      [
        ts.factory.createVariableDeclaration(
          ts.factory.createIdentifier(databaseName),
          undefined,
          undefined,
          ts.factory.createArrowFunction(
            undefined,
            undefined,
            [
              ts.factory.createParameterDeclaration(
                undefined,
                undefined,
                ts.factory.createIdentifier("auth"),
                undefined,
                ts.factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword),
                undefined
              ),
            ],
            undefined,
            ts.factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
            ts.factory.createNewExpression(
              ts.factory.createIdentifier("DatabaseClient"),
              [
                ts.factory.createTypeReferenceNode(
                  ts.factory.createIdentifier("DatabaseSchemaType"),
                  undefined
                ),
                ts.factory.createTypeReferenceNode(
                  ts.factory.createIdentifier("ColumnNameToColumnType"),
                  undefined
                ),
              ],
              [
                ts.factory.createObjectLiteralExpression(
                  [
                    ts.factory.createShorthandPropertyAssignment(
                      ts.factory.createIdentifier("id"),
                      undefined
                    ),
                    ts.factory.createPropertyAssignment(
                      ts.factory.createIdentifier("propNameToColumnName"),
                      ts.factory.createIdentifier(
                        "columnNameToColumnProperties"
                      )
                    ),
                    ts.factory.createPropertyAssignment(
                      ts.factory.createIdentifier("schema"),
                      ts.factory.createIdentifier(schemaIdentifier)
                    ),
                    ts.factory.createPropertyAssignment(
                      ts.factory.createIdentifier("name"),
                      ts.factory.createStringLiteral(schemaTitle)
                    ),
                    ts.factory.createShorthandPropertyAssignment(
                      ts.factory.createIdentifier("auth"),
                      undefined
                    ),
                  ],
                  false
                ),
              ]
            )
          )
        ),
      ],
      ts.NodeFlags.Const
    )
  );
}

/**
 * Create class-specific type exports for the custom NotionORM class
 * These allow the generated NotionORM class to import properly typed schemas
 */
function createClassSpecificTypeExports(args: {
	databaseName: string;
	schemaIdentifier: string;
}) {
	const { databaseName, schemaIdentifier } = args;
	const pascalDatabaseName = toPascalCase(databaseName);
	return [
		// Export DatabaseSchemaType as [ClassName]Schema
		ts.factory.createTypeAliasDeclaration(
			[ts.factory.createToken(ts.SyntaxKind.ExportKeyword)],
			ts.factory.createIdentifier(`${databaseName}Schema`),
			undefined,
			ts.factory.createTypeReferenceNode(
				ts.factory.createIdentifier("DatabaseSchemaType"),
				undefined,
			),
		),
		// Export ColumnNameToColumnType as [ClassName]ColumnTypes
		ts.factory.createTypeAliasDeclaration(
			[ts.factory.createToken(ts.SyntaxKind.ExportKeyword)],
			ts.factory.createIdentifier(`${databaseName}ColumnTypes`),
			undefined,
			ts.factory.createTypeReferenceNode(
				ts.factory.createIdentifier("ColumnNameToColumnType"),
				undefined,
			),
		),
		// Export inferred schema type
		ts.factory.createTypeAliasDeclaration(
			[ts.factory.createToken(ts.SyntaxKind.ExportKeyword)],
			ts.factory.createIdentifier(`${pascalDatabaseName}SchemaType`),
			undefined,
			ts.factory.createTypeReferenceNode(
				ts.factory.createQualifiedName(
					ts.factory.createIdentifier("z"),
					ts.factory.createIdentifier("infer"),
				),
				[
					ts.factory.createTypeQueryNode(
						ts.factory.createIdentifier(schemaIdentifier),
						undefined,
					),
				],
			),
		),
	];
}

function createZodSchema(args: {
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

function createZodPropertyExpression(column: ZodMetadata) {
	const optional = !column.isRequired;
	switch (column.type) {
		case "title": {
			return createZodPrimitiveCall("string");
		}
		case "rich_text":
		case "email":
		case "phone_number":
		case "url": {
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
		default: {
			return applyOptionalNullable(createZodPrimitiveCall("unknown"), {
				optional: true,
				nullable: true,
			});
		}
	}
}

function createZodPrimitiveCall(
	method: "string" | "number" | "boolean" | "unknown",
) {
	return ts.factory.createCallExpression(
		ts.factory.createPropertyAccessExpression(
			ts.factory.createIdentifier("z"),
			ts.factory.createIdentifier(method),
		),
		undefined,
		[],
	);
}

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
