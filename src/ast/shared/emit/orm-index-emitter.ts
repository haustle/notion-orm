import fs from "fs";
import * as ts from "typescript";
import type { CachedEntityMetadata } from "../cached-metadata";
import { toPascalCase } from "../ast-builders";
import {
	AST_FS_PATHS,
	AST_IMPORT_PATHS,
	AST_RUNTIME_CONSTANTS,
} from "../constants";
import {
	createEmitContext,
	finalizeGeneratedSourceWithTrailingNewline,
	insertBlankLineAfterDoubleSlashBanner,
	printTsNodeSegments,
	type TsEmitContext,
	transpileTsToJs,
	writeTextArtifact,
} from "./ts-emit-core";
import { TS_EMIT_INTEROP, TS_EMIT_OPTIONS_DEFAULT } from "./ts-emit-options";

/**
 * Minimal metadata needed to wire generated databases/agents into NotionORM.
 *
 * `name` must be an identifier-safe lower camelCase symbol
 * (for example: `coffeeShopDirectory`, `foodManager`).
 * It is used as:
 * - the registry property key; import paths use PascalCase file stems (`./databases/<PascalName>`, `./agents/<PascalName>`)
 * - database and agent factory exports are PascalCase (`CustomerOrders`, `FoodManager`)
 */
export interface OrmEntityMetadata {
	name: string;
}

/**
 * Creates base import from the ORM package.
 * Only includes `AgentClient` when agents are present.
 */
function createBaseImportDeclaration(args: {
	includeAgentClient: boolean;
}): ts.ImportDeclaration {
	const namedImports: ts.ImportSpecifier[] = [
		ts.factory.createImportSpecifier(
			false,
			undefined,
			ts.factory.createIdentifier("NotionORMBase"),
		),
		...(args.includeAgentClient
			? [
					ts.factory.createImportSpecifier(
						false,
						undefined,
						ts.factory.createIdentifier("AgentClient"),
					),
				]
			: []),
		ts.factory.createImportSpecifier(
			false,
			undefined,
			ts.factory.createIdentifier("DatabaseClient"),
		),
	];
	return ts.factory.createImportDeclaration(
		undefined,
		ts.factory.createImportClause(
			false,
			undefined,
			ts.factory.createNamedImports(namedImports),
		),
		ts.factory.createStringLiteral(AST_IMPORT_PATHS.ORM_BASE),
		undefined,
	);
}

/**
 * Re-exports base type surface from the package base module.
 */
function createBaseTypeExportDeclaration(): ts.ExportDeclaration {
	return ts.factory.createExportDeclaration(
		undefined,
		true,
		ts.factory.createNamedExports([
			ts.factory.createExportSpecifier(
				false,
				undefined,
				ts.factory.createIdentifier("NotionConfigType"),
			),
		]),
		ts.factory.createStringLiteral(AST_IMPORT_PATHS.ORM_BASE),
		undefined,
	);
}

/**
 * Re-exports base runtime values from the package base module.
 * Only includes `AgentClient` when agents are present.
 */
function createBaseValueExportDeclaration(args: {
	includeAgentClient: boolean;
}): ts.ExportDeclaration {
	const exports: ts.ExportSpecifier[] = [
		ts.factory.createExportSpecifier(
			false,
			undefined,
			ts.factory.createIdentifier("DatabaseClient"),
		),
	];
	if (args.includeAgentClient) {
		exports.unshift(
			ts.factory.createExportSpecifier(
				false,
				undefined,
				ts.factory.createIdentifier("AgentClient"),
			),
		);
	}
	return ts.factory.createExportDeclaration(
		undefined,
		false,
		ts.factory.createNamedExports(exports),
		ts.factory.createStringLiteral(AST_IMPORT_PATHS.ORM_BASE),
		undefined,
	);
}

/**
 * Creates imports for generated entity factory functions.
 * Example: `import { CoffeeShopDirectory } from "./databases/coffeeShopDirectory";`
 */
