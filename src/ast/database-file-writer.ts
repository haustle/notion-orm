/**
 * Database file writer — generates TypeScript files for Notion databases.
 */

import type { GetDataSourceResponse } from "@notionhq/client/build/src/api-endpoints.js";
import fs from "fs";
import path from "path";
import * as ts from "typescript";
import { getImportPaths } from "./constants";
import { type DatabasePropertyType, isSupportedPropertyType } from "../db-client/types";
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

export async function createTypescriptFileForDatabase(
  dataSourceResponse: GetDataSourceResponse,
  name: string,
  databasesDirPath: string,
) {
  const { id: dataSourceId, properties } = dataSourceResponse;
  const importPaths = getImportPaths(databasesDirPath);

  const camelPropertyNameToNameAndTypeMap: CamelPropertyNameToNameAndTypeMap = {};
  const enumConstStatements: ts.Statement[] = [];
  const zodColumns: ZodMetadata[] = [];

  const databaseClassName = name;
  const databaseColumnTypeProps: ts.TypeElement[] = [];

  Object.entries(properties).forEach(([propertyName, value]) => {
    const { type: propertyType } = value;
    if (!isSupportedPropertyType(propertyType)) return;

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
    createNameImport({ namedImport: "DatabaseClient", path: importPaths.DATABASE_CLIENT }),
    createNameImport({ namedImport: "z", path: importPaths.ZOD }),
    createNameImport({ namedImport: "Query", path: importPaths.QUERY_TYPES, typeOnly: true }),
    createDatabaseIdVariable(dataSourceId),
    ...enumConstStatements,
    zodSchemaStatement,
    DatabaseSchemaTypeNode,
    createColumnNameToColumnProperties(camelPropertyNameToNameAndTypeMap),
    createColumnNameToColumnType(),
    createQueryTypeExport(),
    createDatabaseClassExport({ databaseName: databaseClassName, schemaIdentifier, schemaTitle: databaseClassName }),
    ...createClassSpecificTypeExports({ databaseName: databaseClassName, schemaIdentifier }),
  ]);

  const sourceFile = ts.createSourceFile("", "", ts.ScriptTarget.ESNext, true, ts.ScriptKind.TS);
  const code = ts.createPrinter().printList(ts.ListFormat.MultiLine, nodes, sourceFile);

  if (!fs.existsSync(databasesDirPath)) fs.mkdirSync(databasesDirPath, { recursive: true });
  fs.writeFileSync(path.resolve(databasesDirPath, `${databaseClassName}.ts`), code);
  fs.writeFileSync(
    path.resolve(databasesDirPath, `${databaseClassName}.js`),
    ts.transpile(code, { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ESNext }),
  );

  return { databaseClassName, databaseId: dataSourceId };
}
