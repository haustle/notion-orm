import type { CreatePageParameters } from "@notionhq/client/build/src/api-endpoints";
import { objectEntries } from "../../../typeUtils";
import type { PropertyNameToColumnMetadataMap } from "../types";
import type { DatabasePropertyValue } from "../types";
import { buildPropertyValueForAddPage } from "./property-value";

/**
 * Maps typed schema properties to Notion `pages.create` / `pages.update` property payloads.
 * Use `partial: true` for updates (skips `undefined` values). For creates, `undefined` is passed
 * through so unsupported values still surface validation errors from `buildPropertyValueForAddPage`.
 */
export function mapDatabaseSchemaToNotionPropertyMap<
	DatabaseSchemaType extends Record<string, DatabasePropertyValue>,
>(
	args: {
		data: DatabaseSchemaType | Partial<DatabaseSchemaType>;
		camelPropertyNameToNameAndTypeMap: PropertyNameToColumnMetadataMap;
		partial: boolean;
	},
): NonNullable<CreatePageParameters["properties"]> {
	const properties: NonNullable<CreatePageParameters["properties"]> = {};
	for (const [propertyName, value] of objectEntries(args.data)) {
		if (typeof propertyName !== "string") {
			continue;
		}
		if (args.partial && value === undefined) {
			continue;
		}
		const meta = args.camelPropertyNameToNameAndTypeMap[propertyName];
		if (!meta) {
			continue;
		}
		const columnObject = buildPropertyValueForAddPage({
			type: meta.type,
			value,
		});
		if (columnObject) {
			properties[meta.columnName] = columnObject;
		}
	}
	return properties;
}
