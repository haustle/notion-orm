import type {
	FindFirstArgs,
	FindManyArgs,
	FindUniqueArgs,
	ProjectedFromArgs,
	ProjectionArgs,
	Query,
	UpdateManyArgs,
} from "../../src/client/queryTypes";
import type { Equal, Expect } from "./helpers/assert";

type BookSchema = {
	shopName: string;
	rating: number;
	hasWifi: boolean;
	neighborhood: "Downtown" | "Midtown";
	tags: string[];
};

type BookColumnTypes = {
	shopName: "title";
	rating: "number";
	hasWifi: "checkbox";
	neighborhood: "select";
	tags: "multi_select";
};

/** When `Projection` is inferred as the full `ProjectionArgs` union, row keys must stay the full schema (not `never`). */
type _projectedFromInferredUnion = Expect<
	Equal<
		keyof ProjectedFromArgs<BookSchema, ProjectionArgs<BookSchema>>,
		keyof Partial<BookSchema>
	>
>;

/** Notion `filter` / `sort` payload shape for the query transformer — not `findMany` args (`where` / `sortBy`). */
type ApiQueryFilterSortShape = Query<BookSchema, BookColumnTypes>;
type _queryShapeExists = Expect<
	ApiQueryFilterSortShape extends object ? true : false
>;
type FindManyShape = FindManyArgs<BookSchema, BookColumnTypes>;
type FindFirstShape = FindFirstArgs<BookSchema, BookColumnTypes>;
type FindUniqueShape = FindUniqueArgs<BookSchema>;
type UpdateManyShape = UpdateManyArgs<BookSchema, BookColumnTypes>;

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
	where: { id: "page-1" },
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
