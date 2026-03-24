import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import * as ts from "typescript";
import { pathToFileURL } from "url";
import {
	buildOrmIndexDeclarationAst,
	buildOrmIndexModuleAst,
	emitOrmIndexArtifacts,
	type OrmEntityMetadata,
} from "../../src/ast/shared/emit/orm-index-emitter";
import {
	createEmitContext,
	printTsNodes,
} from "../../src/ast/shared/emit/ts-emit-core";
import {
	CODEGEN_EMIT_PATHS,
	CODEGEN_GOLDEN_FILES,
} from "../helpers/codegen-file-names";
import { ORM_INDEX_SCENARIO } from "../helpers/codegen-test-data";
import {
	expectNormalizedCodeToMatch,
	readGolden,
} from "../helpers/golden-code-assertions";
import {
	cleanupTempWorkspaces,
	createTempWorkspace,
} from "../helpers/temp-workspace";

const metadata: {
	databases: OrmEntityMetadata[];
	agents: OrmEntityMetadata[];
} = {
	databases: [...ORM_INDEX_SCENARIO.databases],
	agents: [...ORM_INDEX_SCENARIO.agents],
};

type RuntimeNotionOrmInstance = {
	databases: { taskDb: { kind: string; auth: string } };
	agents: { mealAgent: { kind: string; auth: string } };
};

type RuntimeNotionOrmConstructor = new (config: {
	auth: string;
}) => RuntimeNotionOrmInstance;

function isRuntimeNotionOrmConstructor(
	value: unknown,
): value is RuntimeNotionOrmConstructor {
	return typeof value === "function";
}

afterEach(() => {
	cleanupTempWorkspaces();
});

describe("orm index emitter", () => {
	test("emits declaration source that matches the orm-index golden file", () => {
		const nodes = buildOrmIndexDeclarationAst(metadata);
		const renderedCode = printTsNodes({
			nodes,
			context: createEmitContext({ fileName: CODEGEN_EMIT_PATHS.indexDts }),
		});
		const goldenCode = readGolden(CODEGEN_GOLDEN_FILES.ormIndexDeclaration);
		expectNormalizedCodeToMatch({ actual: renderedCode, expected: goldenCode });
	});

	test("builds runtime AST containing a NotionORM class declaration", () => {
		const nodes = buildOrmIndexModuleAst({
			...metadata,
			syncCommand: "notion sync",
		});
		const classDeclaration = nodes.find((node) => ts.isClassDeclaration(node));
		expect(classDeclaration).toBeDefined();
		expect(classDeclaration?.kind).toBe(ts.SyntaxKind.ClassDeclaration);
	});

	test("emits runtime index that executes and wires databases/agents", async () => {
		const tempDirectory = createTempWorkspace("orm-index-");
		const srcDirectory = join(tempDirectory, CODEGEN_EMIT_PATHS.srcDir);
		const dbDirectory = join(tempDirectory, CODEGEN_EMIT_PATHS.dbDir);
		const agentsDirectory = join(tempDirectory, CODEGEN_EMIT_PATHS.agentsDir);
		mkdirSync(srcDirectory, { recursive: true });
		mkdirSync(dbDirectory, { recursive: true });
		mkdirSync(agentsDirectory, { recursive: true });

		const baseStub = [
			"export class AgentClient {}",
			"export class DatabaseClient {}",
			"export class NotionORMBase {",
			"  constructor(config) {",
			"    this.auth = config.auth;",
			"  }",
			"}",
			"",
		].join("\n");
		writeFileSync(
			join(srcDirectory, CODEGEN_EMIT_PATHS.baseModuleJs),
			baseStub,
		);
		const packageBaseDir = join(
			tempDirectory,
			"node_modules/@haustle/notion-orm/build/src",
		);
		mkdirSync(packageBaseDir, { recursive: true });
		writeFileSync(join(packageBaseDir, "base.js"), baseStub);
		writeFileSync(
			join(dbDirectory, CODEGEN_EMIT_PATHS.taskDbModuleJs),
			'export const taskDb = (auth) => ({ kind: "db", auth });\n',
		);
		writeFileSync(
			join(agentsDirectory, CODEGEN_EMIT_PATHS.mealAgentModuleJs),
			'export const mealAgent = (auth) => ({ kind: "agent", auth });\n',
		);

		const buildIndexTsPath = join(srcDirectory, CODEGEN_EMIT_PATHS.indexTs);
		const buildIndexJsPath = join(srcDirectory, CODEGEN_EMIT_PATHS.indexJs);
		const buildIndexDtsPath = join(srcDirectory, CODEGEN_EMIT_PATHS.indexDts);
		emitOrmIndexArtifacts({
			...metadata,
			buildIndexTsPath,
			buildIndexJsPath,
			buildIndexDtsPath,
			syncCommand: "notion sync",
		});

		const importedModule = await import(pathToFileURL(buildIndexJsPath).href);
		if (!isRuntimeNotionOrmConstructor(importedModule.default)) {
			throw new Error("Expected emitted module default export to be a class");
		}
		const NotionORM = importedModule.default;
		const client = new NotionORM({ auth: "token-123" });

		expect(client.databases.taskDb.kind).toBe("db");
		expect(client.databases.taskDb.auth).toBe("token-123");
		expect(client.agents.mealAgent.kind).toBe("agent");
		expect(client.agents.mealAgent.auth).toBe("token-123");

		const declarationCode = readFileSync(buildIndexDtsPath, "utf-8");
		expect(declarationCode.includes("class NotionORM")).toBe(true);
	});
});
