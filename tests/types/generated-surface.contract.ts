import type { AgentClient } from "../../src/client/agent/AgentClient";
import type { Query } from "../../src/client/database/types";
import type { Expect } from "./helpers/assert";

type _queryExportContract = Expect<
	Query<Record<string, never>, Record<string, never>> extends object
		? true
		: false
>;

type _agentClientValueExport = Expect<
	(typeof AgentClient)["prototype"] extends object ? true : false
>;
