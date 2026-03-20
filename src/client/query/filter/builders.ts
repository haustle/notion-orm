import type {
	FilterLeafBuilder,
	FilterLeafBuilderRegistry,
	FilterValueByType,
	FilterValueGuard,
	FilterValueGuardRegistry,
} from "../types";

function isFilterOperatorObject(
	value: unknown,
): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

const isTextFilterValue: FilterValueGuard<"rich_text"> = (
	value,
): value is FilterValueByType["rich_text"] => isFilterOperatorObject(value);

const isTitleFilterValue: FilterValueGuard<"title"> = (
	value,
): value is FilterValueByType["title"] => isFilterOperatorObject(value);

const isNumberFilterValue: FilterValueGuard<"number"> = (
	value,
): value is FilterValueByType["number"] => isFilterOperatorObject(value);

const isCheckboxFilterValue: FilterValueGuard<"checkbox"> = (
	value,
): value is FilterValueByType["checkbox"] => isFilterOperatorObject(value);

const isSelectFilterValue: FilterValueGuard<"select"> = (
	value,
): value is FilterValueByType["select"] => isFilterOperatorObject(value);

const isMultiSelectFilterValue: FilterValueGuard<"multi_select"> = (
	value,
): value is FilterValueByType["multi_select"] => isFilterOperatorObject(value);

const isUrlFilterValue: FilterValueGuard<"url"> = (
	value,
): value is FilterValueByType["url"] => isFilterOperatorObject(value);

const isDateFilterValue: FilterValueGuard<"date"> = (
	value,
): value is FilterValueByType["date"] => isFilterOperatorObject(value);

const isStatusFilterValue: FilterValueGuard<"status"> = (
	value,
): value is FilterValueByType["status"] => isFilterOperatorObject(value);

const isEmailFilterValue: FilterValueGuard<"email"> = (
	value,
): value is FilterValueByType["email"] => isFilterOperatorObject(value);

const isPhoneNumberFilterValue: FilterValueGuard<"phone_number"> = (
	value,
): value is FilterValueByType["phone_number"] => isFilterOperatorObject(value);

const isFilesFilterValue: FilterValueGuard<"files"> = (
	value,
): value is FilterValueByType["files"] => isFilterOperatorObject(value);

const isPeopleFilterValue: FilterValueGuard<"people"> = (
	value,
): value is FilterValueByType["people"] => isFilterOperatorObject(value);

const isRelationFilterValue: FilterValueGuard<"relation"> = (
	value,
): value is FilterValueByType["relation"] => isFilterOperatorObject(value);

const isCreatedByFilterValue: FilterValueGuard<"created_by"> = (
	value,
): value is FilterValueByType["created_by"] => isFilterOperatorObject(value);

const isLastEditedByFilterValue: FilterValueGuard<"last_edited_by"> = (
	value,
): value is FilterValueByType["last_edited_by"] =>
	isFilterOperatorObject(value);

const isCreatedTimeFilterValue: FilterValueGuard<"created_time"> = (
	value,
): value is FilterValueByType["created_time"] => isFilterOperatorObject(value);

const isLastEditedTimeFilterValue: FilterValueGuard<"last_edited_time"> = (
	value,
): value is FilterValueByType["last_edited_time"] =>
	isFilterOperatorObject(value);

const isUniqueIdFilterValue: FilterValueGuard<"unique_id"> = (
	value,
): value is FilterValueByType["unique_id"] => isFilterOperatorObject(value);

const buildRichTextFilter: FilterLeafBuilder<"rich_text"> = (args) => ({
	property: args.columnName,
	rich_text: args.columnFilterValue,
});

const buildTitleFilter: FilterLeafBuilder<"title"> = (args) => ({
	property: args.columnName,
	title: args.columnFilterValue,
});

const buildNumberFilter: FilterLeafBuilder<"number"> = (args) => ({
	property: args.columnName,
	number: args.columnFilterValue,
});

const buildCheckboxFilter: FilterLeafBuilder<"checkbox"> = (args) => ({
	property: args.columnName,
	checkbox: args.columnFilterValue,
});

