import * as babelGenerator from "@babel/generator";
const generate = babelGenerator.generate;
import * as parser from "@babel/parser";
import * as t from "@babel/types";
import * as ts from "typescript";
import { NOTION_CONFIG_BASENAME } from "../../../config/notion-config-filenames";
import type { NotionConfigType } from "../../../config/types";
import { codegenArtifactFileName } from "../codegen-environment";
import {
	createEmitContext,
	printTsNodes,
	type TsEmitContext,
} from "./ts-emit-core";

export type ConfigListKey = Exclude<keyof NotionConfigType, "auth">;

export interface ConfigListItem {
	value: string;
	comment?: string;
}

/**
 * `appendUnique` keeps existing entries and appends only missing values.
 * `replaceAll` rewrites the full list to exactly match provided items.
 */
export type ConfigListUpdateStrategy = "appendUnique" | "replaceAll";

function createAuthVariableStatement(): ts.VariableStatement {
	const statement = ts.factory.createVariableStatement(
		undefined,
		ts.factory.createVariableDeclarationList(
			[
				ts.factory.createVariableDeclaration(
					ts.factory.createIdentifier("auth"),
					undefined,
					undefined,
					ts.factory.createBinaryExpression(
						ts.factory.createPropertyAccessExpression(
							ts.factory.createPropertyAccessExpression(
								ts.factory.createIdentifier("process"),
								ts.factory.createIdentifier("env"),
							),
							ts.factory.createIdentifier("NOTION_KEY"),
						),
						ts.factory.createToken(ts.SyntaxKind.BarBarToken),
						ts.factory.createStringLiteral("your-notion-api-key-here"),
					),
				),
			],
			ts.NodeFlags.Const,
		),
	);
	ts.addSyntheticLeadingComment(
		statement,
		ts.SyntaxKind.SingleLineCommentTrivia,
		" Be sure to create a .env file and add your NOTION_KEY",
		true,
	);
	ts.addSyntheticLeadingComment(
		statement,
		ts.SyntaxKind.SingleLineCommentTrivia,
		" If you don't have an API key, sign up for free",
		true,
	);
	ts.addSyntheticLeadingComment(
		statement,
		ts.SyntaxKind.SingleLineCommentTrivia,
		" [here](https://developers.notion.com)",
		true,
	);
	return statement;
}

function createConfigProperty(args: {
	name: ConfigListKey;
	helpText?: string;
}): ts.PropertyAssignment {
	const property = ts.factory.createPropertyAssignment(
		ts.factory.createIdentifier(args.name),
		ts.factory.createArrayLiteralExpression([], true),
	);
	if (args.helpText) {
		ts.addSyntheticLeadingComment(
			property,
			ts.SyntaxKind.SingleLineCommentTrivia,
			` ${args.helpText}`,
			true,
		);
	}
	return property;
}

function createConfigExportStatement(isTS: boolean): ts.Statement {
	return isTS
		? ts.factory.createExportAssignment(
				undefined,
				false,
				ts.factory.createIdentifier("NotionConfig"),
			)
		: ts.factory.createExpressionStatement(
				ts.factory.createBinaryExpression(
					ts.factory.createPropertyAccessExpression(
						ts.factory.createIdentifier("module"),
						ts.factory.createIdentifier("exports"),
					),
					ts.factory.createToken(ts.SyntaxKind.EqualsToken),
					ts.factory.createIdentifier("NotionConfig"),
				),
			);
}

/**
 * Shared module shape: auth variable, `const NotionConfig = { ... }`, then
 * `export default` (TS) or `module.exports` (CJS).
 *
 * When `config` is omitted, builds the `notion init` template: env-based `auth`,
 * empty `databases`/`agents` with help comments. When `config` is set, builds
 * literal `auth` and ID lists (tests/fixtures).
 */
