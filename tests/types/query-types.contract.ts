import type {
	DatabaseColumns,
	DatabaseDefinition,
	FindFirst,
	FindMany,
	FindUnique,
	InferDatabaseSchema,
	Projection,
	Query,
	ResultProjection,
	UpdateMany,
} from "../../src/client/database/types";
import type { Equal, Expect } from "./helpers/assert";
import { MOCK_PAGE_ID } from "../helpers/test-mock-ids";

const NeighborhoodOptions = ["Downtown", "Midtown"] as const;
const TagOptions = ["quiet", "outdoor", "study"] as const;

const bookColumns = {
	shopName: { columnName: "Shop Name", type: "title" },
	rating: { columnName: "Rating", type: "number" },
	hasWifi: { columnName: "Has Wifi", type: "checkbox" },
	neighborhood: {
		columnName: "Neighborhood",
		type: "select",
		options: NeighborhoodOptions,
	},
	tags: {
		columnName: "Tags",
		type: "multi_select",
		options: TagOptions,
	},
} as const satisfies DatabaseColumns;

type BookDefinition = DatabaseDefinition<typeof bookColumns>;
type BookSchema = InferDatabaseSchema<typeof bookColumns>;

/** When `Projection` is inferred as the full projection union, row keys must stay the full schema (not `never`). */
type _resultProjectionInferredUnion = Expect<
	Equal<
		keyof ResultProjection<BookSchema, Projection<BookSchema>>,
		keyof Partial<BookSchema>
	>
>;

/** Notion `filter` / `sort` payload shape for the query transformer — not `findMany` args (`where` / `sortBy`). */
type ApiQueryFilterSortShape = Query<BookDefinition>;
type _queryShapeExists = Expect<
	ApiQueryFilterSortShape extends object ? true : false
>;
type FindManyShape = FindMany<BookDefinition>;
type FindFirstShape = FindFirst<BookDefinition>;
type FindUniqueShape = FindUnique<BookSchema>;
type UpdateManyShape = UpdateMany<BookDefinition>;

const validQuery: ApiQueryFilterSortShape = {
	filter: {
		and: [
			{
				shopName: { contains: "Blue" },
			},
			{
				rating: { greater_than: 3 },
			},
			{
				hasWifi: { equals: true },
			},
			{
				neighborhood: { equals: "Downtown" },
			},
			{
				tags: { contains: "quiet" },
			},
		],
	},
};

void validQuery;

const validSortedQuery: ApiQueryFilterSortShape = {
	sort: [
		{ property: "rating", direction: "descending" },
		{ timestamp: "created_time", direction: "ascending" },
	],
};
void validSortedQuery;

const invalidNumberOperator: ApiQueryFilterSortShape = {
	filter: {
		// @ts-expect-error number properties do not support text operators
		rating: { contains: "x" },
	},
};
void invalidNumberOperator;

const invalidPropertyKey: ApiQueryFilterSortShape = {
	filter: {
		// @ts-expect-error unknown properties are not allowed
		unknownColumn: { equals: "x" },
	},
};
void invalidPropertyKey;

const invalidSortProperty: ApiQueryFilterSortShape = {
	sort: [
		// @ts-expect-error invalid sort key
		{ property: "Rating", direction: "ascending" },
	],
};
void invalidSortProperty;

const validFindManyProjection: FindManyShape = {
	select: ["shopName", "rating"] as const,
};
void validFindManyProjection;

const validFindFirstProjection: FindFirstShape = {
	omit: ["tags"] as const,
};
void validFindFirstProjection;

const validFindUniqueProjection: FindUniqueShape = {
	where: { id: MOCK_PAGE_ID },
	select: ["shopName"] as const,
};
void validFindUniqueProjection;

const invalidFindManyProjectionKey: FindManyShape = {
	// @ts-expect-error invalid projection key
	select: ["missingColumn"],
};
void invalidFindManyProjectionKey;

const validUpdateManyWhere: UpdateManyShape = {
	properties: { rating: 5 },
	where: {
		hasWifi: { equals: true },
		neighborhood: { equals: "Downtown" },
	},
};
void validUpdateManyWhere;

const invalidCheckboxTextOperator: UpdateManyShape = {
	properties: { rating: 4 },
	where: {
		// @ts-expect-error invalid checkbox filter
		hasWifi: { contains: "true" },
	},
};
void invalidCheckboxTextOperator;

const invalidSelectBooleanValue: UpdateManyShape = {
	properties: { rating: 3 },
	where: {
		// @ts-expect-error invalid select filter value
		neighborhood: { equals: true },
	},
};
void invalidSelectBooleanValue;
