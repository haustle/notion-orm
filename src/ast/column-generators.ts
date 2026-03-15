/**
 * Column property generators for Notion database properties.
 * Maps Notion property types to AST generators that create TypeScript types and Zod schemas.
 */

import * as ts from "typescript";
import type {
  DatabasePropertyType,
  SupportedNotionColumnType,
} from "../db-client/types";
import {
  createCheckboxProperty,
  createDateProperty,
  createFormulaProperty,
  createMultiOptionProp,
  createNumberProperty,
  createPropertyValuesArray,
  createRollupProperty,
  createTextProperty,
  toPascalCase,
} from "./ast-builders";

const DATE_ROLLUP_FUNCTIONS = new Set(["date_range", "earliest_date", "latest_date"]);
const ARRAY_ROLLUP_FUNCTIONS = new Set(["show_original", "show_unique"]);

function getRollupType(fn: string): "number" | "date" | "array" {
  if (DATE_ROLLUP_FUNCTIONS.has(fn)) return "date";
  if (ARRAY_ROLLUP_FUNCTIONS.has(fn)) return "array";
  return "number";
}
import { ZodMetadata } from "./zod-schema";

export interface PropertyASTResult {
  tsPropertySignature: ts.TypeElement;
  zodMeta: Omit<ZodMetadata, "propName" | "columnName" | "type">;
  enumConstStatement?: ts.Statement;
}

export interface PropertyASTContext {
  columnName: string;
  camelizedName: string;
  columnValue: any;
}

export type PropertyASTGenerator = (
  context: PropertyASTContext
) => PropertyASTResult | null;

export const propertyASTGenerators = {
  title: ({ camelizedName }) => ({
    tsPropertySignature: createTextProperty({
      name: camelizedName,
      isTitle: true,
    }),
    zodMeta: {
      isRequired: true,
    },
    enumConstStatement: undefined,
  }),

  rich_text: ({ camelizedName }) => ({
    tsPropertySignature: createTextProperty({
      name: camelizedName,
      isTitle: false,
    }),
    zodMeta: {
      isRequired: false,
    },
    enumConstStatement: undefined,
  }),

  email: ({ camelizedName }) => ({
    tsPropertySignature: createTextProperty({
      name: camelizedName,
      isTitle: false,
    }),
    zodMeta: {
      isRequired: false,
    },
    enumConstStatement: undefined,
  }),

  phone_number: ({ camelizedName }) => ({
    tsPropertySignature: createTextProperty({
      name: camelizedName,
      isTitle: false,
    }),
    zodMeta: {
      isRequired: false,
    },
    enumConstStatement: undefined,
  }),

  url: ({ camelizedName }) => ({
    tsPropertySignature: createTextProperty({
      name: camelizedName,
      isTitle: false,
    }),
    zodMeta: {
      isRequired: false,
    },
    enumConstStatement: undefined,
  }),

  number: ({ camelizedName }) => ({
    tsPropertySignature: createNumberProperty(camelizedName),
    zodMeta: {
      isRequired: false,
    },
    enumConstStatement: undefined,
  }),

  date: ({ camelizedName }) => ({
    tsPropertySignature: createDateProperty(camelizedName),
    zodMeta: {
      isRequired: false,
    },
    enumConstStatement: undefined,
  }),

  checkbox: ({ camelizedName }) => ({
    tsPropertySignature: createCheckboxProperty(camelizedName),
    zodMeta: {
      isRequired: false,
    },
    enumConstStatement: undefined,
  }),

  select: ({ camelizedName, columnValue }) => {
    const options: string[] =
      columnValue.select?.options?.map((x: any) => x.name) ?? [];
    const propertyValuesIdentifier = `${toPascalCase(
      camelizedName
    )}PropertyValues`;

    return {
      tsPropertySignature: createMultiOptionProp({
        name: camelizedName,
        arrayIdentifier: propertyValuesIdentifier,
        isArray: false,
      }),
      zodMeta: {
        isRequired: false,
        options,
        propertyValuesIdentifier,
      },
      enumConstStatement: createPropertyValuesArray({
        identifier: propertyValuesIdentifier,
        options,
      }),
    };
  },

  status: ({ camelizedName, columnValue }) => {
    const options: string[] =
      columnValue.status?.options?.map((x: any) => x.name) ?? [];
    const propertyValuesIdentifier = `${toPascalCase(
      camelizedName
    )}PropertyValues`;

    return {
      tsPropertySignature: createMultiOptionProp({
        name: camelizedName,
        arrayIdentifier: propertyValuesIdentifier,
        isArray: false,
      }),
      zodMeta: {
        isRequired: false,
        options,
        propertyValuesIdentifier,
      },
      enumConstStatement: createPropertyValuesArray({
        identifier: propertyValuesIdentifier,
        options,
      }),
    };
  },

  multi_select: ({ camelizedName, columnValue }) => {
    const options: string[] =
      columnValue.multi_select?.options?.map((x: any) => x.name) ?? [];
    const propertyValuesIdentifier = `${toPascalCase(
      camelizedName
    )}PropertyValues`;

    return {
      tsPropertySignature: createMultiOptionProp({
        name: camelizedName,
        arrayIdentifier: propertyValuesIdentifier,
        isArray: true,
      }),
      zodMeta: {
        isRequired: false,
        options,
        propertyValuesIdentifier,
      },
      enumConstStatement: createPropertyValuesArray({
        identifier: propertyValuesIdentifier,
        options,
      }),
    };
  },

  unique_id: ({ camelizedName }) => ({
    tsPropertySignature: createTextProperty({
      name: camelizedName,
      isTitle: false,
    }),
    zodMeta: {
      isRequired: false,
    },
    enumConstStatement: undefined,
  }),

  formula: ({ camelizedName }) => ({
    tsPropertySignature: createFormulaProperty(camelizedName),
    zodMeta: { isRequired: false },
    enumConstStatement: undefined,
  }),

  rollup: ({ camelizedName, columnValue }) => {
    const rollupType = getRollupType(columnValue.rollup?.function ?? "");
    return {
      tsPropertySignature: createRollupProperty(camelizedName, rollupType),
      zodMeta: { isRequired: false, rollupType },
      enumConstStatement: undefined,
    };
  },

  relation: ({ camelizedName }) => ({
    tsPropertySignature: ts.factory.createPropertySignature(
      undefined,
      ts.factory.createIdentifier(camelizedName),
      ts.factory.createToken(ts.SyntaxKind.QuestionToken),
      ts.factory.createArrayTypeNode(
        ts.factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword)
      )
    ),
    zodMeta: { isRequired: false },
    enumConstStatement: undefined,
  }),
} as const satisfies Record<SupportedNotionColumnType, PropertyASTGenerator>;
