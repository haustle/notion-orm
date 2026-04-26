import { describe, expect, test } from "bun:test";
import * as parser from "@babel/parser";
import * as t from "@babel/types";
import * as ts from "typescript";
import {
	buildConfigTemplateModuleAst,
	buildLiteralNotionConfigModuleAst,
	renderConfigTemplateModule,
	renderLiteralNotionConfigModule,
	updateConfigListInConfigModule,
} from "../../src/ast/shared/emit/config-emitter";
import { NOTION_CONFIG_FIELD_KEYS } from "../../src/config/types";
import {
	createEmitContext,
	printTsNodes,
} from "../../src/ast/shared/emit/ts-emit-core";
import {
	CODEGEN_EMIT_PATHS,
	CODEGEN_GOLDEN_FILES,
} from "../helpers/codegen-file-names";
import {
	buildNotionConfigSource,
	CONFIG_PATCH_SCENARIOS,
	type ConfigPatchScenario,
} from "../helpers/codegen-test-data";
import {
	expectNormalizedCodeToMatch,
	readGolden,
} from "../helpers/golden-code-assertions";
import {
	MOCK_DATA_SOURCE_ID,
	MOCK_DATA_SOURCE_ID_B,
} from "../helpers/test-mock-ids";

function extractListFromVariable(args: {
	sourceCode: string;
	variableName: string;
	listKey: "databases" | "agents";
}): string[] {
	const { sourceCode, variableName, listKey } = args;
	const ast = parser.parse(sourceCode, {
		sourceType: "module",
		plugins: ["typescript"],
	});
	for (const node of ast.program.body) {
		if (!t.isVariableDeclaration(node)) {
			continue;
		}
		for (const declaration of node.declarations) {
			if (
				!t.isIdentifier(declaration.id) ||
				declaration.id.name !== variableName ||
				!t.isObjectExpression(declaration.init)
			) {
				continue;
			}
			const databasesProperty = declaration.init.properties.find(
				(property) =>
					t.isObjectProperty(property) &&
					t.isIdentifier(property.key) &&
					property.key.name === listKey &&
					t.isArrayExpression(property.value),
			);
			if (
				databasesProperty &&
				t.isObjectProperty(databasesProperty) &&
				t.isArrayExpression(databasesProperty.value)
			) {
				return databasesProperty.value.elements
					.filter((element): element is t.StringLiteral =>
						t.isStringLiteral(element),
					)
					.map((element) => element.value);
			}
		}
	}
	return [];
}

