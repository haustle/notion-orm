/**
 * Emits `demo-orm-all-databases.ts` via the TypeScript printer (ts.factory + printTsNodes),
 * not hand-rolled template strings.
 */

import * as ts from "typescript";
import { AST_TYPE_NAMES } from "../shared/constants";
import {
	createEmitContext,
	finalizeGeneratedSourceWithTrailingNewline,
	printTsNodes,
} from "../shared/emit/ts-emit-core";

type DemoOrmAllDatabasesEmitInput = {
	/** `./notion/` style path for the generated index import */
	buildIndexImportPath: string;
	/** `./notion/databases/Foo.ts` path for database module imports */
	databaseModuleRelativeImport: string;
	authPlaceholder: string;
	/** Primary database: camelCase module segment (`favoriteSongs`) */
	moduleName: string;
	databaseTitle: string;
	/** Local alias for `CreateSchema` (e.g. `FavoriteSongsCreate`) */
	createSchemaTypeAlias: string;
	genrePropertyValuesId: string;
	ratingPropertyValuesId: string;
	/** Named exports imported for enum arrays (may be empty) */
	enumValueImportNames: readonly string[];
	idxGenreElectronic: number;
	idxGenrePop: number;
	idxRatingFiveStars: number;
	idxRatingFourStars: number;
	/** Every DB module name — referenced as `notion.databases.<name>.count;` in `__playgroundReferencesEveryDatabaseClient`. */
	allModuleNames: readonly string[];
};

function id(text: string): ts.Identifier {
	return ts.factory.createIdentifier(text);
}

function addJsDoc(node: ts.Statement, doc: string): void {
	ts.addSyntheticLeadingComment(
		node,
		ts.SyntaxKind.MultiLineCommentTrivia,
		`* ${doc.replace(/\*\//g, "*\\/")} `,
		true,
	);
}

function nonNullEnumIndex(enumId: string, index: number): ts.Expression {
	return ts.factory.createNonNullExpression(
		ts.factory.createElementAccessExpression(
			id(enumId),
			ts.factory.createNumericLiteral(String(index)),
		),
	);
}

function notionDatabasesClient(
	moduleName: string,
): ts.PropertyAccessExpression {
	return ts.factory.createPropertyAccessExpression(
		ts.factory.createPropertyAccessExpression(id("notion"), "databases"),
		id(moduleName),
	);
}

function importNotionORM(buildIndexImportPath: string): ts.ImportDeclaration {
	return ts.factory.createImportDeclaration(
		undefined,
		ts.factory.createImportClause(
			false,
			undefined,
			ts.factory.createNamedImports([
				ts.factory.createImportSpecifier(
					false,
					undefined,
					id("NotionORM"),
				),
			]),
		),
		ts.factory.createStringLiteral(buildIndexImportPath),
		undefined,
	);
}

function importCreateSchemaTypeAlias(args: {
	databaseModuleRelativeImport: string;
	createSchemaTypeAlias: string;
}): ts.ImportDeclaration {
	return ts.factory.createImportDeclaration(
		undefined,
		ts.factory.createImportClause(
			true,
			undefined,
			ts.factory.createNamedImports([
				ts.factory.createImportSpecifier(
					false,
					id(AST_TYPE_NAMES.CREATE_SCHEMA),
					id(args.createSchemaTypeAlias),
				),
			]),
		),
		ts.factory.createStringLiteral(args.databaseModuleRelativeImport),
		undefined,
	);
}

function importEnumValues(args: {
	names: readonly string[];
	databaseModuleRelativeImport: string;
}): ts.ImportDeclaration | null {
	if (args.names.length === 0) {
		return null;
	}
	return ts.factory.createImportDeclaration(
		undefined,
		ts.factory.createImportClause(
			false,
			undefined,
			ts.factory.createNamedImports(
				args.names.map((name) =>
					ts.factory.createImportSpecifier(false, undefined, id(name)),
				),
			),
		),
		ts.factory.createStringLiteral(args.databaseModuleRelativeImport),
		undefined,
	);
}

