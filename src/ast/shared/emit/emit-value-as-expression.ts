/**
 * Converts runtime JSON-like values into TypeScript AST expressions.
 * Used by codegen when writing literal data into emitted files.
 */

import * as ts from "typescript";

function valueToExpression(value: unknown): ts.Expression {
	if (value === null) {
		return ts.factory.createNull();
	}
	if (typeof value === "string") {
		return ts.factory.createStringLiteral(value);
	}
	if (typeof value === "number") {
		return ts.factory.createNumericLiteral(String(value));
	}
	if (typeof value === "boolean") {
		return value ? ts.factory.createTrue() : ts.factory.createFalse();
	}
	if (
		typeof value === "object" &&
		value !== null &&
		!Array.isArray(value) &&
		Object.getPrototypeOf(value) === Object.prototype
	) {
		const props = Object.entries(value).map(([key, v]) =>
			ts.factory.createPropertyAssignment(
				ts.factory.createIdentifier(key),
				valueToExpression(v),
			),
		);
		return ts.factory.createObjectLiteralExpression(props, true);
	}
	if (Array.isArray(value)) {
		return ts.factory.createArrayLiteralExpression(
			value.map((v) => valueToExpression(v)),
			true,
		);
	}
	throw new Error(`Cannot emit value as expression: ${typeof value}`);
}

/**
 * Returns a `ts.Expression` for string/number/boolean/null/array/plain-object values.
 */
export function emitValueAsExpression(value: unknown): ts.Expression {
	return valueToExpression(value);
}
