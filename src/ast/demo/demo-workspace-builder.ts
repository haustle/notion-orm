import { buildMockDataSourceResponse } from "../../../tests/helpers/datasource-fixture-builder";
import { renderAgentModule } from "../agents/agent-file-writer";
import { renderDatabaseModule } from "../database/database-file-writer";
import { AST_RUNTIME_CONSTANTS, PLAYGROUND_PATHS } from "../shared/constants";
import {
	buildOrmIndexModuleAst,
	type OrmEntityMetadata,
} from "../shared/emit/orm-index-emitter";
import { createEmitContext, printTsNodes } from "../shared/emit/ts-emit-core";
import {
	buildDemoAgentEntry,
	buildDemoDatabaseEntry,
} from "./demo-entry-builders";
import {
	DEMO_PLAYGROUND_SPEC,
	type DemoPlaygroundSpec,
} from "./demo-playground-spec";

export interface DemoPlaygroundWorkspaceResult {
	files: Record<string, string>;
	databaseEntryFile: string;
	agentEntryFile: string;
}

const PLAYGROUND_TSCONFIG = JSON.stringify(
	{
		compilerOptions: {
			target: "ES2022",
			module: "ESNext",
			moduleResolution: "bundler",
			allowImportingTsExtensions: true,
			noEmit: true,
			strict: true,
			esModuleInterop: true,
		},
	},
	null,
	2,
);

/**
 * Pure builder that produces the full demo playground virtual workspace.
 *
 * Accepts the demo spec and pre-read mock source file contents, then
 * composes the existing ORM emitters (database, agent, index) with
 * demo entry builders and static support files to produce the complete
 * file map consumed by the browser-based TypeScript environment.
 *
 * No filesystem I/O — callers provide inputs and serialize the result.
 */
export function buildDemoPlaygroundWorkspace(args: {
	spec?: DemoPlaygroundSpec;
	mockPackageSource: string;
	mockBaseSource: string;
	/** Same source as repo `src/notion-id-patterns.ts` (playground mock imports it). */
	notionIdPatternsSource: string;
}): DemoPlaygroundWorkspaceResult {
	const {
		spec = DEMO_PLAYGROUND_SPEC,
		mockPackageSource,
		mockBaseSource,
		notionIdPatternsSource,
	} = args;

	const databaseModules = spec.databases.map((fixture) =>
		renderDatabaseModule(buildMockDataSourceResponse(fixture)),
	);
	const agentModules = spec.agents.map((agent) =>
		renderAgentModule({
			agentId: agent.id,
			agentName: agent.name,
			agentIcon: agent.icon,
		}),
	);

	const databaseMetadata: OrmEntityMetadata[] = databaseModules.map(
		(database) => ({ name: database.databaseModuleName }),
	);
	const agentMetadata: OrmEntityMetadata[] = agentModules.map((agent) => ({
		name: agent.agentModuleName,
	}));

	const generatedIndexTs = printTsNodes({
		nodes: buildOrmIndexModuleAst({
			databases: databaseMetadata,
			agents: agentMetadata,
			syncCommand: AST_RUNTIME_CONSTANTS.CLI_GENERATE_COMMAND,
			importPaths: {
				databaseClass: PLAYGROUND_PATHS.databaseImport,
				agentClass: PLAYGROUND_PATHS.agentImport,
			},
		}),
		context: createEmitContext({ fileName: "index.ts" }),
	});

	const databaseEntry = buildDemoDatabaseEntry({
		spec,
		databaseModules: databaseModules.map((m) => ({
			moduleName: m.databaseModuleName,
			databaseTitle: m.databaseName,
		})),
	});

	const agentEntry = buildDemoAgentEntry({
		spec,
		agentModules: agentModules.map((m) => ({
			moduleName: m.agentModuleName,
			agentName: m.agentName,
		})),
	});

	const files: Record<string, string> = {
		[spec.databaseEntryFile]: databaseEntry,
		[spec.agentEntryFile]: agentEntry,
		[PLAYGROUND_PATHS.BUILD_INDEX]: generatedIndexTs,
		[PLAYGROUND_PATHS.MOCK_PACKAGE_INDEX]: mockPackageSource,
		[PLAYGROUND_PATHS.MOCK_PACKAGE_NOTION_ID_PATTERNS]: notionIdPatternsSource,
		[PLAYGROUND_PATHS.MOCK_PACKAGE_BASE]: mockBaseSource,
	};

	for (const database of databaseModules) {
		files[PLAYGROUND_PATHS.databaseModule(database.databaseModuleName)] =
			database.tsCode;
	}
	for (const agent of agentModules) {
		files[PLAYGROUND_PATHS.agentModule(agent.agentModuleName)] = agent.tsCode;
	}

	files["tsconfig.json"] = PLAYGROUND_TSCONFIG;

	return {
		files,
		databaseEntryFile: spec.databaseEntryFile,
		agentEntryFile: spec.agentEntryFile,
	};
}
