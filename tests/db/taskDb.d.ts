import type { SupportedNotionColumnType } from "../../src/client/database/types";
import type { DatabaseClient } from "../golden/base";

type AddPropertyValue = Parameters<
	DatabaseClient<
		Record<
			string,
			string | number | boolean | string[] | { start: string; end?: string }
		>,
		Record<string, SupportedNotionColumnType>
	>["add"]
>[0]["properties"][string];

export declare const taskDb: (
	auth: string,
) => DatabaseClient<
	Record<string, AddPropertyValue>,
	Record<string, SupportedNotionColumnType>
>;