function createEntityImportStatements(args: {
	entities: OrmEntityMetadata[];
	pathFactory: (name: string) => string;
	typeOnly?: boolean;
	/** Exported factory identifier; defaults to `entity.name`. */
	factoryExportId?: (moduleBasename: string) => string;
}): ts.ImportDeclaration[] {
	const {
		entities,
		pathFactory,
		typeOnly = false,
		factoryExportId = (n: string) => n,
	} = args;
	return entities.map((entity) =>
		ts.factory.createImportDeclaration(
			undefined,
			ts.factory.createImportClause(
				typeOnly,
				undefined,
				ts.factory.createNamedImports([
					ts.factory.createImportSpecifier(
						false,
						undefined,
						ts.factory.createIdentifier(factoryExportId(entity.name)),
					),
				]),
			),
			ts.factory.createStringLiteral(pathFactory(entity.name)),
			undefined,
		),
	);
}

/**
 * Builds the shape for `databases`/`agents` properties on NotionORM:
 * `{ foo: ReturnType<typeof Foo>; ... }` (factory symbol may differ from the key).
 */
function createRegistryTypeLiteral(
	entities: OrmEntityMetadata[],
	factoryExportId: (moduleBasename: string) => string = (n) => n,
): ts.TypeNode {
	const properties = entities.map((entity) =>
		ts.factory.createPropertySignature(
			undefined,
			ts.factory.createIdentifier(entity.name),
			undefined,
			ts.factory.createTypeReferenceNode(
				ts.factory.createIdentifier("ReturnType"),
				[
					ts.factory.createTypeQueryNode(
						ts.factory.createIdentifier(factoryExportId(entity.name)),
						undefined,
					),
				],
			),
		),
	);
	return ts.factory.createTypeLiteralNode(properties);
}

/**
 * Creates constructor initializer object for each entity registry.
 * Each generated factory receives the resolved token from {@link NotionORMBase#notionAuth}.
 */
function createRegistryInitializer(
	entities: OrmEntityMetadata[],
	factoryExportId: (moduleBasename: string) => string = (n) => n,
): ts.Expression {
	return ts.factory.createObjectLiteralExpression(
		entities.map((entity) =>
			ts.factory.createPropertyAssignment(
				ts.factory.createIdentifier(entity.name),
				ts.factory.createCallExpression(
					ts.factory.createIdentifier(factoryExportId(entity.name)),
					undefined,
					[
						ts.factory.createPropertyAccessExpression(
							ts.factory.createThis(),
							ts.factory.createIdentifier("notionAuth"),
						),
					],
				),
			),
		),
		true,
	);
}

/**
 * Shared constructor config type for generated NotionORM class.
 */
function createConfigParamType(): ts.TypeNode {
	return ts.factory.createTypeLiteralNode([
		ts.factory.createPropertySignature(
			undefined,
			ts.factory.createIdentifier("auth"),
			ts.factory.createToken(ts.SyntaxKind.QuestionToken),
			ts.factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword),
		),
	]);
}

function addSyntheticJsdocBlock(node: ts.Node, lines: readonly string[]): void {
	const body = lines.map((line) => ` * ${line}`).join("\n");
	ts.addSyntheticLeadingComment(
		node,
		ts.SyntaxKind.MultiLineCommentTrivia,
		`*\n${body}\n `,
		true,
	);
}

function addOrmIndexGeneratedBanner(node: ts.Statement, syncCommand: string): void {
	ts.addSyntheticLeadingComment(
		node,
		ts.SyntaxKind.SingleLineCommentTrivia,
		" Generated by @haustle/notion-orm — do not edit manually.",
		true,
	);
	ts.addSyntheticLeadingComment(
		node,
		ts.SyntaxKind.SingleLineCommentTrivia,
		` Regenerate with \`${syncCommand}\` (or your package script).`,
		true,
	);
}

function addLeadingSectionSlashComment(node: ts.Statement, text: string): void {
	ts.addSyntheticLeadingComment(
		node,
		ts.SyntaxKind.SingleLineCommentTrivia,
		` ${text}`,
		true,
	);
}

/**
 * Builds runtime `NotionORM` class AST that instantiates generated databases
 * and agents in the constructor.
 */
