import { camelize } from "../../helpers";
import { toPascalCase } from "../shared/ast-builders";
import { AST_TYPE_NAMES, PLAYGROUND_PATHS } from "../shared/constants";
import type { DemoPlaygroundSpec } from "./demo-playground-spec";

interface ResolvedDatabaseModule {
	moduleName: string;
	databaseTitle: string;
}

interface ResolvedAgentModule {
	moduleName: string;
	agentName: string;
}

function resolvePropertyValueExportName(propertyName: string): string {
	return `${toPascalCase(camelize(propertyName))}${AST_TYPE_NAMES.PROPERTY_VALUES_SUFFIX}`;
}

function findSelectLikeProperties(
	spec: DemoPlaygroundSpec,
	databaseTitle: string,
): string[] {
	const db = spec.databases.find((d) => d.title === databaseTitle);
	if (!db) {
		return [];
	}
	return Object.entries(db.properties)
		.filter(
			([, prop]) =>
				prop.type === "select" ||
				prop.type === "multi_select" ||
				prop.type === "status",
		)
		.map(([name]) => name);
}

/**
 * Builds the `demo-databases.ts` editor entry source from the spec.
 * All identifiers (module name, schema type, property value enums)
 * are derived from the spec rather than hardcoded.
 */
export function buildDemoDatabaseEntry(args: {
	spec: DemoPlaygroundSpec;
	databaseModules: ResolvedDatabaseModule[];
}): string {
	const { spec, databaseModules } = args;
	const scenario = spec.databaseScenario;
	const targetModule = databaseModules.find(
		(m) => m.databaseTitle === scenario.targetDatabase,
	);
	if (!targetModule) {
		throw new Error(
			`Demo database scenario references "${scenario.targetDatabase}" but no matching module was generated.`,
		);
	}
	const { moduleName } = targetModule;
	const schemaTypeName = `${moduleName}Schema`;

	const enumProperties = findSelectLikeProperties(
		spec,
		scenario.targetDatabase,
	);
	const enumImports = enumProperties.map(resolvePropertyValueExportName);

	const namedImports = [
		...enumImports.map((name) => `\t${name},`),
		`\ttype ${schemaTypeName},`,
	].join("\n");

	const schemaEntries = Object.entries(scenario.create.schemaLiteral)
		.map(([key, value]) => `\t${key}: ${value},`)
		.join("\n");

	const whereEntries = Object.entries(scenario.findMany.where)
		.map(([key, filter]) => {
			const filterEntries = Object.entries(filter)
				.map(([op, val]) => `${op}: ${val}`)
				.join(", ");
			return `\t\t${key}: { ${filterEntries} },`;
		})
		.join("\n");

	const sortEntries = scenario.findMany.sortBy
		.map((s) => `{ property: "${s.property}", direction: "${s.direction}" }`)
		.join(", ");

	const countWhereEntries = Object.entries(scenario.count.where)
		.map(([key, filter]) => {
			const filterEntries = Object.entries(filter)
				.map(([op, val]) => `${op}: ${val}`)
				.join(", ");
			return `\t\t${key}: { ${filterEntries} },`;
		})
		.join("\n");

	const iconLiteral = scenario.create.icon
		? `\ticon: { type: "emoji", emoji: "${scenario.create.icon.emoji}" },\n`
		: "";

	return `import { NotionORM } from "./${PLAYGROUND_PATHS.BUILD_INDEX_DIR}";

import {
${namedImports}
} from "./${PLAYGROUND_PATHS.databaseModule(moduleName)}";

const notion = new NotionORM({ auth: "${PLAYGROUND_PATHS.DEMO_AUTH_PLACEHOLDER}" });

// create — row + icon
const track: ${schemaTypeName} = {
${schemaEntries}
};
const created = await notion.databases.${moduleName}.create({
\tproperties: track,
${iconLiteral}});
const { id: newPageId } = created;

// findMany — filter + sort
const rows = await notion.databases.${moduleName}.findMany({
\twhere: {
${whereEntries}
\t},
\tsortBy: [${sortEntries}],
});

// count — filter
const total = await notion.databases.${moduleName}.count({
\twhere: {
${countWhereEntries}
\t},
});
`;
}

/**
 * Builds the `demo-agents.ts` editor entry source from the spec.
 * Agent module names are derived from agent fixture names.
 */
export function buildDemoAgentEntry(args: {
	spec: DemoPlaygroundSpec;
	agentModules: ResolvedAgentModule[];
}): string {
	const { spec, agentModules } = args;
	const scenario = spec.agentScenario;

	const chatModule = agentModules.find(
		(m) => m.agentName === scenario.chatAgent,
	);
	const streamModule = agentModules.find(
		(m) => m.agentName === scenario.streamAgent,
	);
	if (!chatModule || !streamModule) {
		throw new Error(
			`Demo agent scenario references agents not found in spec: chat="${scenario.chatAgent}", stream="${scenario.streamAgent}"`,
		);
	}

	return `import { NotionORM } from "./${PLAYGROUND_PATHS.BUILD_INDEX_DIR}";

const notion = new NotionORM({ auth: "${PLAYGROUND_PATHS.DEMO_AUTH_PLACEHOLDER}" });

// chat + thread meta
const chatStarted = await notion.agents.${chatModule.moduleName}.chat({
\tmessage: "${scenario.chatMessage}",
});
const { threadId: chatThreadId, isNewChat, status: chatStatus } = chatStarted;

const thread = await notion.agents.${chatModule.moduleName}.getThreadInfo("mock-thread-id");
const { title, status } = thread;

// list, stream, poll
const threads = await notion.agents.${streamModule.moduleName}.listThreads();

const streamResult = await notion.agents.${streamModule.moduleName}.chatStream({
\tmessage: "${scenario.streamMessage}",
\tonMessage: () => {},
});
const { threadId: streamThreadId, agentId } = streamResult;

const polled = await notion.agents.${streamModule.moduleName}.pollThread("mock-thread-id");
const { threadId: polledThreadId, status: pollStatus } = polled;
`;
}
