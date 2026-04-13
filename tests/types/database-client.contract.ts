import type { DatabaseClient } from "../../src/client/database/DatabaseClient";
import type {
	DatabaseColumns,
	DatabaseDefinition,
	InferDatabaseSchema,
	PaginateResult,
} from "../../src/client/database/types";
import type { Equal, Expect } from "./helpers/assert";
import { MOCK_PAGE_ID } from "../helpers/test-mock-ids";

const columns = {
	shopName: { columnName: "Shop Name", type: "title" },
	rating: { columnName: "Rating", type: "number" },
} as const satisfies DatabaseColumns;

type DatabaseDefinitionType = DatabaseDefinition<typeof columns>;
type Schema = InferDatabaseSchema<typeof columns>;

declare const client: DatabaseClient<DatabaseDefinitionType>;

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
	where: { id: MOCK_PAGE_ID },
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