describe("config emitter", () => {
	const patchScenarios: ConfigPatchScenario[] = [...CONFIG_PATCH_SCENARIOS];

	// Checks generated starter config source matches the golden template.
	test("renders TypeScript template output that matches the golden file", () => {
		const renderedCode = renderConfigTemplateModule({ isTS: true });
		const goldenCode = readGolden(CODEGEN_GOLDEN_FILES.configTemplate);
		expectNormalizedCodeToMatch({ actual: renderedCode, expected: goldenCode });
	});

	// Checks template AST node kinds: auth var, config var, export assignment.
	test("builds template AST with auth variable, config variable, and export", () => {
		const nodes = buildConfigTemplateModuleAst({ isTS: true });
		const printedCode = printTsNodes({
			nodes,
			context: createEmitContext({
				fileName: CODEGEN_EMIT_PATHS.notionConfigTs,
			}),
		});
		expect(nodes[0].kind).toBe(ts.SyntaxKind.VariableStatement);
		expect(nodes[1].kind).toBe(ts.SyntaxKind.VariableStatement);
		expect(nodes[2].kind).toBe(ts.SyntaxKind.ExportAssignment);
		expect(printedCode.includes("const NotionConfig")).toBe(true);
	});

	test("Zod schema field keys are the auth and list property names for config modules", () => {
		expect(new Set(NOTION_CONFIG_FIELD_KEYS)).toEqual(
			new Set(["auth", "databases", "agents"]),
		);
	});

	test("renders a literal TypeScript config module (AST, same shape as init template)", () => {
		const code = renderLiteralNotionConfigModule({
			isTS: true,
			config: {
				auth: "fix-token",
				databases: [MOCK_DATA_SOURCE_ID],
				agents: ["agent-1"],
			},
		});
		expect(code).toContain("const auth = ");
		expect(code).toContain('"fix-token"');
		expect(code).toContain("const NotionConfig = ");
		expect(code).toContain("export default NotionConfig");
		expect(code).not.toContain("process.env.NOTION_KEY");
		const nodes = buildLiteralNotionConfigModuleAst({
			isTS: true,
			config: {
				auth: "x",
				databases: [],
				agents: [],
			},
		});
		expect(nodes).toHaveLength(3);
	});

	// Checks fixture scenarios patch config lists for append and replace behavior.
	test("applies scenario updates and produces expected databases/agents lists", () => {
		for (const scenario of patchScenarios) {
			const output = updateConfigListInConfigModule({
				sourceCode: buildNotionConfigSource({
					isTypeScript: scenario.isTypeScript,
					...scenario.initialConfig,
				}),
				isTS: scenario.isTypeScript,
				key: scenario.type,
				items: scenario.items,
				strategy: scenario.strategy,
			});
			expect(output.modified).toBe(scenario.expected.modified);
			expect(
				extractListFromVariable({
					sourceCode: output.code,
					variableName: "NotionConfig",
					listKey: "databases",
				}),
			).toEqual(scenario.expected.databases);
			expect(
				extractListFromVariable({
					sourceCode: output.code,
					variableName: "NotionConfig",
					listKey: "agents",
				}),
			).toEqual(scenario.expected.agents);
		}

		const replaceAllScenario = patchScenarios.find(
			(scenario) => scenario.strategy === "replaceAll",
		);
		if (!replaceAllScenario) {
			throw new Error("Missing replaceAll scenario fixture");
		}
		const initialPatch = updateConfigListInConfigModule({
			sourceCode: buildNotionConfigSource({
				isTypeScript: replaceAllScenario.isTypeScript,
				...replaceAllScenario.initialConfig,
			}),
			isTS: replaceAllScenario.isTypeScript,
			key: replaceAllScenario.type,
			items: replaceAllScenario.items,
			strategy: replaceAllScenario.strategy,
		});
		const noOpPatch = updateConfigListInConfigModule({
			sourceCode: initialPatch.code,
			isTS: replaceAllScenario.isTypeScript,
			key: replaceAllScenario.type,
			items: replaceAllScenario.items,
			strategy: replaceAllScenario.strategy,
		});
		expect(noOpPatch.modified).toBe(false);
	});

	// Checks updater patches NotionConfig and leaves unrelated object literals unchanged.
	test("updates NotionConfig without mutating unrelated object literals", () => {
		const originalContent = [
			'const auth = process.env.NOTION_KEY || "key";',
			"const defaults = {",
			'\tdatabases: ["ignore"],',
			"};",
			"const NotionConfig = {",
			"\tauth,",
			`\tdatabases: ["${MOCK_DATA_SOURCE_ID}"],`,
			"\tagents: [],",
			"};",
			"export default NotionConfig;",
			"",
		].join("\n");
		const patched = updateConfigListInConfigModule({
			sourceCode: originalContent,
			isTS: true,
			key: "databases",
			items: [{ value: MOCK_DATA_SOURCE_ID_B, comment: "Orders" }],
			strategy: "appendUnique",
		});
		expect(patched.modified).toBe(true);
		expect(
			extractListFromVariable({
				sourceCode: patched.code,
				variableName: "defaults",
				listKey: "databases",
			}),
		).toEqual(["ignore"]);
		expect(
			extractListFromVariable({
				sourceCode: patched.code,
				variableName: "NotionConfig",
				listKey: "databases",
			}),
		).toEqual([MOCK_DATA_SOURCE_ID, MOCK_DATA_SOURCE_ID_B]);
	});

	// Checks patched config arrays are emitted as one-item-per-line lists.
	test("formats patched list arrays with one item per line", () => {
		const originalContent = [
			'const auth = process.env.NOTION_KEY || "key";',
			"const NotionConfig = {",
			"\tauth,",
			`\tdatabases: ["${MOCK_DATA_SOURCE_ID}"],`,
			'\tagents: ["agent-old"],',
			"};",
			"export default NotionConfig;",
			"",
		].join("\n");
		const patched = updateConfigListInConfigModule({
			sourceCode: originalContent,
			isTS: true,
			key: "agents",
			items: [
				{ value: "agent-1", comment: "Food Manager" },
				{ value: "agent-2", comment: "Web Clipper" },
			],
			strategy: "replaceAll",
		});
		expect(patched.code.includes("databases: [\n")).toBe(true);
		expect(patched.code.includes("agents: [\n")).toBe(true);
		expect(
			/"agent-1" \/\* Food Manager \*\/,\n\s+"agent-2" \/\* Web Clipper \*\/,/.test(
				patched.code,
			),
		).toBe(true);
	});
});
