/**
 * Database file writer — generates TypeScript files for Notion databases.
 */

import type { GetDataSourceResponse } from "@notionhq/client/build/src/api-endpoints.js";
import fs from "fs";
import path from "path";
import * as ts from "typescript";
import { DATABASES_DIR, AST_IMPORT_PATHS } from "./constants";
import { type DatabasePropertyType, isSupportedPropertyType } from "../db-client/queryTypes";
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
import { propertyASTGenerators } from "./notion-column-generators";
import { type ZodMetadata, createZodSchema } from "./zod-schema";

type CamelPropertyNameToNameAndTypeMap = Record<string, { columnName: string; type: DatabasePropertyType }>;

export async function createTypescriptFileForDatabase(dataSourceResponse: GetDataSourceResponse) {
  const { id: dataSourceId, properties } = dataSourceResponse;

  const camelPropertyNameToNameAndTypeMap: CamelPropertyNameToNameAndTypeMap = {};
  const enumConstStatements: ts.Statement[] = [];
  const zodColumns: ZodMetadata[] = [];

  const databaseName: string =
    "title" in dataSourceResponse ? dataSourceResponse.title[0].plain_text : "DEFAULT_DATABASE_NAME";

  const databaseClassName = camelize(databaseName);
  const databaseColumnTypeProps: ts.TypeElement[] = [];

  Object.entries(properties).forEach(([propertyName, value], index) => {
    const { type: propertyType } = value;
    if (!isSupportedPropertyType(propertyType)) {
      console.error(
        `${index === 0 ? "\n" : ""}[${databaseClassName}] Property '${propertyName}' with type '${propertyType}' is not supported and will be skipped.`,
      );
      return;
    }

    const camelizedColumnName = camelize(propertyName);
    camelPropertyNameToNameAndTypeMap[camelizedColumnName] = { columnName: propertyName, type: propertyType };

    const handler = propertyASTGenerators[propertyType];
    if (!handler) {
      console.warn(`No handler found for column type '${propertyType}'`);
      return;
    }

    const result = handler({ columnName: propertyName, camelizedName: camelizedColumnName, columnValue: value });
    if (!result) return;

    const { tsPropertySignature, zodMeta, enumConstStatement } = result;
    databaseColumnTypeProps.push(tsPropertySignature);
    if (enumConstStatement) enumConstStatements.push(enumConstStatement);
    zodColumns.push({ propName: camelizedColumnName, columnName: propertyName, type: propertyType, ...zodMeta });
  });

  const schemaIdentifier = `${toPascalCase(databaseClassName)}Schema`;
  const zodSchemaStatement = createZodSchema({ identifier: schemaIdentifier, columns: zodColumns });

  const DatabaseSchemaTypeNode = ts.factory.createTypeAliasDeclaration(
    [ts.factory.createToken(ts.SyntaxKind.ExportKeyword)],
    ts.factory.createIdentifier("DatabaseSchemaType"),
    undefined,
    ts.factory.createTypeLiteralNode(databaseColumnTypeProps),
  );

  const nodes = ts.factory.createNodeArray([
    createNameImport({ namedImport: "DatabaseClient", path: AST_IMPORT_PATHS.DATABASE_CLIENT }),
    createNameImport({ namedImport: "z", path: AST_IMPORT_PATHS.ZOD }),
    createNameImport({ namedImport: "Query", path: AST_IMPORT_PATHS.QUERY_TYPES, typeOnly: true }),
    createDatabaseIdVariable(dataSourceId),
    ...enumConstStatements,
    zodSchemaStatement,
    DatabaseSchemaTypeNode,
    createColumnNameToColumnProperties(camelPropertyNameToNameAndTypeMap),
    createColumnNameToColumnType(),
    createQueryTypeExport(),
    createDatabaseClassExport({ databaseName: databaseClassName, schemaIdentifier, schemaTitle: databaseName }),
    ...createClassSpecificTypeExports({ databaseName: databaseClassName, schemaIdentifier }),
  ]);

  const sourceFile = ts.createSourceFile("", "", ts.ScriptTarget.ESNext, true, ts.ScriptKind.TS);
  const code = ts.createPrinter().printList(ts.ListFormat.MultiLine, nodes, sourceFile);

  if (!fs.existsSync(DATABASES_DIR)) fs.mkdirSync(DATABASES_DIR, { recursive: true });
  fs.writeFileSync(path.resolve(DATABASES_DIR, `${databaseClassName}.ts`), code);
  fs.writeFileSync(
    path.resolve(DATABASES_DIR, `${databaseClassName}.js`),
    ts.transpile(code, { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ESNext }),
  );

  return { databaseName, databaseClassName, databaseId: dataSourceId };
}