function buildNotionConfigModuleAst(args: {
	isTS: boolean;
	config?: NotionConfigType;
}): ts.Statement[] {
	const { isTS, config } = args;
	const authVariable = config
		? createAuthLiteralVariableStatement(config.auth)
		: createAuthVariableStatement();

	const listProperties: ts.ObjectLiteralElementLike[] = config
		? [
				ts.factory.createPropertyAssignment(
					ts.factory.createIdentifier("databases"),
					ts.factory.createArrayLiteralExpression(
						config.databases.map((id) => ts.factory.createStringLiteral(id)),
						true,
					),
				),
				ts.factory.createPropertyAssignment(
					ts.factory.createIdentifier("agents"),
					ts.factory.createArrayLiteralExpression(
						config.agents.map((id) => ts.factory.createStringLiteral(id)),
						true,
					),
				),
			]
		: [
				createConfigProperty({
					name: "databases",
					helpText: "Use: notion add <database-id> --type database",
				}),
				createConfigProperty({
					name: "agents",
					helpText: "Agents are auto-populated by: notion sync",
				}),
			];

	const notionConfigVariable = ts.factory.createVariableStatement(
		undefined,
		ts.factory.createVariableDeclarationList(
			[
				ts.factory.createVariableDeclaration(
					ts.factory.createIdentifier("NotionConfig"),
					undefined,
					undefined,
					ts.factory.createObjectLiteralExpression(
						[
							ts.factory.createShorthandPropertyAssignment(
								ts.factory.createIdentifier("auth"),
							),
							...listProperties,
						],
						true,
					),
				),
			],
			ts.NodeFlags.Const,
		),
	);

	return [authVariable, notionConfigVariable, createConfigExportStatement(isTS)];
}

/**
 * Builds AST nodes for a starter `notion.config` module.
 *
 * Example:
 * `buildConfigTemplateModuleAst({ isTS: true })`
 * builds:
 * - `const auth = process.env.NOTION_KEY || "...";`
 * - `const NotionConfig = { auth, databases: [], agents: [] };`
 * - `export default NotionConfig`
 */
export function buildConfigTemplateModuleAst(args: {
	isTS: boolean;
}): ts.Statement[] {
	return buildNotionConfigModuleAst({ isTS: args.isTS });
}

/**
 * Renders the starter `notion.config` module to source code text.
 *
 * Example:
 * `renderConfigTemplateModule({ isTS: false })`
 * returns CommonJS config source.
 */
export function renderConfigTemplateModule(args: {
	isTS: boolean;
	context?: TsEmitContext;
}): string {
	const {
		isTS,
		context = createEmitContext({
			fileName: codegenArtifactFileName(NOTION_CONFIG_BASENAME, "typescript"),
		}),
	} = args;
	return printTsNodes({
		nodes: buildNotionConfigModuleAst({ isTS }),
		context,
	});
}

function createAuthLiteralVariableStatement(
	authValue: string,
): ts.VariableStatement {
	return ts.factory.createVariableStatement(
		undefined,
		ts.factory.createVariableDeclarationList(
			[
				ts.factory.createVariableDeclaration(
					ts.factory.createIdentifier("auth"),
					undefined,
					undefined,
					ts.factory.createStringLiteral(authValue),
				),
			],
			ts.NodeFlags.Const,
		),
	);
}

/**
 * Like {@link buildConfigTemplateModuleAst} but with literal `auth` and list
 * values. Used for tests and fixtures; not for `notion init`.
 */
export function buildLiteralNotionConfigModuleAst(args: {
	config: NotionConfigType;
	isTS: boolean;
}): ts.Statement[] {
	return buildNotionConfigModuleAst({ isTS: args.isTS, config: args.config });
}

/**
 * Renders a literal `notion.config` module (see
 * {@link buildLiteralNotionConfigModuleAst}) for tests and generated fixtures.
 */
export function renderLiteralNotionConfigModule(args: {
	config: NotionConfigType;
	isTS: boolean;
	context?: TsEmitContext;
}): string {
	const {
		config,
		isTS,
		context = createEmitContext({
			fileName: codegenArtifactFileName(NOTION_CONFIG_BASENAME, "typescript"),
		}),
	} = args;
	return printTsNodes({
		nodes: buildNotionConfigModuleAst({ config, isTS }),
		context,
	});
}

/**
 * Parses notion.config source into a Babel AST so list updates can preserve
 * surrounding formatting and syntax style (TS/CJS/ESM).
 */
function parseConfigSource(args: {
	sourceCode: string;
	isTS: boolean;
}): t.File {
	const { sourceCode, isTS } = args;
	return parser.parse(sourceCode, {
		sourceType: "module",
		allowImportExportEverywhere: true,
		plugins: isTS ? ["typescript"] : [],
	});
}

/**
 * Walks through TS wrappers (`as`, `satisfies`, non-null) until an object
 * literal is found. This keeps updates robust against typed config patterns.
 */