function createRuntimeClassDeclaration(args: {
	databases: OrmEntityMetadata[];
	agents: OrmEntityMetadata[];
	syncCommand: string;
}): ts.ClassDeclaration {
	const { databases, agents, syncCommand } = args;
	const hasAgents = agents.length > 0;
	const statements: ts.Statement[] = [
		ts.factory.createExpressionStatement(
			ts.factory.createCallExpression(ts.factory.createSuper(), undefined, [
				ts.factory.createIdentifier("config"),
			]),
		),
		ts.factory.createExpressionStatement(
			ts.factory.createBinaryExpression(
				ts.factory.createPropertyAccessExpression(
					ts.factory.createThis(),
					ts.factory.createIdentifier("databases"),
				),
				ts.factory.createToken(ts.SyntaxKind.EqualsToken),
				createRegistryInitializer(databases, toPascalCase),
			),
		),
	];

	if (hasAgents) {
		statements.push(
			ts.factory.createExpressionStatement(
				ts.factory.createBinaryExpression(
					ts.factory.createPropertyAccessExpression(
						ts.factory.createThis(),
						ts.factory.createIdentifier("agents"),
					),
					ts.factory.createToken(ts.SyntaxKind.EqualsToken),
					createRegistryInitializer(agents, toPascalCase),
				),
			),
		);
	}

	if (databases.length === 0) {
		statements.push(
			ts.factory.createExpressionStatement(
				ts.factory.createCallExpression(
					ts.factory.createPropertyAccessExpression(
						ts.factory.createIdentifier("console"),
						ts.factory.createIdentifier("warn"),
					),
					undefined,
					[
						ts.factory.createStringLiteral(
							`⚠️  No databases found. Please run '${syncCommand}' to generate database types.`,
						),
					],
				),
			),
		);
	}

	const databasesProperty = ts.factory.createPropertyDeclaration(
		[ts.factory.createModifier(ts.SyntaxKind.PublicKeyword)],
		ts.factory.createIdentifier("databases"),
		undefined,
		createRegistryTypeLiteral(databases, toPascalCase),
		undefined,
	);
	addSyntheticJsdocBlock(databasesProperty, [
		"Typed database client factories.",
		"Keys match the `databases` entries in your Notion config; each value is a factory bound to this client's `auth` token.",
	]);

	const classMembers: ts.ClassElement[] = [databasesProperty];

	if (hasAgents) {
		const agentsProperty = ts.factory.createPropertyDeclaration(
			[ts.factory.createModifier(ts.SyntaxKind.PublicKeyword)],
			ts.factory.createIdentifier("agents"),
			undefined,
			createRegistryTypeLiteral(agents, toPascalCase),
			undefined,
		);
		addSyntheticJsdocBlock(agentsProperty, [
			"Typed agent client factories.",
			"Keys match the `agents` entries in your Notion config; each value is a factory bound to this client's `auth` token.",
		]);
		classMembers.push(agentsProperty);
	}

	const assignDatabasesStatement = statements[1];
	if (assignDatabasesStatement) {
		addLeadingSectionSlashComment(
			assignDatabasesStatement,
			"Instantiate generated factories with the same API token passed to this client.",
		);
	}

	classMembers.push(
		ts.factory.createConstructorDeclaration(
			undefined,
			[
				ts.factory.createParameterDeclaration(
					undefined,
					undefined,
					ts.factory.createIdentifier("config"),
					undefined,
					createConfigParamType(),
					undefined,
				),
			],
			ts.factory.createBlock(statements, true),
		),
	);

	const classDeclaration = ts.factory.createClassDeclaration(
		[ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)],
		ts.factory.createIdentifier("NotionORM"),
		undefined,
		[
			ts.factory.createHeritageClause(ts.SyntaxKind.ExtendsKeyword, [
				ts.factory.createExpressionWithTypeArguments(
					ts.factory.createIdentifier("NotionORMBase"),
					undefined,
				),
			]),
		],
		classMembers,
	);
	addSyntheticJsdocBlock(classDeclaration, [
		"Generated Notion ORM entrypoint for this project.",
		"`databases` and `agents` expose typed factories produced from your synced Notion workspace.",
		`Regenerate this file with \`${syncCommand}\` when your Notion schema or config changes.`,
	]);
	return classDeclaration;
}

/**
 * Builds declaration-only class AST for `index.d.ts`.
 */
