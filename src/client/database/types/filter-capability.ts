/**
 * Which column types support filtering in the typed query DSL.
 */

import type { SupportedNotionColumnType } from "./schema";

export const FILTERABLE_PROPERTY_TYPES = {
	files: true,
	people: true,
	relation: true,
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
} as const satisfies Record<SupportedNotionColumnType, boolean>;

export type FilterableNotionColumnType = {
	[K in keyof typeof FILTERABLE_PROPERTY_TYPES]: (typeof FILTERABLE_PROPERTY_TYPES)[K] extends true
		? K
		: never;
}[keyof typeof FILTERABLE_PROPERTY_TYPES];

export function isFilterablePropertyType(
	propertyType: SupportedNotionColumnType,
): propertyType is FilterableNotionColumnType {
	return FILTERABLE_PROPERTY_TYPES[propertyType];
}
