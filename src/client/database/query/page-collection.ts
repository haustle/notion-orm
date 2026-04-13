import type { Client } from "@notionhq/client";
import type { QueryDataSourceResponse } from "@notionhq/client/build/src/api-endpoints";
import type {
	DatabaseColumns,
	DatabaseDefinition,
	DatabaseSchema,
	QueryFilter,
	QuerySort,
} from "../types";
import { buildDataSourceQueryParams } from "./build-query-params";
import { isPageWithProperties, normalizePageResult } from "./normalize-page-result";

type MatchingQueryRow<Definition extends DatabaseDefinition> = {
	id: string;
	data: Partial<DatabaseSchema<Definition>>;
};

type MatchingQueryRowsPage<Definition extends DatabaseDefinition> = {
	rows: MatchingQueryRow<Definition>[];
	hasMore: boolean;
	nextCursor: string | undefined;
};

function normalizeMatchingQueryRowsWithNotionPageIds<
	Definition extends DatabaseDefinition,
>(args: {
	results: QueryDataSourceResponse["results"];
	columns: DatabaseColumns;
	validateSchema: (
		result: Partial<DatabaseSchema<Definition>>,
	) => void;
}): MatchingQueryRow<Definition>[] {
	const rows: MatchingQueryRow<Definition>[] = [];
	for (const result of args.results) {
		if (!isPageWithProperties(result)) {
			continue;
		}
		const normalizedResult = normalizePageResult<DatabaseSchema<Definition>>({
			result,
			columns: args.columns,
		});
		if (rows.length === 0) {
			args.validateSchema(normalizedResult);
		}
		rows.push({ id: result.id, data: normalizedResult });
	}
	return rows;
}

export async function findRowWithPageId<
	Definition extends DatabaseDefinition,
>(args: {
	client: Client;
	dataSourceId: string;
	columns: DatabaseColumns;
	where?: QueryFilter<Definition>;
	sortBy?: QuerySort<Definition>;
	size: number;
	after?: string;
	validateSchema: (
		result: Partial<DatabaseSchema<Definition>>,
	) => void;
}): Promise<MatchingQueryRowsPage<Definition>> {
	const params = buildDataSourceQueryParams({
		dataSourceId: args.dataSourceId,
		columns: args.columns,
		where: args.where,
		sortBy: args.sortBy,
		size: args.size,
		after: args.after,
	});
	const response = await args.client.dataSources.query(params);
	return {
		rows: normalizeMatchingQueryRowsWithNotionPageIds({
			results: response.results,
			columns: args.columns,
			validateSchema: args.validateSchema,
		}),
		hasMore: response.has_more,
		nextCursor: response.next_cursor ?? undefined,
	};
}

export async function collectPageIdsMatchingFilter<
	Definition extends DatabaseDefinition,
>(args: {
	client: Client;
	dataSourceId: string;
	columns: DatabaseColumns;
	where?: QueryFilter<Definition>;
	validateSchema: (
		result: Partial<DatabaseSchema<Definition>>,
	) => void;
}): Promise<string[]> {
	const ids: string[] = [];
	let cursor: string | undefined;
	let hasMore = true;
	let hasValidatedFirstRow = false;
	while (hasMore) {
		const response: MatchingQueryRowsPage<Definition> =
			await findRowWithPageId<Definition>({
			client: args.client,
			dataSourceId: args.dataSourceId,
			columns: args.columns,
			where: args.where,
			size: 100,
			after: cursor,
			validateSchema: hasValidatedFirstRow
				? () => {}
				: args.validateSchema,
		});
		for (const row of response.rows) {
			ids.push(row.id);
		}
		hasValidatedFirstRow ||= response.rows.length > 0;
		hasMore = response.hasMore;
		cursor = response.nextCursor;
	}
	return ids;
}

export async function findFirstQueryRowWithNotionPageId<
	Definition extends DatabaseDefinition,
>(args: {
	client: Client;
	dataSourceId: string;
	columns: DatabaseColumns;
	where?: QueryFilter<Definition>;
	sortBy?: QuerySort<Definition>;
	validateSchema: (
		result: Partial<DatabaseSchema<Definition>>,
	) => void;
}): Promise<{ id: string; data: Partial<DatabaseSchema<Definition>> } | null> {
	return (await findMatchingQueryRowsWithNotionPageIds({
		...args,
		size: 1,
	}))[0] ?? null;
}

export async function findMatchingQueryRowsWithNotionPageIds<
	Definition extends DatabaseDefinition,
>(args: {
	client: Client;
	dataSourceId: string;
	columns: DatabaseColumns;
	where?: QueryFilter<Definition>;
	sortBy?: QuerySort<Definition>;
	size: number;
	validateSchema: (
		result: Partial<DatabaseSchema<Definition>>,
	) => void;
}): Promise<Array<{ id: string; data: Partial<DatabaseSchema<Definition>> }>> {
	return (
		await findRowWithPageId({
			...args,
		})
	).rows;
}
