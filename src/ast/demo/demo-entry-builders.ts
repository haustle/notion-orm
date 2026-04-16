import { camelize } from "../../helpers";
import { objectEntries } from "../../typeUtils";
import { toPascalCase } from "../shared/ast-builders";
import { AST_TYPE_NAMES, PLAYGROUND_PATHS } from "../shared/constants";
import { emitDemoOrmAllDatabasesEntry } from "./emit-demo-orm-all-databases-entry";
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

/** Index of an option label in a select / multi_select / status property from the fixture spec. */
function optionIndexForSelectLikeProperty(
	spec: DemoPlaygroundSpec,
	databaseTitle: string,
	propertyName: string,
	optionLabel: string,
): number {
	const db = spec.databases.find((d) => d.title === databaseTitle);
	if (!db) {
		throw new Error(
			`buildDemoOrmAllDatabasesEntry: database "${databaseTitle}" not in spec`,
		);
	}
	const prop = db.properties[propertyName];
	if (!prop) {
		throw new Error(
			`buildDemoOrmAllDatabasesEntry: property "${propertyName}" not on "${databaseTitle}"`,
		);
	}
	if (
		prop.type !== "select" &&
		prop.type !== "multi_select" &&
		prop.type !== "status"
	) {
		throw new Error(
			`buildDemoOrmAllDatabasesEntry: "${propertyName}" is not select-like on "${databaseTitle}"`,
		);
	}
	const options = prop.options ?? [];
	const idx = options.indexOf(optionLabel);
	if (idx < 0) {
		throw new Error(
			`buildDemoOrmAllDatabasesEntry: option "${optionLabel}" not found on "${propertyName}" (${databaseTitle})`,
		);
	}
	return idx;
}

function findSelectLikeProperties(
	spec: DemoPlaygroundSpec,
	databaseTitle: string,
): string[] {
	const db = spec.databases.find((d) => d.title === databaseTitle);
	if (!db) {
		return [];
	}
	return objectEntries(db.properties)
		.filter(
			([, prop]) =>
				prop !== undefined &&
				(prop.type === "select" ||
					prop.type === "multi_select" ||
					prop.type === "status"),
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

	const enumProperties = findSelectLikeProperties(
		spec,
		scenario.targetDatabase,
	);
	const enumImports = enumProperties.map(resolvePropertyValueExportName);

	const namedImports = [
		...enumImports.map((name) => `\t${name},`),
		`\ttype CreateSchema,`,
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
const track: CreateSchema = {
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

/**
 * Builds `demo-orm-all-databases.ts`: one `NotionORM` instance and exported
 * helpers for the synced database (counts, queries, creates).
 */
export function buildDemoOrmAllDatabasesEntry(args: {
	spec: DemoPlaygroundSpec;
	databaseModules: ResolvedDatabaseModule[];
}): string {
	const { spec, databaseModules } = args;
	if (databaseModules.length < 1) {
		throw new Error(
			"buildDemoOrmAllDatabasesEntry expects at least one database in the playground spec.",
		);
	}

	const m = databaseModules[0]!;
	const createAlias = `${toPascalCase(m.moduleName)}Create`;

	const enumProps = findSelectLikeProperties(spec, m.databaseTitle);
	const enumNames = enumProps.map(resolvePropertyValueExportName);
	const resolveValueExportForProperty = (canonicalPropertyName: string) => {
		const hit = enumProps.find(
			(p) => p.toLowerCase() === canonicalPropertyName.toLowerCase(),
		);
		if (!hit) {
			throw new Error(
				`buildDemoOrmAllDatabasesEntry: no select-like property "${canonicalPropertyName}" on "${m.databaseTitle}"`,
			);
		}
		return resolvePropertyValueExportName(hit);
	};
	const genreEnum = resolveValueExportForProperty("Genre");
	const ratingEnum = resolveValueExportForProperty("Rating");

	const idxGenreElectronic = optionIndexForSelectLikeProperty(
		spec,
		m.databaseTitle,
		"Genre",
		"Electronic",
	);
	const idxGenrePop = optionIndexForSelectLikeProperty(
		spec,
		m.databaseTitle,
		"Genre",
		"Pop",
	);
	const idxRatingFiveStars = optionIndexForSelectLikeProperty(
		spec,
		m.databaseTitle,
		"Rating",
		"★★★★★",
	);
	const idxRatingFourStars = optionIndexForSelectLikeProperty(
		spec,
		m.databaseTitle,
		"Rating",
		"★★★★☆",
	);

	return emitDemoOrmAllDatabasesEntry({
		buildIndexImportPath: `./${PLAYGROUND_PATHS.BUILD_INDEX_DIR}`,
		databaseModuleRelativeImport: `./${PLAYGROUND_PATHS.databaseModule(m.moduleName)}`,
		authPlaceholder: PLAYGROUND_PATHS.DEMO_AUTH_PLACEHOLDER,
		moduleName: m.moduleName,
		databaseTitle: m.databaseTitle,
		createSchemaTypeAlias: createAlias,
		genrePropertyValuesId: genreEnum,
		ratingPropertyValuesId: ratingEnum,
		enumValueImportNames: enumNames,
		idxGenreElectronic,
		idxGenrePop,
		idxRatingFiveStars,
		idxRatingFourStars,
		allModuleNames: databaseModules.map((mod) => mod.moduleName),
	});
}