function constNotionInstance(authPlaceholder: string): ts.VariableStatement {
	return ts.factory.createVariableStatement(
		undefined,
		ts.factory.createVariableDeclarationList(
			[
				ts.factory.createVariableDeclaration(
					id("notion"),
					undefined,
					undefined,
					ts.factory.createNewExpression(id("NotionORM"), undefined, [
						ts.factory.createObjectLiteralExpression(
							[
								ts.factory.createPropertyAssignment(
									"auth",
									ts.factory.createStringLiteral(authPlaceholder),
								),
							],
							false,
						),
					]),
				),
			],
			ts.NodeFlags.Const,
		),
	);
}

function exportAsyncFunction(args: {
	name: string;
	body: ts.Block;
}): ts.FunctionDeclaration {
	return ts.factory.createFunctionDeclaration(
		[
			ts.factory.createModifier(ts.SyntaxKind.ExportKeyword),
			ts.factory.createModifier(ts.SyntaxKind.AsyncKeyword),
		],
		undefined,
		id(args.name),
		undefined,
		[],
		undefined,
		args.body,
	);
}

function exportVoidFunction(args: {
	name: string;
	statements: readonly ts.Statement[];
}): ts.FunctionDeclaration {
	return ts.factory.createFunctionDeclaration(
		[ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)],
		undefined,
		id(args.name),
		undefined,
		[],
		ts.factory.createKeywordTypeNode(ts.SyntaxKind.VoidKeyword),
		ts.factory.createBlock([...args.statements], true),
	);
}

function awaitReturn(expression: ts.Expression): ts.Block {
	return ts.factory.createBlock(
		[
			ts.factory.createReturnStatement(
				ts.factory.createAwaitExpression(expression),
			),
		],
		true,
	);
}

/** One expression statement per DB so each `notion.databases.<module>.count` appears in the module. */
function dbCountReferenceStatements(
	moduleNames: readonly string[],
): ts.Statement[] {
	return moduleNames.map((moduleName) =>
		ts.factory.createExpressionStatement(
			ts.factory.createPropertyAccessExpression(
				notionDatabasesClient(moduleName),
				"count",
			),
		),
	);
}

/**
 * Prints the full demo ORM entry module source.
 */