function createDeclarationClass(args: {
	databases: OrmEntityMetadata[];
	agents: OrmEntityMetadata[];
}): ts.ClassDeclaration {
	const { databases, agents } = args;
	const hasAgents = agents.length > 0;

	const databasesProperty = ts.factory.createPropertyDeclaration(
		[ts.factory.createModifier(ts.SyntaxKind.PublicKeyword)],
		ts.factory.createIdentifier("databases"),
		undefined,
		createRegistryTypeLiteral(databases, toPascalCase),
		undefined,
	);
	addSyntheticJsdocBlock(databasesProperty, [
		"Typed database client factories.",
		"Keys match the `databases` entries in your Notion config; each value is a factory bound to this client's `auth` token.",
	]);

	const classMembers: ts.ClassElement[] = [databasesProperty];

	if (hasAgents) {
		const agentsProperty = ts.factory.createPropertyDeclaration(
			[ts.factory.createModifier(ts.SyntaxKind.PublicKeyword)],
			ts.factory.createIdentifier("agents"),
			undefined,
			createRegistryTypeLiteral(agents, toPascalCase),
			undefined,
		);
		addSyntheticJsdocBlock(agentsProperty, [
			"Typed agent client factories.",
			"Keys match the `agents` entries in your Notion config; each value is a factory bound to this client's `auth` token.",
		]);
		classMembers.push(agentsProperty);
	}

	classMembers.push(
		ts.factory.createConstructorDeclaration(
			undefined,
			[
				ts.factory.createParameterDeclaration(
					undefined,
					undefined,
					ts.factory.createIdentifier("config"),
					undefined,
					createConfigParamType(),
					undefined,
				),
			],
			undefined,
		),
	);

	const classDeclaration = ts.factory.createClassDeclaration(
		[ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)],
		ts.factory.createIdentifier("NotionORM"),
		undefined,
		[
			ts.factory.createHeritageClause(ts.SyntaxKind.ExtendsKeyword, [
				ts.factory.createExpressionWithTypeArguments(
					ts.factory.createIdentifier("NotionORMBase"),
					undefined,
				),
			]),
		],
		classMembers,
	);
	addSyntheticJsdocBlock(classDeclaration, [
		"Generated Notion ORM entrypoint for this project.",
		"`databases` and `agents` expose typed factories produced from your synced Notion workspace.",
	]);
	return classDeclaration;
}

/**
 * Produces runtime module statement groups for `notion/index.ts`, separated for readable spacing.
 */
function buildOrmIndexModuleStatementSegments(args: {
	databases: OrmEntityMetadata[];
	agents: OrmEntityMetadata[];
	syncCommand: string;
	importPaths?: {
		databaseClass?: (name: string) => string;
		agentClass?: (name: string) => string;
	};
}): readonly (readonly ts.Statement[])[] {
	const { databases, agents, syncCommand, importPaths } = args;
	const hasAgents = agents.length > 0;
	const databaseImports = createEntityImportStatements({
		entities: databases,
		pathFactory: importPaths?.databaseClass ?? AST_IMPORT_PATHS.databaseClass,
		factoryExportId: toPascalCase,
	});
	const agentImports = hasAgents
		? createEntityImportStatements({
				entities: agents,
				pathFactory: importPaths?.agentClass ?? AST_IMPORT_PATHS.agentClass,
				factoryExportId: toPascalCase,
			})
		: [];
	const baseImport = createBaseImportDeclaration({ includeAgentClient: hasAgents });
	const typeExport = createBaseTypeExportDeclaration();
	const valueExport = createBaseValueExportDeclaration({ includeAgentClient: hasAgents });
	const classDeclaration = createRuntimeClassDeclaration({
		databases,
		agents,
		syncCommand,
	});

	if (databaseImports.length > 0) {
		addOrmIndexGeneratedBanner(databaseImports[0], syncCommand);
		addLeadingSectionSlashComment(
			databaseImports[0],
			"Database client factories (generated under ./databases/).",
		);
	} else if (agentImports.length > 0) {
		addOrmIndexGeneratedBanner(agentImports[0], syncCommand);
		addLeadingSectionSlashComment(
			agentImports[0],
			"Agent client factories (generated under ./agents/).",
		);
	} else {
		addOrmIndexGeneratedBanner(baseImport, syncCommand);
	}

	if (databaseImports.length > 0 && agentImports.length > 0) {
		addLeadingSectionSlashComment(
			agentImports[0],
			"Agent client factories (generated under ./agents/).",
		);
	}

	if (databaseImports.length > 0 || agentImports.length > 0) {
		addLeadingSectionSlashComment(
			baseImport,
			"Package imports: NotionORMBase, config types, and client classes.",
		);
	}

	return [
		databaseImports,
		agentImports,
		[baseImport, typeExport, valueExport],
		[classDeclaration],
	];
}

