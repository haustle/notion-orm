import type { CreatePageParameters } from "@notionhq/client/build/src/api-endpoints";
import { AST_RUNTIME_CONSTANTS } from "../../../ast/shared/constants";
import type { SupportedNotionColumnType } from "../types";

type CreatePagePropertyValue = NonNullable<
	NonNullable<CreatePageParameters["properties"]>[string]
>;
type CreatePagePropertyByKey<Key extends string> = Extract<
	CreatePagePropertyValue,
	Record<Key, unknown>
>;

type AddPageValueInput =
	| string
	| number
	| boolean
	| null
	| Array<string>
	| Array<{
			name: string;
			url: string;
	  }>
	| {
			start: string;
			end?: string | null;
	  };

function describeRuntimeValue(value: unknown): string {
	if (value === null) {
		return "null";
	}

	if (Array.isArray(value)) {
		if (value.length === 0) {
			return "array (empty)";
		}
		const firstItem = value[0];
		const itemType = firstItem === null ? "null" : typeof firstItem;
		return `array<${itemType}>`;
	}

	if (typeof value === "object") {
		const keys = Object.keys(value);
		return keys.length === 0 ? "object (empty)" : `object{${keys.join(",")}}`;
	}

	return typeof value;
}

function unsupportedAddTypeError(type: SupportedNotionColumnType): Error {
	return new Error(
		`${AST_RUNTIME_CONSTANTS.PACKAGE_LOG_PREFIX} create() does not support property type '${type}'. This property type is readable in query responses but cannot be written via create().`,
	);
}

function invalidAddValueError(args: {
	type: SupportedNotionColumnType;
	value: unknown;
}): Error {
	const actual = describeRuntimeValue(args.value);
	return new Error(
		`${AST_RUNTIME_CONSTANTS.PACKAGE_LOG_PREFIX} create() received invalid value for property type '${args.type}'. Received ${actual}.`,
	);
}

function isDateAddInput(
	value: unknown,
): value is { start: string; end?: string | null } {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		return false;
	}

	if (!("start" in value) || typeof value.start !== "string") {
		return false;
	}

	if (!("end" in value)) {
		return true;
	}

	return (
		value.end === null ||
		value.end === undefined ||
		typeof value.end === "string"
	);
}

export function buildPropertyValueForAddPage(args: {
	type: SupportedNotionColumnType;
	value: AddPageValueInput | undefined;
}): CreatePagePropertyValue {
	const { type, value } = args;

	if (value === undefined) {
		throw invalidAddValueError({ type, value });
	}

	const builder = ADD_PROPERTY_BUILDERS[type];
	if (!builder) {
		throw unsupportedAddTypeError(type);
	}

	return builder(value);
}

const selectCall = (value: unknown): CreatePagePropertyByKey<"select"> => {
	if (typeof value !== "string") {
		throw invalidAddValueError({ type: "select", value });
	}
	const select = {
		name: value,
	};
	return { select };
};

const dateCall = (value: unknown): CreatePagePropertyByKey<"date"> => {
	if (!isDateAddInput(value)) {
		throw invalidAddValueError({ type: "date", value });
	}

	const normalizedDate = {
		start: value.start,
		end: value.end ?? undefined,
	};

	return { date: normalizedDate };
};
const phoneNumberCall = (
	value: unknown,
): CreatePagePropertyByKey<"phone_number"> => {
	if (typeof value !== "string") {
		throw invalidAddValueError({ type: "phone_number", value });
	}
	return { phone_number: value };
};

const statusCall = (value: unknown): CreatePagePropertyByKey<"status"> => {
	if (typeof value !== "string") {
		throw invalidAddValueError({ type: "status", value });
	}
	const status = {
		name: value,
	};
	return { status };
};

const multiSelectCall = (
	value: unknown,
): CreatePagePropertyByKey<"multi_select"> => {
	if (
		!Array.isArray(value) ||
		!value.every((item) => typeof item === "string")
	) {
		throw invalidAddValueError({ type: "multi_select", value });
	}
	const multi_select = value.map((option) => ({ name: option }));
	return { multi_select };
};

const textCall = (value: unknown): CreatePagePropertyByKey<"rich_text"> => {
	if (typeof value !== "string") {
		throw invalidAddValueError({ type: "rich_text", value });
	}
	const rich_text = [
		{
			text: {
				content: value,
			},
		},
	];

	return { rich_text };
};

const titleCall = (value: unknown): CreatePagePropertyByKey<"title"> => {
	if (typeof value !== "string") {
		throw invalidAddValueError({ type: "title", value });
	}
	const titleObject = [
		{
			text: {
				content: value,
			},
		},
	];

	return { title: titleObject };
};

const numberCall = (value: unknown): CreatePagePropertyByKey<"number"> => {
	if (typeof value !== "number") {
		throw invalidAddValueError({ type: "number", value });
	}
	return { number: value };
};

const urlCall = (value: unknown): CreatePagePropertyByKey<"url"> => {
	if (typeof value !== "string") {
		throw invalidAddValueError({ type: "url", value });
	}
	return { url: value };
};

const checkboxCall = (value: unknown): CreatePagePropertyByKey<"checkbox"> => {
	if (typeof value !== "boolean") {
		throw invalidAddValueError({ type: "checkbox", value });
	}
	return { checkbox: value };
};

const emailCall = (value: unknown): CreatePagePropertyByKey<"email"> => {
	if (typeof value !== "string") {
		throw invalidAddValueError({ type: "email", value });
	}
	return { email: value };
};

function isStringArray(value: unknown): value is string[] {
	return (
		Array.isArray(value) && value.every((item) => typeof item === "string")
	);
}

type FileAddInput = { name: string; url: string };
function isFileAddInputArray(value: unknown): value is FileAddInput[] {
	return (
		Array.isArray(value) &&
		value.every(
			(item) =>
				typeof item === "object" &&
				item !== null &&
				"name" in item &&
				typeof item.name === "string" &&
				"url" in item &&
				typeof item.url === "string",
		)
	);
}

const peopleCall = (value: unknown): CreatePagePropertyByKey<"people"> => {
	if (!isStringArray(value)) {
		throw invalidAddValueError({ type: "people", value });
	}
	return {
		people: value.map((id) => ({ id })),
	};
};

const relationCall = (value: unknown): CreatePagePropertyByKey<"relation"> => {
	if (!isStringArray(value)) {
		throw invalidAddValueError({ type: "relation", value });
	}
	return {
		relation: value.map((id) => ({ id })),
	};
};

const filesCall = (value: unknown): CreatePagePropertyByKey<"files"> => {
	if (!isFileAddInputArray(value)) {
		throw invalidAddValueError({ type: "files", value });
	}
	return {
		files: value.map((file) => ({
			name: file.name,
			type: "external",
			external: {
				url: file.url,
			},
		})),
	};
};

type AddPropertyBuilder = (value: unknown) => CreatePagePropertyValue;
const ADD_PROPERTY_BUILDERS: Record<
	SupportedNotionColumnType,
	AddPropertyBuilder | undefined
> = {
	created_by: undefined,
	last_edited_by: undefined,
	created_time: undefined,
	last_edited_time: undefined,
	files: filesCall,
	people: peopleCall,
	relation: relationCall,
	url: urlCall,
	phone_number: phoneNumberCall,
	title: titleCall,
	email: emailCall,
	checkbox: checkboxCall,
	date: dateCall,
	multi_select: multiSelectCall,
	status: statusCall,
	number: numberCall,
	rich_text: textCall,
	select: selectCall,
	unique_id: undefined,
};
