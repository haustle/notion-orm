import fs from "fs";
import path from "path";
import * as ts from "typescript";
import type { AgentIcon } from "../../client/AgentClient";
import { camelize } from "../../helpers";
import { createNameImport } from "../shared/ast-builders";
import { AGENTS_DIR, AST_IMPORT_PATHS } from "../shared/constants";
import { emitValueAsExpression } from "../shared/emit/emit-value-as-expression";
import {
	createEmitContext,
	emitTsAndJsArtifacts,
	printTsNodes,
	transpileTsToJs,
} from "../shared/emit/ts-emit-core";
import { TS_EMIT_OPTIONS_GENERATED } from "../shared/emit/ts-emit-options";

export interface AgentModuleBuildResult {
	nodes: ts.Statement[];
	agentId: string;
	agentName: string;
	agentModuleName: string;
}

export function buildAgentModuleNodes(args: {
	agentId: string;
	agentName: string;
	agentIcon: AgentIcon;
	agentModuleName?: string;
}): AgentModuleBuildResult {
	const agentModuleName = args.agentModuleName ?? camelize(args.agentName);
	const agentClientImport = createNameImport({
		namedImport: "AgentClient",
		path: AST_IMPORT_PATHS.AGENT_CLIENT,
	});

	const idVariable = ts.factory.createVariableStatement(
		undefined,
		ts.factory.createVariableDeclarationList(
			[
				ts.factory.createVariableDeclaration(
					ts.factory.createIdentifier("id"),
					undefined,
					undefined,
					ts.factory.createStringLiteral(args.agentId),
				),
			],
			ts.NodeFlags.Const,
		),
	);

	const nameVariable = ts.factory.createVariableStatement(
		undefined,
		ts.factory.createVariableDeclarationList(
			[
				ts.factory.createVariableDeclaration(
					ts.factory.createIdentifier("name"),
					undefined,
					undefined,
					ts.factory.createStringLiteral(args.agentName),
				),
			],
			ts.NodeFlags.Const,
		),
	);

	const iconValue = emitValueAsExpression(args.agentIcon);

	const agentClientFunction = ts.factory.createVariableStatement(
		[ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)],
		ts.factory.createVariableDeclarationList(
			[
				ts.factory.createVariableDeclaration(
					ts.factory.createIdentifier(agentModuleName),
					undefined,
					undefined,
					ts.factory.createArrowFunction(
						undefined,
						undefined,
						[
							ts.factory.createParameterDeclaration(
								undefined,
								undefined,
								ts.factory.createIdentifier("auth"),
								undefined,
								ts.factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword),
								undefined,
							),
						],
						undefined,
						undefined,
						ts.factory.createNewExpression(
							ts.factory.createIdentifier("AgentClient"),
							undefined,
							[
								ts.factory.createObjectLiteralExpression(
									[
										ts.factory.createPropertyAssignment(
											ts.factory.createIdentifier("auth"),
											ts.factory.createIdentifier("auth"),
										),
										ts.factory.createPropertyAssignment(
											ts.factory.createIdentifier("id"),
											ts.factory.createIdentifier("id"),
										),
										ts.factory.createPropertyAssignment(
											ts.factory.createIdentifier("name"),
											ts.factory.createIdentifier("name"),
										),
										ts.factory.createPropertyAssignment(
											ts.factory.createIdentifier("icon"),
											iconValue,
										),
									],
									false,
								),
							],
						),
					),
				),
			],
			ts.NodeFlags.Const,
		),
	);

	return {
		nodes: [agentClientImport, idVariable, nameVariable, agentClientFunction],
		agentId: args.agentId,
		agentName: args.agentName,
		agentModuleName,
	};
}

export function renderAgentModule(args: {
	agentId: string;
	agentName: string;
	agentIcon: AgentIcon;
	agentModuleName?: string;
}): {
	tsCode: string;
	jsCode: string;
	agentId: string;
	agentName: string;
	agentModuleName: string;
} {
	const { nodes, agentId, agentName, agentModuleName } =
		buildAgentModuleNodes(args);
	const tsCode = printTsNodes({
		nodes,
		context: createEmitContext({ fileName: `${agentModuleName}.ts` }),
	});
	const jsCode = transpileTsToJs({
		typescriptCode: tsCode,
		module: TS_EMIT_OPTIONS_GENERATED.module,
		target: TS_EMIT_OPTIONS_GENERATED.target,
	});
	return { tsCode, jsCode, agentId, agentName, agentModuleName };
}

export async function createTypescriptFileForAgent(args: {
	agentId: string;
	agentName: string;
	agentModuleName: string;
	agentIcon: AgentIcon;
}): Promise<void> {
	const { nodes, agentModuleName } = buildAgentModuleNodes(args);

	if (!fs.existsSync(AGENTS_DIR)) {
		fs.mkdirSync(AGENTS_DIR, { recursive: true });
	}

	emitTsAndJsArtifacts({
		nodes,
		tsPath: path.resolve(AGENTS_DIR, `${agentModuleName}.ts`),
		jsPath: path.resolve(AGENTS_DIR, `${agentModuleName}.js`),
		module: TS_EMIT_OPTIONS_GENERATED.module,
		target: TS_EMIT_OPTIONS_GENERATED.target,
	});
}
