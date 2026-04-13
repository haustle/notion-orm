/**
 * Core schema value shapes and Notion column-type unions for database clients.
 */

import type { DataSourceObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import type { Simplify } from "../../../typeUtils";

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
	| undefined
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

/**
 * Notion column types whose generated `columns` metadata includes a fixed
 * `options` list (select-like properties).
 */
export type ColumnTypesWithOptions = Extract<
	SupportedNotionColumnType,
	"select" | "status" | "multi_select"
>;

/** Runtime narrow for select / status / multi_select column metadata. */
export function isColumnTypesWithOptions(
	type: SupportedNotionColumnType,
): type is ColumnTypesWithOptions {
	switch (type) {
		case "select":
		case "status":
		case "multi_select":
			return true;
		default:
			return false;
	}
}

/** Shared fields for every emitted `columns` entry. */
export type ColumnDefinitionBase = {
	readonly columnName: string;
};

export type SelectColumnDefinition = ColumnDefinitionBase & {
	readonly type: "select";
	readonly options: readonly string[];
};

export type StatusColumnDefinition = ColumnDefinitionBase & {
	readonly type: "status";
	readonly options: readonly string[];
};

export type MultiSelectColumnDefinition = ColumnDefinitionBase & {
	readonly type: "multi_select";
	readonly options: readonly string[];
};

/**
 * Relation columns: Notion exposes the linked database id on the property config;
 * codegen emits it as `relatedDatabaseId` (canonical undashed id) for cross-database typing.
 */
export type RelationColumnDefinition = ColumnDefinitionBase & {
	readonly type: "relation";
	readonly relatedDatabaseId: string;
};

/**
 * Maps each supported Notion property type to its emitted `columns` metadata shape.
 * Select-like types use dedicated definitions with `options`; relation includes
 * `relatedDatabaseId`; all others are plain `{ columnName, type }` entries keyed by the
 * exact Notion `type` string.
 *
 * Adding a new `SupportedNotionColumnType` forces an entry here (via `Exclude` / intersection).
 */
export type NotionPropertyTypeToColumnDefinitionMap = {
	[K in Exclude<
		SupportedNotionColumnType,
		ColumnTypesWithOptions | "relation"
	>]: ColumnDefinitionBase & {
		readonly type: K;
	};
} & {
	select: SelectColumnDefinition;
	status: StatusColumnDefinition;
	multi_select: MultiSelectColumnDefinition;
	relation: RelationColumnDefinition;
};

/**
 * Column metadata for types that do not carry a fixed `options` list.
 */
export type PlainColumnDefinition =
	NotionPropertyTypeToColumnDefinitionMap[Exclude<
		SupportedNotionColumnType,
		ColumnTypesWithOptions
	>];

/**
 * Definition for one generated Notion column in the emitted `columns` object.
 */
export type ColumnDefinition =
	NotionPropertyTypeToColumnDefinitionMap[SupportedNotionColumnType];

/** The full generated `columns` object keyed by ORM property name. */
export type DatabaseColumns = Record<string, ColumnDefinition>;

/**
 * Base value mapping for each supported Notion column type.
 * Extending Record<SupportedNotionColumnType, ...> forces a decision for new SDK types.
 */
export interface NotionTypeToValueMap
	extends Record<SupportedNotionColumnType, DatabasePropertyValue> {
	checkbox: boolean;
	number: number;
	date: { start: string; end?: string };
	files: { name: string; url: string }[];
	people: string[];
	relation: string[];
	multi_select: string[];
	select: string;
	status: string;
	title: string;
	rich_text: string;
	url: string;
	email: string;
	phone_number: string;
	unique_id: string;
	created_by: string;
	last_edited_by: string;
	created_time: string;
	last_edited_time: string;
}

type InferColumnValue<Column extends ColumnDefinition> =
	Column extends {
		type: "multi_select";
		options: infer Options extends readonly string[];
	}
		? Array<Options[number] | (string & {})>
		: Column extends {
					type: "select" | "status";
					options: infer Options extends readonly string[];
			  }
			? Options[number] | (string & {})
			: Column extends { type: infer Type extends SupportedNotionColumnType }
				? NotionTypeToValueMap[Type]
				: never;

/** Derives the typed row shape directly from a generated `columns` object. */
export type InferDatabaseSchema<Columns extends DatabaseColumns> = Simplify<
	{
		[Property in keyof Columns as Columns[Property]["type"] extends "title"
			? Property
			: never]: InferColumnValue<Columns[Property]>;
	} & {
		[Property in keyof Columns as Columns[Property]["type"] extends "title"
			? never
			: Property]?: InferColumnValue<Columns[Property]>;
	}
>;

/** Bundles the row shape and property -> column-type map for one database. */
export interface DatabaseDefinition<
	Columns extends DatabaseColumns = DatabaseColumns,
> {
	/** The typed row shape exposed by the client for this database. */
	schema: InferDatabaseSchema<Columns>;
	/** The property -> Notion column type lookup derived from `columns`. */
	columns: {
		[Property in keyof Columns]: Columns[Property]["type"];
	};
}

/** Extracts the row shape from a `DatabaseDefinition`. */
export type DatabaseSchema<
	Definition extends DatabaseDefinition,
> = Definition["schema"];
/** Extracts the property -> column-type map from a `DatabaseDefinition`. */
export type DatabaseColumnTypes<
	Definition extends DatabaseDefinition,
> = Definition["columns"];

/** @deprecated Use `DatabaseColumns` instead. */
export type PropertyNameToColumnMetadataMap = DatabaseColumns;

/** @deprecated Use `DatabaseColumns` instead. */
export type camelPropertyNameToNameAndTypeMapType = DatabaseColumns;
