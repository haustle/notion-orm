import type { DatabaseClient } from "../../src/client/database/DatabaseClient";
import type { PaginateResult } from "../../src/client/database/types";
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

const allRowsPromise = client.findMany();
const selectedRowsPromise = client.findMany({
	select: ["shopName"] as const,
});
const omittedRowsPromise = client.findMany({
	omit: ["rating"] as const,
});
const firstSelectedPromise = client.findFirst({
	select: ["shopName"] as const,
});
const uniqueOmittedPromise = client.findUnique({
	where: { id: "page-1" },
	omit: ["rating"] as const,
});
const paginatedSelectedPromise = client.findMany({
	after: null,
	select: ["shopName"] as const,
});

const streamIterable = client.findMany({ stream: 10 });

type AllRows = Awaited<typeof allRowsPromise>;
type SelectedRows = Awaited<typeof selectedRowsPromise>;
type OmittedRows = Awaited<typeof omittedRowsPromise>;
type FirstSelected = Awaited<typeof firstSelectedPromise>;
type UniqueOmitted = Awaited<typeof uniqueOmittedPromise>;
type PaginatedSelected = Awaited<typeof paginatedSelectedPromise>;

type StreamElement = typeof streamIterable extends AsyncIterable<infer E>
	? E
	: never;

type _allRowsContract = Expect<Equal<AllRows, Array<Partial<Schema>>>>;

type _selectedRowsContract = Expect<
	Equal<SelectedRows, Array<Partial<Pick<Schema, "shopName">>>>
>;

type _omittedRowsContract = Expect<
	Equal<OmittedRows, Array<Partial<Omit<Schema, "rating">>>>
>;

type _firstSelectedContract = Expect<
	Equal<FirstSelected, Partial<Pick<Schema, "shopName">> | null>
>;

type _uniqueOmittedContract = Expect<
	Equal<UniqueOmitted, Partial<Omit<Schema, "rating">> | null>
>;

type _paginatedSelectedContract = Expect<
	Equal<PaginatedSelected, PaginateResult<Partial<Pick<Schema, "shopName">>>>
>;

type _streamContract = Expect<Equal<StreamElement, Partial<Schema>>>;
