/**
 * Reusable AST builder functions for generating TypeScript code.
 * These functions create TypeScript AST nodes for properties, imports, exports, and types.
 */

import * as ts from "typescript";
import type { DatabasePropertyType } from "../../client/queryTypes";

type camelPropertyNameToNameAndTypeMapType = Record<
  string,
  { columnName: string; type: DatabasePropertyType }
>;

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

function createPropertyValuesElementType(arrayIdentifier: string) {
  return ts.factory.createIndexedAccessTypeNode(
    ts.factory.createTypeQueryNode(
      ts.factory.createIdentifier(arrayIdentifier),
      undefined
    ),
    ts.factory.createKeywordTypeNode(ts.SyntaxKind.NumberKeyword)
  );
}

/**
 * Convert string to PascalCase
 */
export function toPascalCase(value: string) {
  if (!value) {
    return value;
  }
  return value[0].toUpperCase() + value.slice(1);
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
 * Create column name to column properties mapping
 * Maps camelCase property names to their original names and types
 */
export function createColumnNameToColumnProperties(
  colMap: camelPropertyNameToNameAndTypeMapType
) {
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

/**
 * Create ColumnNameToColumnType type alias
 */
export function createColumnNameToColumnType() {
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
    )
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
 * export const <databaseName> = (auth: string) => new DatabaseClient<DatabaseSchemaType>({...})
 */
export function createDatabaseClassExport(args: {
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
                      ts.factory.createIdentifier(
                        "camelPropertyNameToNameAndTypeMap"
                      ),
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
export function createClassSpecificTypeExports(args: {
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
        undefined
      )
    ),
    // Export ColumnNameToColumnType as [ClassName]ColumnTypes
    ts.factory.createTypeAliasDeclaration(
      [ts.factory.createToken(ts.SyntaxKind.ExportKeyword)],
      ts.factory.createIdentifier(`${databaseName}ColumnTypes`),
      undefined,
      ts.factory.createTypeReferenceNode(
        ts.factory.createIdentifier("ColumnNameToColumnType"),
        undefined
      )
    ),
    // Export inferred schema type
    ts.factory.createTypeAliasDeclaration(
      [ts.factory.createToken(ts.SyntaxKind.ExportKeyword)],
      ts.factory.createIdentifier(`${pascalDatabaseName}SchemaType`),
      undefined,
      ts.factory.createTypeReferenceNode(
        ts.factory.createQualifiedName(
          ts.factory.createIdentifier("z"),
          ts.factory.createIdentifier("infer")
        ),
        [
          ts.factory.createTypeQueryNode(
            ts.factory.createIdentifier(schemaIdentifier),
            undefined
          ),
        ]
      )
    ),
  ];
}
