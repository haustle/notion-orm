import { z } from "zod";
import { objectEntries } from "../../typeUtils";
import type { ColumnDefinition, DatabaseColumns } from "./types";

function toNonEmptyTuple(
	options: readonly string[],
): [string, ...string[]] | null {
	const [first, ...rest] = options;
	return first === undefined ? null : [first, ...rest];
}

function buildOptionalNullableEnum(
	column: Extract<ColumnDefinition, { type: "select" | "status" }>,
): z.ZodTypeAny {
	const options = toNonEmptyTuple(column.options);
	return options === null
		? z.string().nullable().optional()
		: z.enum(options).nullable().optional();
}

function buildOptionalNullableEnumArray(
	column: Extract<ColumnDefinition, { type: "multi_select" }>,
): z.ZodTypeAny {
	const options = toNonEmptyTuple(column.options);
	return options === null
		? z.array(z.string()).nullable().optional()
		: z.array(z.enum(options)).nullable().optional();
}

function zodForColumn(column: ColumnDefinition): z.ZodTypeAny {
	switch (column.type) {
		case "title":
			return z.string();
		case "checkbox":
			return z.boolean().optional();
		case "number":
			return z.number().nullable().optional();
		case "rich_text":
		case "email":
		case "phone_number":
		case "url":
		case "unique_id":
		case "created_by":
		case "last_edited_by":
		case "created_time":
		case "last_edited_time":
			return z.string().nullable().optional();
		case "date":
			return z
				.object({
					start: z.string(),
					end: z.string().nullable().optional(),
				})
				.nullable()
				.optional();
		case "select":
		case "status":
			return buildOptionalNullableEnum(column);
		case "multi_select":
			return buildOptionalNullableEnumArray(column);
		case "files":
			return z
				.array(
					z.object({
						name: z.string(),
						url: z.string(),
					}),
				)
				.nullable()
				.optional();
		case "people":
		case "relation":
			return z.array(z.string()).nullable().optional();
		default: {
			const _never: never = column;
			return _never;
		}
	}
}

/**
 * Rebuilds the generated database validation schema from emitted column metadata.
 * Mirrors the current codegen Zod behavior so validation semantics stay stable.
 */
export function buildZodFromColumns(
	columns: DatabaseColumns,
): z.ZodObject<Record<string, z.ZodTypeAny>> {
	const shape: Record<string, z.ZodTypeAny> = {};
	for (const [propertyName, column] of objectEntries(columns)) {
		shape[propertyName] = zodForColumn(column);
	}
	return z.object(shape);
}
