import { AGENTS_SDK_SETUP_COMMAND } from "../agents-sdk-resolver";
import type { CreateAgentTypesResult } from "../ast/agents/generate-agents-cli";
import type { DatabaseTypesCodegenResult } from "../ast/database/generate-databases-cli";
import type { CachedEntityMetadata } from "../ast/shared/cached-metadata";
import type { CodegenDiagnostic } from "../ast/shared/codegen-diagnostics";
import { findConfigFile } from "../config/findConfigFile";
import { NOTION_CONFIG_BASENAME } from "../config/notion-config-filenames";

function logNotionEntrypointExample(args: {
	databaseKey: string | undefined;
	agentKey: string | undefined;
	agentsSkipped: boolean;
}): void {
	const { databaseKey, agentKey, agentsSkipped } = args;
	const body: string[] = [
		'import { NotionORM } from "./notion";',
		"const notion = new NotionORM({ auth: process.env.NOTION_KEY! });",
	];
	if (databaseKey) {
		body.push(`notion.databases.${databaseKey};`);
	} else {
		body.push("// notion.databases.* — add a database in config, then sync");
	}
	if (agentsSkipped) {
		body.push(
			"// notion.agents.* — `notion setup-agents-sdk` then `notion sync`",
		);
	} else if (agentKey) {
		body.push(`notion.agents.${agentKey};`);
	} else {
		body.push("// notion.agents.* — sync when your workspace has agents");
	}
	for (const line of body) {
		console.log(line);
	}
}

/** Post-`notion sync` user-facing output: status, summaries, buffered diagnostics, hints. */
export function logSyncReport(args: {
	databasesResult: DatabaseTypesCodegenResult;
	agentsResult: CreateAgentTypesResult;
	diagnostics: CodegenDiagnostic[];
	previousOnDisk: {
		databases: CachedEntityMetadata[];
		agents: CachedEntityMetadata[];
	};
	configFile: ReturnType<typeof findConfigFile> | undefined;
}): void {
	const { databasesResult, agentsResult, diagnostics, previousOnDisk, configFile } =
		args;

	const agentsOk =
		agentsResult.skipped || agentsResult.generationFailureCount === 0;

	console.log("");
	console.log(agentsOk ? "✔ Sync complete." : "⚠ Sync finished with errors.");

	if (databasesResult.databaseNames.length === 0) {
		console.log(
			"Databases: none in config (nothing generated under notion/databases).",
		);
	} else {
		console.log(`Databases: ${databasesResult.databaseNames.length}`);
		const lines = databasesResult.databaseNames
			.map((title) => `   • ${title}`)
			.join("\n");
		console.log(lines);
	}

	if (agentsResult.skipped) {
		console.log(
			`Agents: skipped — Notion Agents SDK not installed. Run \`${AGENTS_SDK_SETUP_COMMAND}\` to generate clients (\`chat\`, \`getMessages\`, \`chatStream\`, thread helpers).`,
		);
	} else if (agentsResult.agentNames.length === 0) {
		console.log("Agents: none returned for this integration.");
	} else {
		console.log(`Agents: ${agentsResult.agentNames.length}`);
		const lines = agentsResult.agentNames.map((n) => `   • ${n}`).join("\n");
		console.log(lines);
	}

	if (diagnostics.length > 0) {
		console.log("");
		console.log("Warnings and notes:");
		for (const d of diagnostics) {
			const prefix = d.level === "error" ? "  ✖ " : "  ⚠ ";
			console.log(`${prefix}${d.message}`);
		}
	}

	if (
		previousOnDisk.databases.length > 0 ||
		previousOnDisk.agents.length > 0
	) {
		console.log("");
		console.log(
			`Last generated metadata on disk (before this run): ${previousOnDisk.databases.length} databases, ${previousOnDisk.agents.length} agents.`,
		);
	}

	console.log("");
	console.log("Example:");
	logNotionEntrypointExample({
		databaseKey: databasesResult.databaseKeys[0],
		agentKey: agentsResult.agentKeys[0],
		agentsSkipped: agentsResult.skipped,
	});

	console.log("");

	if (configFile) {
		const configFileName =
			configFile.path.split(/[\\/]/).pop() ?? NOTION_CONFIG_BASENAME;
		console.log(
			`📝 ${configFileName} contains the full list of connected databases and agents.`,
		);
		console.log("");
		console.log("Read documentation: https://notion-orm.vercel.app/");
	} else {
		console.log(
			"📝 No notion config file detected. Using NOTION_KEY from environment.",
		);
	}
}
