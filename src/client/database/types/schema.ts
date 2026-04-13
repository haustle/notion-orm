/**
 * Core schema value shapes and Notion column-type unions for database clients.
 */

import type { DataSourceObjectResponse } from "@notionhq/client/build/src/api-endpoints";

type NotionPropertyTypeToConfigMap = DataSourceObjectResponse["properties"];
export type DatabasePropertyType =
	NotionPropertyTypeToConfigMap[keyof NotionPropertyTypeToConfigMap]["type"];

/**
 * Union of all value types a database property can hold (read or write).
 * Used as the base constraint for schema generics throughout the client.
 */
export type DatabasePropertyValue =
	| string
	| number
	| boolean
	| null
	| string[]
	| { name: string; url: string }[]
	| { start: string; end?: string | null };

export type SchemaRecord = Record<string, DatabasePropertyValue>;

export type ColumnTypeMap<Schema extends SchemaRecord> = Record<
	keyof Schema,
	SupportedNotionColumnType
>;

export const SUPPORTED_PROPERTY_TYPES = {
	formula: false,
	files: true,
	people: true,
	relation: true,
	rollup: false,
	created_by: true,
	last_edited_by: true,
	created_time: true,
	last_edited_time: true,

	url: true,
	phone_number: true,
	title: true,
	email: true,
	checkbox: true,
	date: true,
	multi_select: true,
	status: true,
	number: true,
	rich_text: true,
	select: true,
	unique_id: true,
} as const satisfies Record<DatabasePropertyType, boolean>;

export function isSupportedPropertyType(
	propertyType: DatabasePropertyType,
): propertyType is SupportedNotionColumnType {
	return SUPPORTED_PROPERTY_TYPES[propertyType];
}

export type SupportedNotionColumnType = {
	[K in keyof typeof SUPPORTED_PROPERTY_TYPES]: (typeof SUPPORTED_PROPERTY_TYPES)[K] extends true
		? K
		: never;
}[keyof typeof SUPPORTED_PROPERTY_TYPES];

/** Maps ORM property names to Notion column names and property types (codegen + runtime). */
export type PropertyNameToColumnMetadataMap = Record<
	string,
	{ columnName: string; type: SupportedNotionColumnType }
>;

export type camelPropertyNameToNameAndTypeMapType =
	PropertyNameToColumnMetadataMap;
