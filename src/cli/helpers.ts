import { spawnSync } from "node:child_process";
import fs from "fs";
import path from "path";
import {
	type ConfigListItem,
	type ConfigListKey,
	type ConfigListUpdateStrategy,
	renderConfigTemplateModule,
	updateConfigListInConfigModule,
} from "../ast/shared/emit/config-emitter";
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
function formatConfigFileIfPossible(args: { configPath: string }): void {
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
		console.warn(
			"⚠️  Updated config but could not auto-format it with local prettier/biome.",
		);
	}
}

/** Heuristic for `notion init`: TS projects get a TS config template by default. */
export function shouldUseTypeScript(): boolean {
	const cwd = process.cwd();
	const tsConfigCandidates = [
		"tsconfig.json",
		"tsconfig.app.json",
		"tsconfig.base.json",
		"tsconfig.build.json",
	];

	for (const candidate of tsConfigCandidates) {
		if (fs.existsSync(path.join(cwd, candidate))) {
			return true;
		}
	}

	return false;
}

/** Renders the starter config template and guarantees a trailing newline. */
export function createConfigTemplate(isTS: boolean): string {
	const renderedTemplate = renderConfigTemplateModule({ isTS });
	return renderedTemplate.endsWith("\n")
		? renderedTemplate
		: `${renderedTemplate}\n`;
}

/** Prints setup guidance together with copy-pastable example configs. */
export function showSetupInstructions(): void {
	console.log("\n📚 Setup Instructions:");
	console.log(
		"1. Run: notion init [--ts|--js] (defaults to TypeScript when tsconfig.json is present)",
	);
	console.log("2. Add your Notion integration token and database IDs");
	console.log("3. Run: notion sync (generates database types)");
	console.log(
		"4. (Optional) Run: notion setup-agents-sdk (installs the paid Agents SDK, then re-run notion sync)",
	);

	console.log("\n📝 Example JavaScript config (notion.config.js):");
	console.log(`\n${createConfigTemplate(false).trimEnd()}\n`);

	console.log("📝 Example TypeScript config (notion.config.ts):");
	console.log(`\n${createConfigTemplate(true).trimEnd()}\n`);

	console.log("\n🔗 Need help getting your integration token?");
	console.log(
		"   Visit: https://developers.notion.com/docs/create-a-notion-integration",
	);
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
		formatConfigFileIfPossible({ configPath: args.configPath });
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
	});
}

export function isHelpCommand(args: string[]): boolean {
	return args.length > 0 && HELP_COMMANDS.has(args[0]);
}
