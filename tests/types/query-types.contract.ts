import type { Query } from "../../src/client/queryTypes";
import type { Expect } from "./helpers/assert";

type BookSchema = {
	shopName: string;
	rating: number;
	visitStatus: "Want to Go" | "Visited";
	tags: string[];
};

type BookColumnTypes = {
	shopName: "title";
	rating: "number";
	visitStatus: "status";
	tags: "multi_select";
};

type QueryShape = Query<BookSchema, BookColumnTypes>;
type _queryShapeExists = Expect<QueryShape extends object ? true : false>;

const validQuery: QueryShape = {
	filter: {
		and: [
			{
				shopName: { contains: "Blue" },
			},
			{
				rating: { greater_than: 3 },
			},
			{
				visitStatus: { equals: "Want to Go" },
			},
			{
				tags: { contains: "quiet" },
			},
		],
	},
};

void validQuery;

const invalidNumberOperator: QueryShape = {
	filter: {
		// @ts-expect-error number properties do not support text operators
		rating: { contains: "x" },
	},
};
void invalidNumberOperator;

const invalidPropertyKey: QueryShape = {
	filter: {
		// @ts-expect-error unknown properties are not allowed
		unknownColumn: { equals: "x" },
	},
};
void invalidPropertyKey;
