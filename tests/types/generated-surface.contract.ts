import type { AgentClient } from "../../src/client/agent/AgentClient";
import type {
	DatabaseColumns,
	DatabaseDefinition,
	Query,
} from "../../src/client/database/types";
import type { Expect } from "./helpers/assert";

const columns = {
	shopName: { columnName: "Shop Name", type: "title" },
} as const satisfies DatabaseColumns;

type _queryExportContract = Expect<
	Query<DatabaseDefinition<typeof columns>> extends object ? true : false
>;

type _agentClientValueExport = Expect<
	(typeof AgentClient)["prototype"] extends object ? true : false
>;
