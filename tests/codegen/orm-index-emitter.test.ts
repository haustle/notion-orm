import { describe, expect, test } from "bun:test";
import * as ts from "typescript";
import {
	buildOrmIndexDeclarationAst,
	buildOrmIndexModuleAst,
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

const metadata: {
	databases: OrmEntityMetadata[];
	agents: OrmEntityMetadata[];
} = {
	databases: [...ORM_INDEX_SCENARIO.databases],
	agents: [...ORM_INDEX_SCENARIO.agents],
};

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
});
