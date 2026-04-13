/**
 * Reusable AST builder functions for generating TypeScript code.
 * These functions create TypeScript AST nodes for properties, imports, exports, and types.
 */

import * as ts from "typescript";
import type {
	ColumnTypesWithOptions,
	SupportedNotionColumnType,
} from "../../client/database/types";
import { objectEntries } from "../../typeUtils";

export { toPascalCase } from "../../helpers";

/**
 * Plain column: emitted metadata has no `options` array (non–select-like types).
 */
export type OptionlessColumnMetadataEntry = {
	readonly columnName: string;
	readonly type: Exclude<SupportedNotionColumnType, ColumnTypesWithOptions | "relation">;
};

/**
 * Relation: emitted metadata includes the linked database id (undashed) from Notion.
 */
export type RelationGeneratedColumnMetadataEntry = {
	readonly columnName: string;
	readonly type: "relation";
	readonly relatedDatabaseId: string;
};

/**
 * Select / status / multi_select: emitted metadata includes `options` pointing at a
 * generated const; `type` discriminates this arm from {@link OptionlessColumnMetadataEntry}.
 */
export type SelectLikeGeneratedColumnMetadataEntry = {
	readonly columnName: string;
	readonly type: ColumnTypesWithOptions;
	readonly optionsIdentifier: string;
};

export type GeneratedColumnMetadataEntry =
	| OptionlessColumnMetadataEntry
	| SelectLikeGeneratedColumnMetadataEntry
	| RelationGeneratedColumnMetadataEntry;

/** Lookup map used to generate the emitted `columns` object. */
export type GeneratedColumnMetadataMap = Record<
	string,
	GeneratedColumnMetadataEntry
>;

function optionsPropertyAssignmentsForSelectLikeMetadata(
	entry: SelectLikeGeneratedColumnMetadataEntry,
): readonly ts.PropertyAssignment[] {
	return [
		ts.factory.createPropertyAssignment(
			ts.factory.createIdentifier("options"),
			ts.factory.createIdentifier(entry.optionsIdentifier),
		),
	];
}

/** Emits `options` / `relatedDatabaseId` for column metadata beyond `columnName` + `type`. */
function extraMetadataPropertyAssignmentsForGeneratedColumn(
	value: GeneratedColumnMetadataEntry,
): readonly ts.PropertyAssignment[] {
	switch (value.type) {
		case "select":
		case "status":
		case "multi_select":
			return optionsPropertyAssignmentsForSelectLikeMetadata(value);
		case "relation":
			return [
				ts.factory.createPropertyAssignment(
					ts.factory.createIdentifier("relatedDatabaseId"),
					ts.factory.createStringLiteral(value.relatedDatabaseId),
				),
			];
		default:
			return [];
	}
}

/**
 * Generate text property signature
 * name: string (or name?: string if not title)
 */
export function createTextProperty(args: { name: string; isTitle: boolean }) {
  const { name, isTitle } = args;
  const text = ts.factory.createPropertySignature(
    undefined,
    ts.factory.createIdentifier(name),
    !isTitle ? ts.factory.createToken(ts.SyntaxKind.QuestionToken) : undefined,
    ts.factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword)
  );
  return text;
}

/**
 * Generate number property signature
 * name?: number
 */
export function createNumberProperty(name: string) {
  const number = ts.factory.createPropertySignature(
    undefined,
    ts.factory.createIdentifier(name),
    ts.factory.createToken(ts.SyntaxKind.QuestionToken),
    ts.factory.createKeywordTypeNode(ts.SyntaxKind.NumberKeyword)
  );
  return number;
}

/**
 * Generate date property signature
 * name?: { start: string; end?: string }
 */
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
        ts.factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword)
      ),
      ts.factory.createPropertySignature(
        undefined,
        ts.factory.createIdentifier("end"),
        ts.factory.createToken(ts.SyntaxKind.QuestionToken),
        ts.factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword)
      ),
    ])
  );
}

/**
 * Generate checkbox property signature
 * name?: boolean
 */
export function createCheckboxProperty(name: string) {
  const checkbox = ts.factory.createPropertySignature(
    undefined,
    ts.factory.createIdentifier(name),
    ts.factory.createToken(ts.SyntaxKind.QuestionToken),
    ts.factory.createKeywordTypeNode(ts.SyntaxKind.BooleanKeyword)
  );
  return checkbox;
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
          ts.factory.createParenthesizedType(propertyValueUnion)
        )
      : propertyValueUnion
  );
}

/**
 * Create a const array of property values for enum types
 */
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
    )
  );
}

/**
 * string & {} - Allows users to pass in custom values
 */
function createOtherStringProp() {
  return ts.factory.createIntersectionTypeNode([
    ts.factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword),
    ts.factory.createTypeLiteralNode([]),
  ]);
}

/**
 * Builds `<PropertyValuesConst>[number]` element type reference.
 */
function createPropertyValuesElementType(arrayIdentifier: string) {
	return ts.factory.createIndexedAccessTypeNode(
		ts.factory.createTypeQueryNode(
			ts.factory.createIdentifier(arrayIdentifier),
			undefined,
		),
		ts.factory.createKeywordTypeNode(ts.SyntaxKind.NumberKeyword),
	);
}