function unwrapExpressionToObjectLiteral(
	expression: t.Expression | t.PrivateName | undefined | null,
): t.ObjectExpression | undefined {
	let currentExpression = expression;
	while (currentExpression) {
		if (t.isObjectExpression(currentExpression)) {
			return currentExpression;
		}
		if (
			t.isTSSatisfiesExpression(currentExpression) ||
			t.isTSAsExpression(currentExpression) ||
			t.isTSNonNullExpression(currentExpression)
		) {
			currentExpression = currentExpression.expression;
			continue;
		}
		return undefined;
	}
	return undefined;
}

/**
 * Narrow unknown values to Babel nodes for generic AST traversal.
 */
function isNode(value: unknown): value is t.Node {
	if (typeof value !== "object" || value === null || !("type" in value)) {
		return false;
	}
	const nodeType: unknown = Reflect.get(value, "type");
	return typeof nodeType === "string";
}

/**
 * Minimal recursive AST walker used to find/update config lists without
 * introducing a heavier traversal dependency.
 */
function traverseAst(node: t.Node, visitor: (node: t.Node) => void): void {
	visitor(node);
	const visitorKeys = t.VISITOR_KEYS[node.type] ?? [];
	for (const key of visitorKeys) {
		const value: unknown = Reflect.get(node, key);
		if (Array.isArray(value)) {
			for (const childNode of value) {
				if (isNode(childNode)) {
					traverseAst(childNode, visitor);
				}
			}
			continue;
		}
		if (isNode(value)) {
			traverseAst(value, visitor);
		}
	}
}

/**
 * Finds object literal initialized by a given variable name.
 */
function findObjectLiteralFromNamedVariable(args: {
	ast: t.File;
	variableName: string;
}): t.ObjectExpression | undefined {
	const { ast, variableName } = args;
	let objectLiteral: t.ObjectExpression | undefined;
	traverseAst(ast, (node) => {
		if (objectLiteral) {
			return;
		}
		if (
			!t.isVariableDeclarator(node) ||
			!t.isIdentifier(node.id) ||
			node.id.name !== variableName
		) {
			return;
		}
		objectLiteral = unwrapExpressionToObjectLiteral(node.init);
	});
	return objectLiteral;
}

function resolveObjectLiteralFromExpressionOrIdentifier(args: {
	ast: t.File;
	expression: t.Node | undefined | null;
}): t.ObjectExpression | undefined {
	if (!args.expression) {
		return undefined;
	}
	if (!t.isExpression(args.expression) && !t.isPrivateName(args.expression)) {
		return undefined;
	}

	const directObjectLiteral = unwrapExpressionToObjectLiteral(args.expression);
	if (directObjectLiteral) {
		return directObjectLiteral;
	}
	if (args.expression && t.isIdentifier(args.expression)) {
		return findObjectLiteralFromNamedVariable({
			ast: args.ast,
			variableName: args.expression.name,
		});
	}
	return undefined;
}

/**
 * Finds config object from `module.exports = ...` assignment.
 * Supports both direct object literals and identifier references.
 */
function findObjectLiteralFromModuleExports(
	ast: t.File,
): t.ObjectExpression | undefined {
	let objectLiteral: t.ObjectExpression | undefined;
	traverseAst(ast, (node) => {
		if (objectLiteral) {
			return;
		}
		if (
			!t.isAssignmentExpression(node) ||
			!t.isMemberExpression(node.left) ||
			node.left.computed ||
			!t.isIdentifier(node.left.object) ||
			node.left.object.name !== "module" ||
			!t.isIdentifier(node.left.property) ||
			node.left.property.name !== "exports"
		) {
			return;
		}
		objectLiteral = resolveObjectLiteralFromExpressionOrIdentifier({
			ast,
			expression: node.right,
		});
	});
	return objectLiteral;
}

/**
 * Finds config object from `export default ...`.
 * Supports direct object literals and identifier references.
 */
function findObjectLiteralFromExportDefault(
	ast: t.File,
): t.ObjectExpression | undefined {
	let objectLiteral: t.ObjectExpression | undefined;
	traverseAst(ast, (node) => {
		if (objectLiteral || !t.isExportDefaultDeclaration(node)) {
			return;
		}
		objectLiteral = resolveObjectLiteralFromExpressionOrIdentifier({
			ast,
			expression: node.declaration,
		});
	});
	return objectLiteral;
}

