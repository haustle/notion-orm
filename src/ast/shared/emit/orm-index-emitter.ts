import fs from "fs";
import * as ts from "typescript";
import type { CachedEntityMetadata } from "../cached-metadata";
import {
	AST_FS_PATHS,
	AST_IMPORT_PATHS,
	AST_RUNTIME_CONSTANTS,
} from "../constants";
import {
	createEmitContext,
	emitTsAndJsArtifacts,
	printTsNodes,
	type TsEmitContext,
	writeTextArtifact,
} from "./ts-emit-core";
import { TS_EMIT_INTEROP, TS_EMIT_OPTIONS_DEFAULT } from "./ts-emit-options";

/**
 * Minimal metadata needed to wire generated databases/agents into NotionORM.
 *
 * `name` must be an identifier-safe lower camelCase symbol
 * (for example: `coffeeShopDirectory`, `foodManager`).
 * It is used as both:
 * - the imported factory symbol name
 * - the generated module filename in import paths (`../db/<name>`, `../agents/<name>`)
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
 * Example: `import { coffeeShopDirectory } from "../db/coffeeShopDirectory";`
 */
function createEntityImportStatements(args: {
	entities: OrmEntityMetadata[];
	pathFactory: (name: string) => string;
	typeOnly?: boolean;
}): ts.ImportDeclaration[] {
	const { entities, pathFactory, typeOnly = false } = args;
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
						ts.factory.createIdentifier(entity.name),
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
 * `{ foo: ReturnType<typeof foo>; ... }`.
 */
function createRegistryTypeLiteral(entities: OrmEntityMetadata[]): ts.TypeNode {
	const properties = entities.map((entity) =>
		ts.factory.createPropertySignature(
			undefined,
			ts.factory.createIdentifier(entity.name),
			undefined,
			ts.factory.createTypeReferenceNode(
				ts.factory.createIdentifier("ReturnType"),
				[
					ts.factory.createTypeQueryNode(
						ts.factory.createIdentifier(entity.name),
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
 * Each generated factory receives `config.auth`.
 */
function createRegistryInitializer(
	entities: OrmEntityMetadata[],
): ts.Expression {
	return ts.factory.createObjectLiteralExpression(
		entities.map((entity) =>
			ts.factory.createPropertyAssignment(
				ts.factory.createIdentifier(entity.name),
				ts.factory.createCallExpression(
					ts.factory.createIdentifier(entity.name),
					undefined,
					[
						ts.factory.createPropertyAccessExpression(
							ts.factory.createIdentifier("config"),
							ts.factory.createIdentifier("auth"),
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
			undefined,
			ts.factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword),
		),
	]);
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
				createRegistryInitializer(databases),
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
					createRegistryInitializer(agents),
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

	const classMembers: ts.ClassElement[] = [
		ts.factory.createPropertyDeclaration(
			[ts.factory.createModifier(ts.SyntaxKind.PublicKeyword)],
			ts.factory.createIdentifier("databases"),
			undefined,
			createRegistryTypeLiteral(databases),
			undefined,
		),
	];

	if (hasAgents) {
		classMembers.push(
			ts.factory.createPropertyDeclaration(
				[ts.factory.createModifier(ts.SyntaxKind.PublicKeyword)],
				ts.factory.createIdentifier("agents"),
				undefined,
				createRegistryTypeLiteral(agents),
				undefined,
			),
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

	return ts.factory.createClassDeclaration(
		undefined,
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

	const classMembers: ts.ClassElement[] = [
		ts.factory.createPropertyDeclaration(
			[ts.factory.createModifier(ts.SyntaxKind.PublicKeyword)],
			ts.factory.createIdentifier("databases"),
			undefined,
			createRegistryTypeLiteral(databases),
			undefined,
		),
	];

	if (hasAgents) {
		classMembers.push(
			ts.factory.createPropertyDeclaration(
				[ts.factory.createModifier(ts.SyntaxKind.PublicKeyword)],
				ts.factory.createIdentifier("agents"),
				undefined,
				createRegistryTypeLiteral(agents),
				undefined,
			),
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
			undefined,
		),
	);

	return ts.factory.createClassDeclaration(
		[
			ts.factory.createModifier(ts.SyntaxKind.ExportKeyword),
			ts.factory.createModifier(ts.SyntaxKind.DefaultKeyword),
		],
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
}

/**
 * Produces runtime module statements for `build/src/index.ts`.
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
	const { databases, agents, syncCommand, importPaths } = args;
	const hasAgents = agents.length > 0;
	const databaseImports = createEntityImportStatements({
		entities: databases,
		pathFactory: importPaths?.databaseClass ?? AST_IMPORT_PATHS.databaseClass,
	});
	const agentImports = hasAgents
		? createEntityImportStatements({
				entities: agents,
				pathFactory: importPaths?.agentClass ?? AST_IMPORT_PATHS.agentClass,
			})
		: [];
	const classDeclaration = createRuntimeClassDeclaration({
		databases,
		agents,
		syncCommand,
	});
	return [
		...databaseImports,
		...agentImports,
		createBaseImportDeclaration({ includeAgentClient: hasAgents }),
		createBaseTypeExportDeclaration(),
		createBaseValueExportDeclaration({ includeAgentClient: hasAgents }),
		classDeclaration,
		ts.factory.createExportAssignment(
			undefined,
			false,
			ts.factory.createIdentifier("NotionORM"),
		),
	];
}

/**
 * Produces declaration module statements for `build/src/index.d.ts`.
 */
export function buildOrmIndexDeclarationAst(args: {
	databases: OrmEntityMetadata[];
	agents: OrmEntityMetadata[];
}): ts.Statement[] {
	const { databases, agents } = args;
	const hasAgents = agents.length > 0;
	const databaseImports = createEntityImportStatements({
		entities: databases,
		pathFactory: AST_IMPORT_PATHS.databaseClass,
		typeOnly: true,
	});
	const agentImports = hasAgents
		? createEntityImportStatements({
				entities: agents,
				pathFactory: AST_IMPORT_PATHS.agentClass,
				typeOnly: true,
			})
		: [];
	return [
		...databaseImports,
		...agentImports,
		createBaseImportDeclaration({ includeAgentClient: hasAgents }),
		createBaseTypeExportDeclaration(),
		createBaseValueExportDeclaration({ includeAgentClient: hasAgents }),
		createDeclarationClass({ databases, agents }),
	];
}

/**
 * Emits all NotionORM index artifacts (runtime TS/JS + declaration .d.ts).
 * This glues generated `db/*` and `agents/*` factory modules into one entrypoint.
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
	const runtimeNodes = buildOrmIndexModuleAst({
		databases,
		agents,
		syncCommand,
	});
	const declarationNodes = buildOrmIndexDeclarationAst({
		databases,
		agents,
	});

	const { tsCode, jsCode } = emitTsAndJsArtifacts({
		nodes: runtimeNodes,
		tsPath: buildIndexTsPath,
		jsPath: buildIndexJsPath,
		context,
		module: TS_EMIT_OPTIONS_DEFAULT.module,
		target: TS_EMIT_OPTIONS_DEFAULT.target,
		esModuleInterop: TS_EMIT_INTEROP.esModuleInterop,
		allowSyntheticDefaultImports: TS_EMIT_INTEROP.allowSyntheticDefaultImports,
	});
	const dtsCode = printTsNodes({
		nodes: declarationNodes,
		context: createEmitContext({ fileName: "index.d.ts" }),
	});
	writeTextArtifact({ filePath: buildIndexDtsPath, content: dtsCode });

	if (buildIndexDtsMapPath && fs.existsSync(buildIndexDtsMapPath)) {
		fs.unlinkSync(buildIndexDtsMapPath);
	}

	return { tsCode, jsCode, dtsCode };
}

/**
 * Rebuilds the generated root `build/src/index` artifacts that wire all
 * database/agent factories into the exported NotionORM class.
 * Use this from both database and agent CLI entry points.
 */
export function updateSourceIndexFile(
	databasesMetadata: CachedEntityMetadata[],
	agentsMetadata: CachedEntityMetadata[],
): void {
	if (!fs.existsSync(AST_FS_PATHS.BUILD_SRC_DIR)) {
		fs.mkdirSync(AST_FS_PATHS.BUILD_SRC_DIR, { recursive: true });
	}

	emitOrmIndexBuildArtifacts({
		databases: databasesMetadata.map((m) => ({ name: m.name })),
		agents: agentsMetadata.map((m) => ({ name: m.name })),
	});
}

/**
 * Convenience wrapper targeting canonical build output paths.
 */
export function emitOrmIndexBuildArtifacts(args: {
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