/**
 * Generate database ID variable
 * const id = "<database-id>"
 */
export function createDatabaseIdVariable(databaseId: string) {
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
 * Create import declaration
 */
export function createNameImport(args: {
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

/**
 * `import type { a, b } from "path"`
 */
export function createTypeOnlyNamedImports(args: {
	names: readonly string[];
	path: string;
}): ts.ImportDeclaration {
	return ts.factory.createImportDeclaration(
		undefined,
		ts.factory.createImportClause(
			true,
			undefined,
			ts.factory.createNamedImports(
				args.names.map((name) =>
					ts.factory.createImportSpecifier(
						false,
						undefined,
						ts.factory.createIdentifier(name),
					),
				),
			),
		),
		ts.factory.createStringLiteral(args.path),
		undefined,
	);
}

/**
 * Create column name to column properties mapping
 * Maps camelCase property names to their original names and types
 */
export function createColumnNameToColumnProperties(
  colMap: GeneratedColumnMetadataMap
) {
	const metadataObjectLiteral = ts.factory.createObjectLiteralExpression(
		[
			...objectEntries(colMap).map(([propName, value]) =>
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
							...extraMetadataPropertyAssignmentsForGeneratedColumn(value),
						],
						true,
					),
				),
			),
		],
		true,
	);
	const asConst = ts.factory.createAsExpression(
		metadataObjectLiteral,
		ts.factory.createTypeReferenceNode(
			ts.factory.createIdentifier("const"),
			undefined,
		),
	);
	const satisfiesTarget = ts.factory.createTypeReferenceNode(
		ts.factory.createIdentifier("DatabaseColumns"),
		undefined,
	);
	const initializer = ts.factory.createSatisfiesExpression(
		asConst,
		satisfiesTarget,
	);
  return ts.factory.createVariableDeclarationList(
			[
				ts.factory.createVariableDeclaration(
					ts.factory.createIdentifier("columns"),
					undefined,
					undefined,
					initializer,
				),
			],
			ts.NodeFlags.Const,
		);
}

/**
 * Create QuerySchemaType export
 */
export function createQueryTypeExport() {
  return ts.factory.createTypeAliasDeclaration(
    [ts.factory.createToken(ts.SyntaxKind.ExportKeyword)],
    ts.factory.createIdentifier("QuerySchemaType"),
    undefined,
    ts.factory.createTypeReferenceNode(ts.factory.createIdentifier("Query"), [
      createDatabaseDefinitionOfColumnsTypeReference(),
    ])
  );
}

export function createSchemaTypeExport() {
	return ts.factory.createTypeAliasDeclaration(
		[ts.factory.createToken(ts.SyntaxKind.ExportKeyword)],
		ts.factory.createIdentifier("DatabaseSchemaType"),
		undefined,
		ts.factory.createTypeReferenceNode(
			ts.factory.createIdentifier("InferDatabaseSchema"),
			[
				ts.factory.createTypeQueryNode(
					ts.factory.createIdentifier("columns"),
					undefined,
				),
			],
		),
	);
}

function createDatabaseDefinitionOfColumnsTypeReference() {
	return ts.factory.createTypeReferenceNode(
		ts.factory.createIdentifier("DatabaseDefinition"),
		[
			ts.factory.createTypeQueryNode(
				ts.factory.createIdentifier("columns"),
				undefined,
			),
		],
	);
}

/**
 * Create export statement for the database constructor function.
 * Uses a block body + multiline object literal so generated files stay readable.
 * `databaseName` is the exported const identifier (PascalCase, e.g. `CustomerOrders`).
 */
export function createDatabaseClassExport(args: {
  databaseName: string;
  schemaTitle: string;
  /** Undashed Notion data source id, inlined on the client config object. */
  databaseId: string;
}) {
  const { databaseName, schemaTitle, databaseId } = args;
  const clientConfigObject = ts.factory.createObjectLiteralExpression(
    [
      ts.factory.createPropertyAssignment(
        ts.factory.createIdentifier("id"),
        ts.factory.createStringLiteral(databaseId),
      ),
      ts.factory.createPropertyAssignment(
        ts.factory.createIdentifier("columns"),
        ts.factory.createIdentifier("columns"),
      ),
      ts.factory.createPropertyAssignment(
        ts.factory.createIdentifier("name"),
        ts.factory.createStringLiteral(schemaTitle),
      ),
      ts.factory.createShorthandPropertyAssignment(
        ts.factory.createIdentifier("auth"),
        undefined,
      ),
    ],
    true,
  );
  const newDatabaseClient = ts.factory.createNewExpression(
    ts.factory.createIdentifier("DatabaseClient"),
    [
      createDatabaseDefinitionOfColumnsTypeReference(),
    ],
    [clientConfigObject],
  );
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
            ts.factory.createBlock(
              [ts.factory.createReturnStatement(newDatabaseClient)],
              true,
            ),
          ),
        ),
      ],
      ts.NodeFlags.Const,
    ),
  );
}