/**
 * Finds the root Notion config object literal using explicit supported shapes.
 * Resolution order:
 * 1) `const NotionConfig = { ... }`
 * 2) `module.exports = ...`
 * 3) `export default ...`
 */
function findConfigObjectLiteral(ast: t.File): t.ObjectExpression | undefined {
	return (
		findObjectLiteralFromNamedVariable({
			ast,
			variableName: "NotionConfig",
		}) ??
		findObjectLiteralFromModuleExports(ast) ??
		findObjectLiteralFromExportDefault(ast)
	);
}

/**
 * Creates a string literal item and optionally attaches a trailing comment
 * so generated config entries stay human-readable.
 */
function createConfigListLiteral(args: ConfigListItem): t.StringLiteral {
	const literal = t.stringLiteral(args.value);
	if (args.comment) {
		t.addComment(literal, "trailing", ` ${args.comment} `, false);
	}
	return literal;
}

/**
 * Preserves first-seen ordering while removing duplicate list entries.
 */
function dedupeListItems(values: ConfigListItem[]): ConfigListItem[] {
	const seen = new Set<string>();
	const normalized: ConfigListItem[] = [];
	for (const value of values) {
		if (seen.has(value.value)) {
			continue;
		}
		seen.add(value.value);
		normalized.push(value);
	}
	return normalized;
}

/**
 * Type guard for config list properties (`databases`/`agents`) in object
 * literals, supporting identifier and string keys.
 */
function isConfigListProperty(
	property: t.ObjectMember | t.SpreadElement,
	key: ConfigListKey,
): property is t.ObjectProperty {
	if (!t.isObjectProperty(property)) {
		return false;
	}
	if (t.isIdentifier(property.key)) {
		return property.key.name === key;
	}
	if (t.isStringLiteral(property.key)) {
		return property.key.value === key;
	}
	return false;
}

/**
 * Reads plain string values from an array literal, skipping non-string entries.
 */
function extractStringLiteralValues(
	arrayExpression: t.ArrayExpression,
): string[] {
	return arrayExpression.elements
		.filter((element): element is t.StringLiteral => t.isStringLiteral(element))
		.map((element) => element.value);
}

/**
 * Order-sensitive equality used to avoid rewriting unchanged config arrays.
 */
function areEqualStringLists(left: string[], right: string[]): boolean {
	if (left.length !== right.length) {
		return false;
	}
	for (let index = 0; index < left.length; index += 1) {
		if (left[index] !== right[index]) {
			return false;
		}
	}
	return true;
}

function detectIndentUnit(sourceCode: string): string {
	const tabIndentedLine = sourceCode.match(/^\t+/m);
	if (tabIndentedLine) {
		return "\t";
	}
	const spaceIndentedLine = sourceCode.match(/^( +)\S/m);
	if (!spaceIndentedLine || spaceIndentedLine[1].length < 2) {
		return "  ";
	}
	return spaceIndentedLine[1];
}

function getLineIndentAtIndex(args: {
	sourceCode: string;
	index: number;
}): string {
	const { sourceCode, index } = args;
	const lineStartIndex = sourceCode.lastIndexOf("\n", index - 1) + 1;
	let cursor = lineStartIndex;
	while (cursor < sourceCode.length) {
		const char = sourceCode[cursor];
		if (char !== " " && char !== "\t") {
			break;
		}
		cursor += 1;
	}
	return sourceCode.slice(lineStartIndex, cursor);
}

function formatConfigListArraysToMultiline(args: {
	sourceCode: string;
	isTS: boolean;
}): string {
	const { sourceCode, isTS } = args;
	const ast = parseConfigSource({ sourceCode, isTS });
	const configObject = findConfigObjectLiteral(ast);
	if (!configObject) {
		return sourceCode;
	}
	const indentUnit = detectIndentUnit(sourceCode);
	const replacements: Array<{ start: number; end: number; nextText: string }> =
		[];

	for (const property of configObject.properties) {
		if (
			!isConfigListProperty(property, "databases") &&
			!isConfigListProperty(property, "agents")
		) {
			continue;
		}
		if (!t.isArrayExpression(property.value)) {
			continue;
		}

		const arrayValue = property.value;
		if (arrayValue.elements.length === 0) {
			continue;
		}
		if (
			arrayValue.start == null ||
			arrayValue.end == null ||
			property.start == null
		) {
			continue;
		}

		const propertyIndent = getLineIndentAtIndex({
			sourceCode,
			index: property.start,
		});
		const elementIndent = `${propertyIndent}${indentUnit}`;
		const formattedElements = arrayValue.elements
			.filter((element): element is t.Expression => element !== null)
			.map(
				(element) =>
					`${elementIndent}${generate(element, { concise: false }).code},`,
			)
			.join("\n");

		replacements.push({
			start: arrayValue.start,
			end: arrayValue.end,
			nextText: `[\n${formattedElements}\n${propertyIndent}]`,
		});
	}

	if (replacements.length === 0) {
		return sourceCode;
	}
	let formattedCode = sourceCode;
	for (const replacement of replacements.sort(
		(left, right) => right.start - left.start,
	)) {
		formattedCode =
			formattedCode.slice(0, replacement.start) +
			replacement.nextText +
			formattedCode.slice(replacement.end);
	}
	return formattedCode;
}

