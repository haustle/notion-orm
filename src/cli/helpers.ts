import { spawnSync } from "node:child_process";
import fs from "fs";
import path from "path";
import type { CodegenDiagnosticSink } from "../ast/shared/codegen-diagnostics";
import {
	type ConfigListItem,
	type ConfigListKey,
	type ConfigListUpdateStrategy,
	updateConfigListInConfigModule,
} from "../ast/shared/emit/config-emitter";
export {
	createConfigTemplate,
	shouldUseTypeScript,
	showSetupInstructions,
} from "../config/init";
import { toDashedNotionId, toUndashedNotionId } from "../helpers";

const CONFIG_FILE_FORMATTERS = [
	{
		name: "prettier",
		args: ["--write"],
	},
	{
		name: "biome",
		args: ["format", "--write"],
	},
] as const;

type ConfigFileFormatter = (typeof CONFIG_FILE_FORMATTERS)[number];
const HELP_COMMANDS = new Set(["help", "--help", "-h"]);

/** Prefer project-local formatters so generated config matches repo conventions. */
function getLocalFormatterExecutable(args: {
	formatterName: ConfigFileFormatter["name"];
}): string | undefined {
	const executableSuffix = process.platform === "win32" ? ".cmd" : "";
	const executablePath = path.join(
		process.cwd(),
		"node_modules",
		".bin",
		`${args.formatterName}${executableSuffix}`,
	);
	return fs.existsSync(executablePath) ? executablePath : undefined;
}

function runFormatterForConfigFile(args: {
	configPath: string;
	formatter: ConfigFileFormatter;
}): "missing" | "failed" | "success" {
	const executablePath = getLocalFormatterExecutable({
		formatterName: args.formatter.name,
	});
	if (!executablePath) {
		return "missing";
	}

	const formatterResult = spawnSync(
		executablePath,
		[...args.formatter.args, args.configPath],
		{
			cwd: process.cwd(),
			stdio: "ignore",
		},
	);
	return formatterResult.status === 0 ? "success" : "failed";
}

/** Format updated config files when local Prettier or Biome is available. */
function formatConfigFileIfPossible(args: {
	configPath: string;
	onFormatWarning?: CodegenDiagnosticSink;
}): void {
	let hasFormatterFailure = false;
	for (const formatter of CONFIG_FILE_FORMATTERS) {
		const formatResult = runFormatterForConfigFile({
			configPath: args.configPath,
			formatter,
		});
		if (formatResult === "success") {
			return;
		}
		if (formatResult === "failed") {
			hasFormatterFailure = true;
		}
	}

	if (hasFormatterFailure) {
		const message =
			"Updated config but could not auto-format it with local prettier/biome.";
		if (args.onFormatWarning) {
			args.onFormatWarning({ level: "warn", message });
		} else {
			console.warn(`⚠️  ${message}`);
		}
	}
}

export function validateAndGetUndashedNotionId(id: string): string | undefined {
	try {
		return toUndashedNotionId(id);
	} catch {
		return undefined;
	}
}

/** Applies a focused AST edit to one list property inside the user's config file. */
function updateConfigListInFile(args: {
	configPath: string;
	isTS: boolean;
	key: ConfigListKey;
	items: ConfigListItem[];
	strategy: ConfigListUpdateStrategy;
	onFormatWarning?: CodegenDiagnosticSink;
}): boolean {
	try {
		const originalContent = fs.readFileSync(args.configPath, "utf-8");
		const output = updateConfigListInConfigModule({
			sourceCode: originalContent,
			isTS: args.isTS,
			key: args.key,
			items: args.items,
			strategy: args.strategy,
		});
		if (!output.modified) {
			return false;
		}
		fs.writeFileSync(args.configPath, output.code);
		formatConfigFileIfPossible({
			configPath: args.configPath,
			onFormatWarning: args.onFormatWarning,
		});
		return true;
	} catch (error: unknown) {
		console.error("❌ Error updating config file with AST:");
		console.error(error);
		process.exit(1);
	}
}

/** Appends a database id to config while preserving AST-aware formatting and comments. */
export async function writeConfigFileWithAST(
	configPath: string,
	newDatabaseId: string,
	isTS: boolean,
	name?: string,
): Promise<boolean> {
	const formattedDatabaseId = toDashedNotionId(newDatabaseId);
	return updateConfigListInFile({
		configPath,
		isTS,
		key: "databases",
		items: [{ value: formattedDatabaseId, comment: name }],
		strategy: "appendUnique",
	});
}

/** Replaces the generated `agents` list with the latest live agent snapshot. */
export async function syncAgentsInConfigWithAST(
	configPath: string,
	agents: Array<{ id: string; name: string }>,
	isTS: boolean,
	options?: { onFormatWarning?: CodegenDiagnosticSink },
): Promise<boolean> {
	return updateConfigListInFile({
		configPath,
		isTS,
		key: "agents",
		items: agents.map((agent) => ({
			value: toDashedNotionId(agent.id),
			comment: agent.name,
		})),
		strategy: "replaceAll",
		onFormatWarning: options?.onFormatWarning,
	});
}

export function isHelpCommand(args: string[]): boolean {
	return args.length > 0 && HELP_COMMANDS.has(args[0]);
}
