import type { Client } from "@notionhq/client";
import type { camelPropertyNameToNameAndTypeMapType } from "../types";
import type {
	DatabasePropertyValue,
	QueryFilter,
	SupportedNotionColumnType,
} from "../types";
import { buildQueryResponse } from "./build-query-response";
import { buildDataSourceQueryParams } from "./build-query-params";

export async function collectPageIdsMatchingFilter<
	DatabaseSchemaType extends Record<string, DatabasePropertyValue>,
	ColumnNameToColumnType extends Record<
		keyof DatabaseSchemaType,
		SupportedNotionColumnType
	>,
>(args: {
	client: Client;
	dataSourceId: string;
	camelPropertyNameToNameAndTypeMap: camelPropertyNameToNameAndTypeMapType;
	where: QueryFilter<DatabaseSchemaType, ColumnNameToColumnType>;
}): Promise<string[]> {
	const ids: string[] = [];
	let cursor: string | undefined;
	let hasMore = true;
	while (hasMore) {
		const params = buildDataSourceQueryParams({
			dataSourceId: args.dataSourceId,
			camelPropertyNameToNameAndTypeMap: args.camelPropertyNameToNameAndTypeMap,
			where: args.where,
			size: 100,
			after: cursor,
		});
		const response = await args.client.dataSources.query(params);
		for (const result of response.results) {
			if (result.object === "page" && "id" in result) {
				ids.push(result.id);
			}
		}
		hasMore = response.has_more;
		cursor = response.next_cursor ?? undefined;
	}
	return ids;
}

export async function findFirstQueryRowWithNotionPageId<
	DatabaseSchemaType extends Record<string, DatabasePropertyValue>,
	ColumnNameToColumnType extends Record<
		keyof DatabaseSchemaType,
		SupportedNotionColumnType
	>,
>(args: {
	client: Client;
	dataSourceId: string;
	camelPropertyNameToNameAndTypeMap: camelPropertyNameToNameAndTypeMapType;
	where: QueryFilter<DatabaseSchemaType, ColumnNameToColumnType>;
	validateSchema: (result: Partial<DatabaseSchemaType>) => void;
}): Promise<{ id: string; data: Partial<DatabaseSchemaType> } | null> {
	const params = buildDataSourceQueryParams({
		dataSourceId: args.dataSourceId,
		camelPropertyNameToNameAndTypeMap: args.camelPropertyNameToNameAndTypeMap,
		where: args.where,
		size: 1,
	});
	const response = await args.client.dataSources.query(params);
	const { results } = buildQueryResponse<DatabaseSchemaType>({
		response,
		columnNameToColumnProperties: args.camelPropertyNameToNameAndTypeMap,
		validateSchema: args.validateSchema,
	});
	if (results.length === 0) {
		return null;
	}
	const firstResult = response.results[0];
	if (
		!firstResult ||
		firstResult.object !== "page" ||
		!("id" in firstResult)
	) {
		return null;
	}
	return { id: firstResult.id, data: results[0] };
}
