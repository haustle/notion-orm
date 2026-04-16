import { describe, expect, test } from "bun:test";
import { DEMO_PLAYGROUND_SPEC } from "../../src/ast/demo/demo-playground-spec";
import {
	buildDemoPlaygroundWorkspace,
	type DemoPlaygroundWorkspaceResult,
} from "../../src/ast/demo/demo-workspace-builder";
import { PLAYGROUND_PATHS } from "../../src/ast/shared/constants";
import { camelize } from "../../src/helpers";

const MOCK_PACKAGE_SOURCE = "export class DatabaseClient {}";
const MOCK_BASE_SOURCE = "export class NotionORMBase {}";
const MOCK_NOTION_ID_PATTERNS_SOURCE = `export const UNDASHED_NOTION_ID_PATTERN = /./;
export const DASHED_NOTION_ID_PATTERN = /./;
`;

function buildWorkspace(): DemoPlaygroundWorkspaceResult {
	return buildDemoPlaygroundWorkspace({
		spec: DEMO_PLAYGROUND_SPEC,
		mockPackageSource: MOCK_PACKAGE_SOURCE,
		mockBaseSource: MOCK_BASE_SOURCE,
		notionIdPatternsSource: MOCK_NOTION_ID_PATTERNS_SOURCE,
	});
}

describe("demo workspace builder", () => {
	const result = buildWorkspace();

	test("returns expected entry file names from spec", () => {
		expect(result.databaseEntryFile).toBe(
			DEMO_PLAYGROUND_SPEC.databaseEntryFile,
		);
		expect(result.agentEntryFile).toBe(DEMO_PLAYGROUND_SPEC.agentEntryFile);
		expect(result.ormAllDatabasesEntryFile).toBe(
			DEMO_PLAYGROUND_SPEC.ormAllDatabasesEntryFile,
		);
	});

	test("produces a file for every database in the spec", () => {
		for (const db of DEMO_PLAYGROUND_SPEC.databases) {
			const moduleName = camelize(db.title);
			expect(
				result.files[PLAYGROUND_PATHS.databaseModule(moduleName)],
			).toBeDefined();
		}
	});

	test("produces a file for every agent in the spec", () => {
		for (const agent of DEMO_PLAYGROUND_SPEC.agents) {
			const moduleName = camelize(agent.name);
			expect(
				result.files[PLAYGROUND_PATHS.agentModule(moduleName)],
			).toBeDefined();
		}
	});

	test("produces the generated index module", () => {
		expect(result.files[PLAYGROUND_PATHS.BUILD_INDEX]).toBeDefined();
	});

	test("index module imports use .ts extensions for VFS resolution", () => {
		const indexSource = result.files[PLAYGROUND_PATHS.BUILD_INDEX]!;
		for (const db of DEMO_PLAYGROUND_SPEC.databases) {
			const moduleName = camelize(db.title);
			expect(indexSource).toContain(
				PLAYGROUND_PATHS.databaseImport(moduleName),
			);
		}
		for (const agent of DEMO_PLAYGROUND_SPEC.agents) {
			const moduleName = camelize(agent.name);
			expect(indexSource).toContain(PLAYGROUND_PATHS.agentImport(moduleName));
		}
	});

	test("includes mock package, notion id patterns, and base files", () => {
		expect(result.files[PLAYGROUND_PATHS.MOCK_PACKAGE_INDEX]).toBe(
			MOCK_PACKAGE_SOURCE,
		);
		expect(result.files[PLAYGROUND_PATHS.MOCK_PACKAGE_NOTION_ID_PATTERNS]).toBe(
			MOCK_NOTION_ID_PATTERNS_SOURCE,
		);
		expect(result.files[PLAYGROUND_PATHS.MOCK_PACKAGE_BASE]).toBe(
			MOCK_BASE_SOURCE,
		);
	});

	test("includes tsconfig.json", () => {
		const tsconfig = JSON.parse(result.files["tsconfig.json"]!);
		expect(tsconfig.compilerOptions.strict).toBe(true);
	});

	test("database entry references the spec scenario target", () => {
		const entry = result.files[result.databaseEntryFile]!;
		expect(entry).toContain(
			`from "./${PLAYGROUND_PATHS.BUILD_INDEX_DIR}"`,
		);
		const targetModuleName = camelize(
			DEMO_PLAYGROUND_SPEC.databaseScenario.targetDatabase,
		);
		expect(entry).toContain(
			`from "./${PLAYGROUND_PATHS.databaseModule(targetModuleName)}"`,
		);
		expect(entry).toContain(`notion.databases.${targetModuleName}.create`);
		expect(entry).toContain(`notion.databases.${targetModuleName}.findMany`);
		expect(entry).toContain(`notion.databases.${targetModuleName}.count`);
	});

	test("agent entry references all scenario agents", () => {
		const entry = result.files[result.agentEntryFile]!;
		expect(entry).toContain(
			`from "./${PLAYGROUND_PATHS.BUILD_INDEX_DIR}"`,
		);
		const chatModuleName = camelize(
			DEMO_PLAYGROUND_SPEC.agentScenario.chatAgent,
		);
		const streamModuleName = camelize(
			DEMO_PLAYGROUND_SPEC.agentScenario.streamAgent,
		);
		expect(entry).toContain(`notion.agents.${chatModuleName}.chat`);
		expect(entry).toContain(`notion.agents.${streamModuleName}.chatStream`);
		expect(entry).toContain(`notion.agents.${streamModuleName}.listThreads`);
	});

	test("database entry imports property value enums from generated module", () => {
		const entry = result.files[result.databaseEntryFile]!;
		expect(entry).toContain("RatingPropertyValues");
		expect(entry).toContain("GenrePropertyValues");
	});

	test("file count matches expected total", () => {
		const expectedDatabases = DEMO_PLAYGROUND_SPEC.databases.length;
		const expectedAgents = DEMO_PLAYGROUND_SPEC.agents.length;
		const staticFiles = 8;
		expect(Object.keys(result.files).length).toBe(
			staticFiles + expectedDatabases + expectedAgents,
		);
	});

	test("ORM demo entry references the synced database client", () => {
		const entry = result.files[result.ormAllDatabasesEntryFile]!;
		expect(entry).toContain(
			`from "./${PLAYGROUND_PATHS.BUILD_INDEX_DIR}"`,
		);
		for (const db of DEMO_PLAYGROUND_SPEC.databases) {
			const moduleName = camelize(db.title);
			expect(entry).toContain(`notion.databases.${moduleName}.`);
		}
		expect(entry).toContain("export async function countRowsInDatabase");
		expect(entry).toContain("export async function findElectronicFiveStarSongs");
		expect(entry).toContain("export async function seedDemoTrack");
		expect(entry).toContain("__playgroundReferencesEveryDatabaseClient");
	});
});
