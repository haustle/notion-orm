/**
 * Zod schema generation utilities.
 * Creates Zod validation schemas from database property metadata.
 */

import * as ts from "typescript";

import { type DatabasePropertyType } from "../db-client/queryTypes";

export interface ZodMetadata {
  propName: string;
  columnName: string;
  type: DatabasePropertyType;
  isRequired: boolean;
  options?: string[];
  propertyValuesIdentifier?: string;
}

export function createZodSchema(args: {
  identifier: string;
  columns: ZodMetadata[];
}) {
  const { identifier, columns } = args;
  const properties = columns.map((column) =>
    ts.factory.createPropertyAssignment(
      ts.factory.createIdentifier(column.propName),
      createZodPropertyExpression(column)
    )
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
              ts.factory.createIdentifier("object")
            ),
            undefined,
            [ts.factory.createObjectLiteralExpression(properties, true)]
          )
        ),
      ],
      ts.NodeFlags.Const
    )
  );
}

export function createZodPropertyExpression(column: ZodMetadata) {
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
  method: "string" | "number" | "boolean" | "unknown"
) {
  return ts.factory.createCallExpression(
    ts.factory.createPropertyAccessExpression(
      ts.factory.createIdentifier("z"),
      ts.factory.createIdentifier(method)
    ),
    undefined,
    []
  );
}

function applyOptionalNullable(
  expression: ts.Expression,
  args: { optional?: boolean; nullable?: boolean }
) {
  const { optional, nullable } = args;
  let currentExpression = expression;
  if (nullable) {
    currentExpression = ts.factory.createCallExpression(
      ts.factory.createPropertyAccessExpression(
        currentExpression,
        ts.factory.createIdentifier("nullable")
      ),
      undefined,
      []
    );
  }
  if (optional) {
    currentExpression = ts.factory.createCallExpression(
      ts.factory.createPropertyAccessExpression(
        currentExpression,
        ts.factory.createIdentifier("optional")
      ),
      undefined,
      []
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
        ts.factory.createIdentifier("enum")
      ),
      undefined,
      [ts.factory.createIdentifier(column.propertyValuesIdentifier)]
    );
  }
  return createZodPrimitiveCall("string");
}

function createZodArrayEnumExpression(column: ZodMetadata) {
  const enumExpression = createZodEnumExpression(column);
  return ts.factory.createCallExpression(
    ts.factory.createPropertyAccessExpression(
      ts.factory.createIdentifier("z"),
      ts.factory.createIdentifier("array")
    ),
    undefined,
    [enumExpression]
  );
}

function createZodDateExpression(optional: boolean) {
  const startAssignment = ts.factory.createPropertyAssignment(
    ts.factory.createIdentifier("start"),
    createZodPrimitiveCall("string")
  );
  const endAssignment = ts.factory.createPropertyAssignment(
    ts.factory.createIdentifier("end"),
    applyOptionalNullable(createZodPrimitiveCall("string"), {
      optional: true,
      nullable: true,
    })
  );
  const dateObjectExpression = ts.factory.createCallExpression(
    ts.factory.createPropertyAccessExpression(
      ts.factory.createIdentifier("z"),
      ts.factory.createIdentifier("object")
    ),
    undefined,
    [
      ts.factory.createObjectLiteralExpression(
        [startAssignment, endAssignment],
        true
      ),
    ]
  );
  return applyOptionalNullable(dateObjectExpression, {
    optional,
    nullable: true,
  });
}
