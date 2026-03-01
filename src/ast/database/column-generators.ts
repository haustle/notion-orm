/**
 * Column property generators for Notion database properties.
 * Maps Notion property types to AST generators that create TypeScript types and Zod schemas.
 */

import * as ts from "typescript";
import type { SupportedNotionColumnType } from "../../client/queryTypes";
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
	columnValue: any;
}

export type PropertyASTGenerator = (
	context: PropertyASTContext,
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
		const options: string[] =
			columnValue.status?.options?.map((x: any) => x.name) ?? [];
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
		const options: string[] =
			columnValue.multi_select?.options?.map((x: any) => x.name) ?? [];
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

	formula: ({ camelizedName }) => ({
		tsPropertySignature: createFormulaProperty(camelizedName),
		zodMeta: {
			isRequired: false,
		},
		enumConstStatement: undefined,
	}),

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

function createFormulaProperty(name: string): ts.TypeElement {
	const dateType = ts.factory.createTypeLiteralNode([
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
	]);

	return ts.factory.createPropertySignature(
		undefined,
		ts.factory.createIdentifier(name),
		ts.factory.createToken(ts.SyntaxKind.QuestionToken),
		ts.factory.createUnionTypeNode([
			ts.factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword),
			ts.factory.createKeywordTypeNode(ts.SyntaxKind.NumberKeyword),
			ts.factory.createKeywordTypeNode(ts.SyntaxKind.BooleanKeyword),
			dateType,
			ts.factory.createLiteralTypeNode(ts.factory.createNull()),
		]),
	);
}
