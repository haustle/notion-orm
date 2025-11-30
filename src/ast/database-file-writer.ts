/**
 * Database file writer - orchestrates the generation of TypeScript files for Notion databases.
 * This module coordinates property generation, AST building, and file writing.
 */

import type { GetDataSourceResponse } from "@notionhq/client/build/src/api-endpoints.js";
import fs from "fs";
import path from "path";
import * as ts from "typescript";
import { DATABASES_DIR } from "./constants";
import {
  type DatabasePropertyType,
  isSupportedPropertyType,
} from "../db-client/queryTypes";
import { camelize } from "../helpers";
import {
  createColumnNameToColumnProperties,
  createColumnNameToColumnType,
  createDatabaseClassExport,
  createDatabaseIdVariable,
  createClassSpecificTypeExports,
  createNameImport,
  createQueryTypeExport,
  toPascalCase,
} from "./ast-builders";
import { AST_IMPORT_PATHS } from "./constants";
import { propertyASTGenerators } from "./notion-column-generators";
import { createZodSchema, ZodMetadata } from "./zod-schema";

type camelPropertyNameToNameAndTypeMapType = Record<
  string,
  { columnName: string; type: DatabasePropertyType }
>;

/**
 * Creates TypeScript files for a single Notion database.
 * Generates both .ts and .js files with the database schema, types, and client.
 */
export async function createTypescriptFileForDatabase(
  dataSourceResponse: GetDataSourceResponse
) {
  const { id: dataSourceId, properties } = dataSourceResponse;

  const camelPropertyNameToNameAndTypeMap: camelPropertyNameToNameAndTypeMapType =
    {};
  const enumConstStatements: ts.Statement[] = [];
  const zodColumns: ZodMetadata[] = [];

  // Due to the type not being a discriminated union, we need to check if the
  // title is in the response. I don't like this pattern, but we'll have to
  // settle for now
  const databaseName: string =
    "title" in dataSourceResponse
      ? dataSourceResponse.title[0].plain_text
      : "DEFAULT_DATABASE_NAME";

  const databaseClassName = camelize(databaseName);

  const databaseColumnTypeProps: ts.TypeElement[] = [];

  // Looping through each column of database
  Object.entries(properties).forEach(([propertyName, value], index) => {
    const { type: propertyType } = value;
    if (!isSupportedPropertyType(propertyType)) {
      // biome-ignore lint/suspicious/noConsole: provide feedback when skipping
      // unsupported schema columns
      console.error(`${index === 0 ? "\n" : ""}
				[${databaseClassName}] Property '${propertyName}' with type '${propertyType}' is not supported and will be skipped.`);
      return;
    }

    // Taking the column name and camelizing it for typescript use
    const camelizedColumnName = camelize(propertyName);

    // Creating map of column name to the column's name in the database's typescript type
    camelPropertyNameToNameAndTypeMap[camelizedColumnName] = {
      columnName: propertyName,
      type: propertyType,
    };

    // Get handler for this column type (propertyType is now narrowed to SupportedNotionColumnType)
    const handler = propertyASTGenerators[propertyType];
    if (!handler) {
      console.warn(`No handler found for column type '${propertyType}'`);
      return;
    }

    // Execute handler to get all data at once
    const result = handler({
      columnName: propertyName,
      camelizedName: camelizedColumnName,
      columnValue: value,
    });
    if (!result) {
      return;
    }

    // Destructure the complete result
    const { tsPropertySignature, zodMeta, enumConstStatement } = result;

    // Add to appropriate collections
    databaseColumnTypeProps.push(tsPropertySignature);

    if (enumConstStatement) {
      enumConstStatements.push(enumConstStatement);
    }

    zodColumns.push({
      propName: camelizedColumnName,
      columnName: propertyName,
      type: propertyType,
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
    ts.factory.createTypeLiteralNode(databaseColumnTypeProps)
  );

  // Top level non-nested variable, functions, types for database files
  const TsNodesForDatabaseFile = ts.factory.createNodeArray([
    createNameImport({
      namedImport: "DatabaseClient",
      path: AST_IMPORT_PATHS.DATABASE_CLIENT,
    }),
    createNameImport({
      namedImport: "z",
      path: AST_IMPORT_PATHS.ZOD,
    }),
    createNameImport({
      namedImport: "Query",
      path: AST_IMPORT_PATHS.QUERY_TYPES,
      typeOnly: true,
    }),
    createDatabaseIdVariable(dataSourceId),
    ...enumConstStatements,
    zodSchemaStatement,
    DatabaseSchemaType,
    createColumnNameToColumnProperties(camelPropertyNameToNameAndTypeMap),
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
    ts.ScriptKind.TS
  );
  const printer = ts.createPrinter();

  const typescriptCodeToString = printer.printList(
    ts.ListFormat.MultiLine,
    TsNodesForDatabaseFile,
    sourceFile
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
    typescriptCodeToString
  );
  fs.writeFileSync(
    path.resolve(DATABASES_DIR, `${databaseClassName}.js`),
    transpileToJavaScript
  );

  return { databaseName, databaseClassName, databaseId: dataSourceId };
}