/**
 * Applies append/replace semantics for one config list key and reports whether
 * source code should be re-emitted.
 */
function applyListUpdateToObjectLiteral(args: {
	configObject: t.ObjectExpression;
	key: ConfigListKey;
	values: ConfigListItem[];
	strategy: ConfigListUpdateStrategy;
}): boolean {
	const { configObject, key, values, strategy } = args;
	const normalizedValues = dedupeListItems(values);
	const arrayProperty = configObject.properties.find((property) =>
		isConfigListProperty(property, key),
	);

	if (!arrayProperty) {
		const createdArrayProperty = t.objectProperty(
			t.identifier(key),
			t.arrayExpression(
				normalizedValues.map((value) => createConfigListLiteral(value)),
			),
		);
		configObject.properties.push(createdArrayProperty);
		return normalizedValues.length > 0;
	}

	if (
		!t.isObjectProperty(arrayProperty) ||
		!t.isArrayExpression(arrayProperty.value)
	) {
		const replacementProperty = t.objectProperty(
			t.identifier(key),
			t.arrayExpression(
				normalizedValues.map((value) => createConfigListLiteral(value)),
			),
		);
		const propertyIndex = configObject.properties.findIndex((property) =>
			isConfigListProperty(property, key),
		);
		if (propertyIndex >= 0) {
			configObject.properties[propertyIndex] = replacementProperty;
		}
		return true;
	}

	const existingValues = extractStringLiteralValues(arrayProperty.value);

	if (strategy === "replaceAll") {
		const nextValues = normalizedValues.map((value) => value.value);
		if (areEqualStringLists(existingValues, nextValues)) {
			return false;
		}
		arrayProperty.value.elements = normalizedValues.map((value) =>
			createConfigListLiteral(value),
		);
		return true;
	}

	const existingValueSet = new Set(existingValues);
	let modified = false;
	for (const value of normalizedValues) {
		if (existingValueSet.has(value.value)) {
			continue;
		}
		arrayProperty.value.elements.push(createConfigListLiteral(value));
		modified = true;
	}
	return modified;
}

/**
 * Updates one config list (`databases` or `agents`) inside module source code.
 *
 * Example (append only new IDs):
 * `updateConfigListInConfigModule({ sourceCode, isTS: true, key: "databases", strategy: "appendUnique", items: [...] })`
 *
 * Example (replace entire list):
 * `updateConfigListInConfigModule({ sourceCode, isTS: true, key: "agents", strategy: "replaceAll", items: [...] })`
 */
export function updateConfigListInConfigModule(args: {
	sourceCode: string;
	isTS: boolean;
	key: ConfigListKey;
	items: ConfigListItem[];
	strategy: ConfigListUpdateStrategy;
}): { modified: boolean; code: string } {
	const { sourceCode, isTS, key, items, strategy } = args;
	const ast = parseConfigSource({ sourceCode, isTS });
	const configObject = findConfigObjectLiteral(ast);
	if (!configObject) {
		throw new Error("Could not locate a config object in notion.config file");
	}

	const modified = applyListUpdateToObjectLiteral({
		configObject,
		key,
		values: items,
		strategy,
	});
	if (!modified) {
		return {
			modified: false,
			code: sourceCode,
		};
	}

	const output = generate(ast, {
		retainLines: true,
		concise: false,
	});
	return {
		modified: true,
		code: formatConfigListArraysToMultiline({
			sourceCode: output.code,
			isTS,
		}),
	};
}