/**
 * Produces runtime module statements for `notion/index.ts` (import as `./notion/` from app code).
 */
export function buildOrmIndexModuleAst(args: {
	databases: OrmEntityMetadata[];
	agents: OrmEntityMetadata[];
	syncCommand: string;
	importPaths?: {
		databaseClass?: (name: string) => string;
		agentClass?: (name: string) => string;
	};
}): ts.Statement[] {
	return buildOrmIndexModuleStatementSegments(args).flat();
}

/**
 * Produces declaration module statement groups for `notion/index.d.ts`, separated for readable spacing.
 */
function buildOrmIndexDeclarationStatementSegments(args: {
	databases: OrmEntityMetadata[];
	agents: OrmEntityMetadata[];
	/** Defaults to the CLI generate command from constants when omitted. */
	syncCommand?: string;
}): readonly (readonly ts.Statement[])[] {
	const { databases, agents, syncCommand: syncCommandArg } = args;
	const syncCommand = syncCommandArg ?? AST_RUNTIME_CONSTANTS.CLI_GENERATE_COMMAND;
	const hasAgents = agents.length > 0;
	const databaseImports = createEntityImportStatements({
		entities: databases,
		pathFactory: AST_IMPORT_PATHS.databaseClass,
		typeOnly: true,
		factoryExportId: toPascalCase,
	});
	const agentImports = hasAgents
		? createEntityImportStatements({
				entities: agents,
				pathFactory: AST_IMPORT_PATHS.agentClass,
				typeOnly: true,
				factoryExportId: toPascalCase,
			})
		: [];
	const baseImport = createBaseImportDeclaration({ includeAgentClient: hasAgents });
	const typeExport = createBaseTypeExportDeclaration();
	const valueExport = createBaseValueExportDeclaration({ includeAgentClient: hasAgents });
	const classDeclaration = createDeclarationClass({ databases, agents });

	if (databaseImports.length > 0) {
		addOrmIndexGeneratedBanner(databaseImports[0], syncCommand);
		addLeadingSectionSlashComment(
			databaseImports[0],
			"Database client factories (generated under ./databases/).",
		);
	} else if (agentImports.length > 0) {
		addOrmIndexGeneratedBanner(agentImports[0], syncCommand);
		addLeadingSectionSlashComment(
			agentImports[0],
			"Agent client factories (generated under ./agents/).",
		);
	} else {
		addOrmIndexGeneratedBanner(baseImport, syncCommand);
	}

	if (databaseImports.length > 0 && agentImports.length > 0) {
		addLeadingSectionSlashComment(
			agentImports[0],
			"Agent client factories (generated under ./agents/).",
		);
	}

	if (databaseImports.length > 0 || agentImports.length > 0) {
		addLeadingSectionSlashComment(
			baseImport,
			"Package imports: NotionORMBase, config types, and client classes.",
		);
	}

	return [
		databaseImports,
		agentImports,
		[baseImport, typeExport, valueExport],
		[classDeclaration],
	];
}

/**
 * Produces declaration module statements for `notion/index.d.ts`.
 */
export function buildOrmIndexDeclarationAst(args: {
	databases: OrmEntityMetadata[];
	agents: OrmEntityMetadata[];
	syncCommand?: string;
}): ts.Statement[] {
	return buildOrmIndexDeclarationStatementSegments(args).flat();
}

/**
 * Emits all NotionORM index artifacts (runtime TS/JS + declaration .d.ts).
 * This glues generated `databases/*` and `agents/*` factory modules into one entrypoint.
 */