const buildSelectFilter: FilterLeafBuilder<"select"> = (args) => ({
	property: args.columnName,
	select: args.columnFilterValue,
});

const buildMultiSelectFilter: FilterLeafBuilder<"multi_select"> = (args) => ({
	property: args.columnName,
	multi_select: args.columnFilterValue,
});

const buildUrlFilter: FilterLeafBuilder<"url"> = (args) => ({
	property: args.columnName,
	url: args.columnFilterValue,
});

const buildDateFilter: FilterLeafBuilder<"date"> = (args) => ({
	property: args.columnName,
	date: args.columnFilterValue,
});

const buildStatusFilter: FilterLeafBuilder<"status"> = (args) => ({
	property: args.columnName,
	status: args.columnFilterValue,
});

const buildEmailFilter: FilterLeafBuilder<"email"> = (args) => ({
	property: args.columnName,
	email: args.columnFilterValue,
});

const buildPhoneNumberFilter: FilterLeafBuilder<"phone_number"> = (args) => ({
	property: args.columnName,
	phone_number: args.columnFilterValue,
});

const buildFilesFilter: FilterLeafBuilder<"files"> = (args) => ({
	property: args.columnName,
	files: args.columnFilterValue,
});

const buildPeopleFilter: FilterLeafBuilder<"people"> = (args) => ({
	property: args.columnName,
	people: args.columnFilterValue,
});

const buildRelationFilter: FilterLeafBuilder<"relation"> = (args) => ({
	property: args.columnName,
	relation: args.columnFilterValue,
});

const buildCreatedByFilter: FilterLeafBuilder<"created_by"> = (args) => ({
	property: args.columnName,
	created_by: args.columnFilterValue,
});

const buildLastEditedByFilter: FilterLeafBuilder<"last_edited_by"> = (
	args,
) => ({
	property: args.columnName,
	last_edited_by: args.columnFilterValue,
});

const buildCreatedTimeFilter: FilterLeafBuilder<"created_time"> = (args) => ({
	property: args.columnName,
	created_time: args.columnFilterValue,
});

const buildLastEditedTimeFilter: FilterLeafBuilder<"last_edited_time"> = (
	args,
) => ({
	property: args.columnName,
	last_edited_time: args.columnFilterValue,
});

const buildUniqueIdFilter: FilterLeafBuilder<"unique_id"> = (args) => ({
	property: args.columnName,
	unique_id: args.columnFilterValue,
});

export const filterLeafBuilders: FilterLeafBuilderRegistry = {
	rich_text: buildRichTextFilter,
	title: buildTitleFilter,
	number: buildNumberFilter,
	checkbox: buildCheckboxFilter,
	select: buildSelectFilter,
	multi_select: buildMultiSelectFilter,
	url: buildUrlFilter,
	date: buildDateFilter,
	status: buildStatusFilter,
	email: buildEmailFilter,
	phone_number: buildPhoneNumberFilter,
	files: buildFilesFilter,
	people: buildPeopleFilter,
	relation: buildRelationFilter,
	created_by: buildCreatedByFilter,
	last_edited_by: buildLastEditedByFilter,
	created_time: buildCreatedTimeFilter,
	last_edited_time: buildLastEditedTimeFilter,
	unique_id: buildUniqueIdFilter,
};

export const filterValueGuards: FilterValueGuardRegistry = {
	rich_text: isTextFilterValue,
	title: isTitleFilterValue,
	number: isNumberFilterValue,
	checkbox: isCheckboxFilterValue,
	select: isSelectFilterValue,
	multi_select: isMultiSelectFilterValue,
	url: isUrlFilterValue,
	date: isDateFilterValue,
	status: isStatusFilterValue,
	email: isEmailFilterValue,
	phone_number: isPhoneNumberFilterValue,
	files: isFilesFilterValue,
	people: isPeopleFilterValue,
	relation: isRelationFilterValue,
	created_by: isCreatedByFilterValue,
	last_edited_by: isLastEditedByFilterValue,
	created_time: isCreatedTimeFilterValue,
	last_edited_time: isLastEditedTimeFilterValue,
	unique_id: isUniqueIdFilterValue,
};
