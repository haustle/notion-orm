import { AST_RUNTIME_CONSTANTS } from "../../../ast/shared/constants";
import type {
	DatabasePropertyValue,
	Projection,
	ProjectionPropertyName,
	ProjectionSelection,
} from "../types";

export type NormalizedProjection<PropertyName extends string | number> = {
	mode: "none" | "select" | "omit";
	keys: Set<PropertyName>;
};

export function normalizeProjection<
	DatabaseSchemaType extends Record<string, DatabasePropertyValue>,
>(
	projection?: Projection<DatabaseSchemaType>,
): NormalizedProjection<ProjectionPropertyName<DatabaseSchemaType>> {
	const select = projection?.select;
	const omit = projection?.omit;
	const hasSelect = select != null && select.length > 0;
	const hasOmit = omit != null && omit.length > 0;
	if (hasSelect && hasOmit) {
		throw new Error(
			`${AST_RUNTIME_CONSTANTS.PACKAGE_LOG_PREFIX} Projection: use either select or omit, not both.`,
		);
	}
	if (hasSelect) {
		return { mode: "select", keys: new Set(select) };
	}
	if (hasOmit) {
		return { mode: "omit", keys: new Set(omit) };
	}
	return { mode: "none", keys: new Set() };
}

export function applyProjectionToRow<
	DatabaseSchemaType extends Record<string, DatabasePropertyValue>,
>(
	row: Partial<DatabaseSchemaType>,
	projection: NormalizedProjection<ProjectionPropertyName<DatabaseSchemaType>>,
): Partial<DatabaseSchemaType> {
	if (projection.mode === "select") {
		const projected: Partial<DatabaseSchemaType> = {};
		for (const key of projection.keys) {
			if (key in row) {
				projected[key] = row[key];
			}
		}
		return projected;
	}
	if (projection.mode === "omit") {
		const projected: Partial<DatabaseSchemaType> = { ...row };
		for (const key of projection.keys) {
			delete projected[key];
		}
		return projected;
	}
	return row;
}

export function applyProjection<
	DatabaseSchemaType extends Record<string, DatabasePropertyValue>,
>(
	results: Partial<DatabaseSchemaType>[],
	projection: NormalizedProjection<ProjectionPropertyName<DatabaseSchemaType>>,
): Partial<DatabaseSchemaType>[] {
	if (projection.mode === "none") {
		return results;
	}
	return results.map((row) => applyProjectionToRow(row, projection));
}
