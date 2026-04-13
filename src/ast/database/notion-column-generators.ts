/**
 * Column property generators for Notion database properties.
 * Maps Notion property types to AST generators that create TypeScript types and Zod schemas.
 */

import type { DataSourceObjectResponse } from "@notionhq/client/build/src/api-endpoints.js";
import * as ts from "typescript";
import type { SupportedNotionColumnType } from "../../client/database/types";
import {
	createCheckboxProperty,
	createDateProperty,
	createMultiOptionProp,
	createNumberProperty,
	createPropertyValuesArray,
	createTextProperty,
	toPascalCase,
} from "../shared/ast-builders";
import type { ZodMetadata } from "./zod-schema";

export interface PropertyASTResult {
	tsPropertySignature: ts.TypeElement;
	zodMeta: Omit<ZodMetadata, "propName" | "columnName" | "type">;
	enumConstStatement?: ts.Statement;
}

export interface PropertyASTContext {
		columnName: string;
		camelizedName: string;
		columnValue: SupportedNotionProperty;
	}

/**
 * Per-property generator contract:
 * produce TS property AST and metadata needed to later build the Zod schema.
 */
export type PropertyASTGenerator = (
	context: PropertyASTContext,
) => PropertyASTResult | null;

/**
 * Typed Notion property union constrained to ORM-supported column types.
 */
export type SupportedNotionProperty = Extract<
	DataSourceObjectResponse["properties"][string],
	{ type: SupportedNotionColumnType }
>;

type SelectProperty = Extract<SupportedNotionProperty, { type: "select" }>;
type StatusProperty = Extract<SupportedNotionProperty, { type: "status" }>;
type MultiSelectProperty = Extract<
	SupportedNotionProperty,
	{ type: "multi_select" }
>;

/**
 * Normalizes option extraction across select-like Notion property variants.
 */
function extractOptionNames(args: {
	columnValue: SelectProperty | StatusProperty | MultiSelectProperty;
}): string[] {
	const { columnValue } = args;
	switch (columnValue.type) {
		case "select":
			return columnValue.select.options.map((option) => option.name);
		case "status":
			return columnValue.status.options.map((option) => option.name);
		case "multi_select":
			return columnValue.multi_select.options.map((option) => option.name);
	}
}

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
		if (columnValue.type !== "select") {
			return null;
		}
		const options = extractOptionNames({ columnValue });
		const propertyValuesIdentifier = `${toPascalCase(
			camelizedName,
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
		if (columnValue.type !== "status") {
			return null;
		}
		const options = extractOptionNames({ columnValue });
		const propertyValuesIdentifier = `${toPascalCase(
			camelizedName,
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
		if (columnValue.type !== "multi_select") {
			return null;
		}
		const options = extractOptionNames({ columnValue });
		const propertyValuesIdentifier = `${toPascalCase(
			camelizedName,
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

	files: ({ camelizedName }) => ({
		tsPropertySignature: createFilesProperty(camelizedName),
		zodMeta: {
			isRequired: false,
		},
		enumConstStatement: undefined,
	}),

	people: ({ camelizedName }) => ({
		tsPropertySignature: createStringArrayProperty(camelizedName),
		zodMeta: {
			isRequired: false,
		},
		enumConstStatement: undefined,
	}),

	relation: ({ camelizedName }) => ({
		tsPropertySignature: createStringArrayProperty(camelizedName),
		zodMeta: {
			isRequired: false,
		},
		enumConstStatement: undefined,
	}),

	created_by: ({ camelizedName }) => ({
		tsPropertySignature: createTextProperty({
			name: camelizedName,
			isTitle: false,
		}),
		zodMeta: {
			isRequired: false,
		},
		enumConstStatement: undefined,
	}),

	last_edited_by: ({ camelizedName }) => ({
		tsPropertySignature: createTextProperty({
			name: camelizedName,
			isTitle: false,
		}),
		zodMeta: {
			isRequired: false,
		},
		enumConstStatement: undefined,
	}),

	created_time: ({ camelizedName }) => ({
		tsPropertySignature: createTextProperty({
			name: camelizedName,
			isTitle: false,
		}),
		zodMeta: {
			isRequired: false,
		},
		enumConstStatement: undefined,
	}),

	last_edited_time: ({ camelizedName }) => ({
		tsPropertySignature: createTextProperty({
			name: camelizedName,
			isTitle: false,
		}),
		zodMeta: {
			isRequired: false,
		},
		enumConstStatement: undefined,
	}),

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
} as const satisfies Record<SupportedNotionColumnType, PropertyASTGenerator>;

/**
 * Builds `name?: string[]` property signatures (people/relation columns).
 */
function createStringArrayProperty(name: string): ts.TypeElement {
	return ts.factory.createPropertySignature(
		undefined,
		ts.factory.createIdentifier(name),
		ts.factory.createToken(ts.SyntaxKind.QuestionToken),
		ts.factory.createArrayTypeNode(
			ts.factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword),
		),
	);
}

/**
 * Builds `name?: Array<{ name: string; url: string }>` for files columns.
 */
function createFilesProperty(name: string): ts.TypeElement {
	const fileObjectType = ts.factory.createTypeLiteralNode([
		ts.factory.createPropertySignature(
			undefined,
			ts.factory.createIdentifier("name"),
			undefined,
			ts.factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword),
		),
		ts.factory.createPropertySignature(
			undefined,
			ts.factory.createIdentifier("url"),
			undefined,
			ts.factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword),
		),
	]);

	return ts.factory.createPropertySignature(
		undefined,
		ts.factory.createIdentifier(name),
		ts.factory.createToken(ts.SyntaxKind.QuestionToken),
		ts.factory.createArrayTypeNode(fileObjectType),
	);
}

