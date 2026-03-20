import type { QueryResponseWithRawResponse } from "../../src/client/queryTypes";
import { DatabaseClient } from "../../src/client/DatabaseClient";
import type { Equal, Expect } from "./helpers/assert";

type Schema = {
	shopName: string;
	rating: number;
};

type ColumnTypes = {
	shopName: "title";
	rating: "number";
};

declare const client: DatabaseClient<Schema, ColumnTypes>;

const withRawPromise = client.query({ includeRawResponse: true });
const withoutRawPromise = client.query({});

type QueryWithRaw = Awaited<typeof withRawPromise>;
type QueryWithoutRaw = Awaited<typeof withoutRawPromise>;

type _rawResponseContract = Expect<
	Equal<QueryWithRaw, QueryResponseWithRawResponse<Schema>>
>;

type _noRawResponseContract = Expect<
	Equal<QueryWithoutRaw, { results: Partial<Schema>[] }>
>;