export function emitOrmIndexArtifacts(args: {
	databases: OrmEntityMetadata[];
	agents: OrmEntityMetadata[];
	buildIndexTsPath: string;
	buildIndexJsPath: string;
	buildIndexDtsPath: string;
	buildIndexDtsMapPath?: string;
	syncCommand: string;
	context?: TsEmitContext;
}): { tsCode: string; jsCode: string; dtsCode: string } {
	const {
		databases,
		agents,
		buildIndexTsPath,
		buildIndexJsPath,
		buildIndexDtsPath,
		buildIndexDtsMapPath,
		syncCommand,
		context = createEmitContext({ fileName: "index.ts" }),
	} = args;
	const runtimeSegments = buildOrmIndexModuleStatementSegments({
		databases,
		agents,
		syncCommand,
	});
	let tsCode = printTsNodeSegments({ segments: runtimeSegments, context });
	tsCode = insertBlankLineAfterDoubleSlashBanner(tsCode);
	tsCode = finalizeGeneratedSourceWithTrailingNewline(tsCode);
	const jsCode = transpileTsToJs({
		typescriptCode: tsCode,
		module: TS_EMIT_OPTIONS_DEFAULT.module,
		target: TS_EMIT_OPTIONS_DEFAULT.target,
		esModuleInterop: TS_EMIT_INTEROP.esModuleInterop,
		allowSyntheticDefaultImports: TS_EMIT_INTEROP.allowSyntheticDefaultImports,
	});
	writeTextArtifact({ filePath: buildIndexTsPath, content: tsCode });
	writeTextArtifact({ filePath: buildIndexJsPath, content: jsCode });

	const declarationSegments = buildOrmIndexDeclarationStatementSegments({
		databases,
		agents,
		syncCommand,
	});
	const dtsContext = createEmitContext({ fileName: "index.d.ts" });
	let dtsCode = printTsNodeSegments({
		segments: declarationSegments,
		context: dtsContext,
	});
	dtsCode = insertBlankLineAfterDoubleSlashBanner(dtsCode);
	dtsCode = finalizeGeneratedSourceWithTrailingNewline(dtsCode);
	writeTextArtifact({ filePath: buildIndexDtsPath, content: dtsCode });

	if (buildIndexDtsMapPath && fs.existsSync(buildIndexDtsMapPath)) {
		fs.unlinkSync(buildIndexDtsMapPath);
	}

	return { tsCode, jsCode, dtsCode };
}

/**
 * Rebuilds the generated root `notion/index` artifacts that wire all
 * database/agent factories into the exported NotionORM class.
 * Use this from both database and agent CLI entry points.
 */
export function updateSourceIndexFile(
	databasesMetadata: CachedEntityMetadata[],
	agentsMetadata: CachedEntityMetadata[],
): void {
	if (!fs.existsSync(AST_FS_PATHS.CODEGEN_ROOT_DIR)) {
		fs.mkdirSync(AST_FS_PATHS.CODEGEN_ROOT_DIR, { recursive: true });
	}

	emitOrmIndexBuildArtifacts({
		databases: databasesMetadata.map((m) => ({ name: m.name })),
		agents: agentsMetadata.map((m) => ({ name: m.name })),
	});
}

/**
 * Convenience wrapper targeting canonical build output paths.
 */
function emitOrmIndexBuildArtifacts(args: {
	databases: OrmEntityMetadata[];
	agents: OrmEntityMetadata[];
	context?: TsEmitContext;
}): { tsCode: string; jsCode: string; dtsCode: string } {
	const { databases, agents, context } = args;
	return emitOrmIndexArtifacts({
		databases,
		agents,
		buildIndexTsPath: AST_FS_PATHS.buildIndexTs,
		buildIndexJsPath: AST_FS_PATHS.buildIndexJs,
		buildIndexDtsPath: AST_FS_PATHS.buildIndexDts,
		buildIndexDtsMapPath: AST_FS_PATHS.buildIndexDtsMap,
		syncCommand: AST_RUNTIME_CONSTANTS.CLI_GENERATE_COMMAND,
		context,
	});
}
