/**
 * User-facing `where` filter tree (single properties + compound and/or).
 */

import type { FilterOptions } from "./notion-filter-model";
import type {
	ColumnTypeMap,
	SchemaRecord,
	SupportedNotionColumnType,
} from "./schema";

type FilterValueForColumnType<
	PropertyValue,
	ColumnType extends SupportedNotionColumnType,
> = Partial<FilterOptions<NonNullable<PropertyValue>>[ColumnType]>;

type FilterValueForProperty<
	Schema extends SchemaRecord,
	ColumnNameToColumnType extends ColumnTypeMap<Schema>,
	PropertyName extends keyof Schema,
> = FilterValueForColumnType<
	Schema[PropertyName],
	ColumnNameToColumnType[PropertyName]
>;

export type SingleFilter<
	Schema extends SchemaRecord,
	ColumnNameToColumnType extends ColumnTypeMap<Schema>,
> = {
	[PropertyName in keyof Schema]?: FilterValueForProperty<
		Schema,
		ColumnNameToColumnType,
		PropertyName
	>;
};

export type CompoundFilters<
	Schema extends SchemaRecord,
	ColumnNameToColumnType extends ColumnTypeMap<Schema>,
> =
	| {
			and: Array<
				| SingleFilter<Schema, ColumnNameToColumnType>
				| CompoundFilters<Schema, ColumnNameToColumnType>
			>;
	  }
	| {
			or: Array<
				| SingleFilter<Schema, ColumnNameToColumnType>
				| CompoundFilters<Schema, ColumnNameToColumnType>
			>;
	  };

export type QueryFilter<
	Schema extends SchemaRecord,
	ColumnNameToColumnType extends ColumnTypeMap<Schema>,
> =
	| SingleFilter<Schema, ColumnNameToColumnType>
	| CompoundFilters<Schema, ColumnNameToColumnType>;