export function emitDemoOrmAllDatabasesEntry(
	input: DemoOrmAllDatabasesEmitInput,
): string {
	const stmts: ts.Statement[] = [];

	stmts.push(importNotionORM(input.buildIndexImportPath));
	stmts.push(
		importCreateSchemaTypeAlias({
			databaseModuleRelativeImport: input.databaseModuleRelativeImport,
			createSchemaTypeAlias: input.createSchemaTypeAlias,
		}),
	);
	const valueImport = importEnumValues({
		names: input.enumValueImportNames,
		databaseModuleRelativeImport: input.databaseModuleRelativeImport,
	});
	if (valueImport) {
		stmts.push(valueImport);
	}

	stmts.push(constNotionInstance(input.authPlaceholder));

	const countFn = exportAsyncFunction({
		name: "countRowsInDatabase",
		body: awaitReturn(
			ts.factory.createCallExpression(
				ts.factory.createPropertyAccessExpression(
					notionDatabasesClient(input.moduleName),
					"count",
				),
				undefined,
				[ts.factory.createObjectLiteralExpression([], false)],
			),
		),
	});
	addJsDoc(
		countFn,
		"Row count for this database (mock client resolves to 0).",
	);
	stmts.push(countFn);

	const findManyCall = ts.factory.createCallExpression(
		ts.factory.createPropertyAccessExpression(
			notionDatabasesClient(input.moduleName),
			"findMany",
		),
		undefined,
		[
			ts.factory.createObjectLiteralExpression(
				[
					ts.factory.createPropertyAssignment(
						"where",
						ts.factory.createObjectLiteralExpression(
							[
								ts.factory.createPropertyAssignment(
									"genre",
									ts.factory.createObjectLiteralExpression(
										[
											ts.factory.createPropertyAssignment(
												"contains",
												nonNullEnumIndex(
													input.genrePropertyValuesId,
													input.idxGenreElectronic,
												),
											),
										],
										true,
									),
								),
								ts.factory.createPropertyAssignment(
									"rating",
									ts.factory.createObjectLiteralExpression(
										[
											ts.factory.createPropertyAssignment(
												"equals",
												nonNullEnumIndex(
													input.ratingPropertyValuesId,
													input.idxRatingFiveStars,
												),
											),
										],
										true,
									),
								),
							],
							true,
						),
					),
					ts.factory.createPropertyAssignment(
						"sortBy",
						ts.factory.createArrayLiteralExpression(
							[
								ts.factory.createObjectLiteralExpression(
									[
										ts.factory.createPropertyAssignment(
											"property",
											ts.factory.createStringLiteral("released"),
										),
										ts.factory.createPropertyAssignment(
											"direction",
											ts.factory.createStringLiteral("descending"),
										),
									],
									true,
								),
							],
							false,
						),
					),
				],
				true,
			),
		],
	);

	const findFn = exportAsyncFunction({
		name: "findElectronicFiveStarSongs",
		body: awaitReturn(findManyCall),
	});
	addJsDoc(
		findFn,
		`${input.databaseTitle}: electronic + top rating.`,
	);
	stmts.push(findFn);

	const trackObject = ts.factory.createObjectLiteralExpression(
		[
			ts.factory.createPropertyAssignment(
				"song",
				ts.factory.createStringLiteral("Neon Skyline"),
			),
			ts.factory.createPropertyAssignment(
				"artist",
				ts.factory.createStringLiteral("Roosevelt"),
			),
			ts.factory.createPropertyAssignment(
				"rating",
				nonNullEnumIndex(
					input.ratingPropertyValuesId,
					input.idxRatingFourStars,
				),
			),
			ts.factory.createPropertyAssignment(
				"genre",
				ts.factory.createArrayLiteralExpression(
					[
						nonNullEnumIndex(
							input.genrePropertyValuesId,
							input.idxGenrePop,
						),
						nonNullEnumIndex(
							input.genrePropertyValuesId,
							input.idxGenreElectronic,
						),
					],
					false,
				),
			),
			ts.factory.createPropertyAssignment(
				"released",
				ts.factory.createObjectLiteralExpression(
					[
						ts.factory.createPropertyAssignment(
							"start",
							ts.factory.createStringLiteral("2019-06-14"),
						),
					],
					true,
				),
			),
		],
		true,
	);

	const seedFn = exportAsyncFunction({
		name: "seedDemoTrack",
		body: ts.factory.createBlock(
			[
				ts.factory.createVariableStatement(
					undefined,
					ts.factory.createVariableDeclarationList(
						[
							ts.factory.createVariableDeclaration(
								id("track"),
								undefined,
								ts.factory.createTypeReferenceNode(
									id(input.createSchemaTypeAlias),
									undefined,
								),
								trackObject,
							),
						],
						ts.NodeFlags.Const,
					),
				),
				ts.factory.createReturnStatement(
					ts.factory.createAwaitExpression(
						ts.factory.createCallExpression(
							ts.factory.createPropertyAccessExpression(
								notionDatabasesClient(input.moduleName),
								"create",
							),
							undefined,
							[
								ts.factory.createObjectLiteralExpression(
									[
										ts.factory.createPropertyAssignment(
											"properties",
											id("track"),
										),
									],
									true,
								),
							],
						),
					),
				),
			],
			true,
		),
	});
	addJsDoc(
		seedFn,
		`${input.databaseTitle}: insert one demo row (mock \`create\` returns a placeholder id).`,
	);
	stmts.push(seedFn);

	const refFn = exportVoidFunction({
		name: "__playgroundReferencesEveryDatabaseClient",
		statements: dbCountReferenceStatements(input.allModuleNames),
	});
	addJsDoc(
		refFn,
		"Ensures every generated database module is referenced (multi-database workspace).",
	);
	stmts.push(refFn);

	const context = createEmitContext({ fileName: "demo-orm-all-databases.ts" });
	const printed = printTsNodes({ nodes: stmts, context }).trimEnd();
	return finalizeGeneratedSourceWithTrailingNewline(printed);
}
