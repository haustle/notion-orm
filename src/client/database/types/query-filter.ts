/**
 * User-facing `where` filter tree (single properties + compound and/or).
 */

import type { FilterOptions } from "./notion-filter-model";
import type {
	DatabaseColumnTypes,
	DatabaseDefinition,
	DatabaseSchema,
	SupportedNotionColumnType,
} from "./schema";

type FilterValueForColumnType<
	PropertyValue,
	ColumnType extends SupportedNotionColumnType,
> = Partial<FilterOptions<NonNullable<PropertyValue>>[ColumnType]>;

type DatabaseDefinitionPropertyName<
	Definition extends DatabaseDefinition,
> = Extract<
	keyof DatabaseSchema<Definition>,
	keyof DatabaseColumnTypes<Definition>
>;

type FilterValueForProperty<
	Definition extends DatabaseDefinition,
	PropertyName extends DatabaseDefinitionPropertyName<Definition>,
> = FilterValueForColumnType<
	DatabaseSchema<Definition>[PropertyName],
	DatabaseColumnTypes<Definition>[PropertyName]
>;

export type SingleFilter<Definition extends DatabaseDefinition> = {
	[PropertyName in DatabaseDefinitionPropertyName<Definition>]?: FilterValueForProperty<
		Definition,
		PropertyName
	>;
};

export type CompoundFilters<Definition extends DatabaseDefinition> =
	| {
			and: Array<
				| SingleFilter<Definition>
				| CompoundFilters<Definition>
			>;
	  }
	| {
			or: Array<
				| SingleFilter<Definition>
				| CompoundFilters<Definition>
			>;
	  };

export type QueryFilter<Definition extends DatabaseDefinition> =
	| SingleFilter<Definition>
	| CompoundFilters<Definition>;
