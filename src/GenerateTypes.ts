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

type propNameToColumnNameType = Record<
	string,
	{ columnName: string; type: DatabasePropertyType }
>;

/* 
Responsible for generating `.ts` files
*/
export async function createTypescriptFileForDatabase(
	dbResponse: GetDataSourceResponse,
) {
	const { id: databaseId, properties } = dbResponse;

	const propNameToColumnName: propNameToColumnNameType = {};
	const propertyValueArrayStatements: ts.Statement[] = [];

	// Due to the type not being a descriminated union, we need to check if the title is in the response.
	// I don't like this pattern, but we'll have to settle for now
	const databaseName: string =
		"title" in dbResponse
			? dbResponse.title[0].plain_text
			: "DEFAULT_DATABASE_NAME";

	const databaseClassName = camelize(databaseName).replace(/[^a-zA-Z0-9]/g, "");

	const databaseColumnTypeProps: ts.TypeElement[] = [];

	// Looping through each column of database
	Object.entries(properties).forEach(([columnName, value]) => {
		const { type: columnType } = value;
		const isValidPropertyType = isSupportedPropertyType(columnType);
		if (!isValidPropertyType) {
			console.warn(
				`Property '${columnName}' with type '${columnType}' is not supported and will be skipped.`,
			);
			return;
		}

		if (columnType === "title") {
			console.log("found title", value.title);

			console.log({ title: value.title });
			// databaseName = value.title[0].plain_text;
		}

		// Taking the column name and camelizing it for typescript use
		const camelizedColumnName = camelize(columnName);

		// Creating map of column name to the column's name in the database's typescript type
		propNameToColumnName[camelizedColumnName] = {
			columnName,
			type: columnType,
		};

		if (
			columnType === "title" ||
			columnType === "rich_text" ||
			columnType === "email" ||
			columnType === "phone_number"
		) {
			// add text column to collection type
			databaseColumnTypeProps.push(
				createTextProperty({
					name: camelizedColumnName,
					isTitle: columnType === "title",
				}),
			);
		} else if (columnType === "number") {
			// add number column to collection type
			databaseColumnTypeProps.push(createNumberProperty(camelizedColumnName));
		} else if (columnType === "url") {
			// add url column to collection type
			databaseColumnTypeProps.push(
				createTextProperty({ name: camelizedColumnName, isTitle: false }),
			);
		} else if (columnType === "date") {
			// add Date column to collection type
			databaseColumnTypeProps.push(createDateProperty(camelizedColumnName));
		} else if (
			columnType === "select" ||
			columnType === "status" ||
			columnType === "multi_select"
		) {
			// @ts-expect-error
			const options = value[columnType].options.map((x) => x.name);
			const propertyValuesIdentifier = `${toPascalCase(
				camelizedColumnName,
			)}PropertyValues`;
			propertyValueArrayStatements.push(
				createPropertyValuesArray({
					identifier: propertyValuesIdentifier,
					options,
				}),
			);
			databaseColumnTypeProps.push(
				createMultiOptionProp({
					name: camelizedColumnName,
					arrayIdentifier: propertyValuesIdentifier,
					isArray: columnType === "multi_select", // Union or Union Array
				}),
			);
		} else if (columnType === "checkbox") {
			// add checkbox column to collection type
			databaseColumnTypeProps.push(createCheckboxProperty(camelizedColumnName));
		}
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
			namedImport: "Query",
			path: "../src/queryTypes",
		}),
		createDatabaseIdVariable(databaseId),
		...propertyValueArrayStatements,
		DatabaseSchemaType,
		createColumnNameToColumnProperties(propNameToColumnName),
		createColumnNameToColumnType(),
		createQueryTypeExport(),
		createDatabaseClassExport({ databaseName: databaseClassName }),
		// Export class-specific type aliases for the custom NotionORM class
		...createClassSpecificTypeExports({ databaseName: databaseClassName }),
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

	return { databaseName, databaseClassName, databaseId };
}

// generate text property
function createTextProperty(args: { name: string; isTitle: boolean }) {
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
function createNumberProperty(name: string) {
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
function createMultiOptionProp(args: {
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

function createPropertyValuesArray(args: {
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

function toPascalCase(value: string) {
	if (!value) {
		return value;
	}
	return value[0].toUpperCase() + value.slice(1);
}

function createDateProperty(name: string) {
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
function createCheckboxProperty(name: string) {
	const checkbox = ts.factory.createPropertySignature(
		undefined,
		ts.factory.createIdentifier(name),
		ts.factory.createToken(ts.SyntaxKind.QuestionToken),
		ts.factory.createKeywordTypeNode(ts.SyntaxKind.BooleanKeyword),
	);
	return checkbox;
}

// Generate database Id variable
// const databaseId = <database-id>
function createDatabaseIdVariable(databaseId: string) {
	return ts.factory.createVariableStatement(
		undefined,
		ts.factory.createVariableDeclarationList(
			[
				ts.factory.createVariableDeclaration(
					ts.factory.createIdentifier("databaseId"),
					undefined,
					undefined,
					ts.factory.createStringLiteral(databaseId),
				),
			],
			ts.NodeFlags.Const,
		),
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
												ts.factory.createStringLiteral(value.columnName),
											),
											ts.factory.createPropertyAssignment(
												ts.factory.createIdentifier("type"),
												ts.factory.createStringLiteral(value.type),
											),
										],
										true,
									),
								),
							),
						],
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
						undefined,
					),
				),
				undefined,
			),
			undefined,
			undefined,
			ts.factory.createIndexedAccessTypeNode(
				ts.factory.createIndexedAccessTypeNode(
					ts.factory.createTypeQueryNode(
						ts.factory.createIdentifier("columnNameToColumnProperties"),
						undefined,
					),
					ts.factory.createTypeReferenceNode(
						ts.factory.createIdentifier("Property"),
						undefined,
					),
				),
				ts.factory.createLiteralTypeNode(
					ts.factory.createStringLiteral("type"),
				),
			),
			undefined,
			/* unknown */
		),
	);
}

// Need to import the database class used to execute database actions (adding + querying)
function createNameImport(args: { namedImport: string; path: string }) {
	const { namedImport, path } = args;
	return ts.factory.createImportDeclaration(
		undefined,
		ts.factory.createImportClause(
			false,
			undefined,
			ts.factory.createNamedImports([
				ts.factory.createImportSpecifier(
					false,
					undefined,
					ts.factory.createIdentifier(namedImport),
				),
			]),
		),
		ts.factory.createStringLiteral(path),
		undefined,
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
				undefined,
			),
			ts.factory.createTypeReferenceNode(
				ts.factory.createIdentifier("ColumnNameToColumnType"),
				undefined,
			),
		]),
	);
}

/**
 * Create export statement for the database constructor function
 * export const <databaseName> = (auth: string) => new DatabaseClient<DatabaseSchemaType>({databaseId, columnNameToColumnProperties, auth})
 */
function createDatabaseClassExport(args: { databaseName: string }) {
	const { databaseName } = args;
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
								undefined,
							),
						],
						undefined,
						ts.factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
						ts.factory.createNewExpression(
							ts.factory.createIdentifier("DatabaseClient"),
							[
								ts.factory.createTypeReferenceNode(
									ts.factory.createIdentifier("DatabaseSchemaType"),
									undefined,
								),
								ts.factory.createTypeReferenceNode(
									ts.factory.createIdentifier("ColumnNameToColumnType"),
									undefined,
								),
							],
							[
								ts.factory.createObjectLiteralExpression(
									[
										ts.factory.createShorthandPropertyAssignment(
											ts.factory.createIdentifier("databaseId"),
											undefined,
										),
										ts.factory.createPropertyAssignment(
											ts.factory.createIdentifier("propNameToColumnName"),
											ts.factory.createIdentifier(
												"columnNameToColumnProperties",
											),
										),
										ts.factory.createShorthandPropertyAssignment(
											ts.factory.createIdentifier("auth"),
											undefined,
										),
									],
									false,
								),
							],
						),
					),
				),
			],
			ts.NodeFlags.Const,
		),
	);
}

/**
 * Create class-specific type exports for the custom NotionORM class
 * These allow the generated NotionORM class to import properly typed schemas
 */
function createClassSpecificTypeExports(args: { databaseName: string }) {
	const { databaseName } = args;
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
	];
}
