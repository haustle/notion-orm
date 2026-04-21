#!/usr/bin/env bun

import * as readline from "node:readline";
import fs from "fs";
import { Client } from "@notionhq/client";
import {
	findConfigFile,
	initializeNotionConfigFile,
	validateConfig,
} from "../config/helpers";
import {
	NOTION_CONFIG_BASENAME,
	NOTION_CONFIG_EXTENSION_LABELS,
} from "../config/notion-config-filenames";
import { resolveCodegenEnvironment } from "../ast/shared/codegen-environment";
import {
	createAgentTypes,
	type CreateAgentTypesResult,
} from "../ast/agents/generate-agents-cli";
import { createDatabaseTypes } from "../ast/database/generate-databases-cli";
import { AGENTS_SDK_SETUP_COMMAND } from "../agents-sdk-resolver";
import {
	readAgentMetadataFromDisk,
	readDatabaseMetadata,
} from "../ast/shared/cached-metadata";
import { AST_FS_PATHS, AST_RUNTIME_CONSTANTS } from "../ast/shared/constants";
import { updateSourceIndexFile } from "../ast/shared/emit/orm-index-emitter";
import { clearConfigCache, loadConfig } from "../config/loadConfig";
import { toDashedNotionId, toUndashedNotionId } from "../helpers";
import {
	isHelpCommand,
	showSetupInstructions,
	validateAndGetUndashedNotionId,
	writeConfigFileWithAST,
} from "./helpers";

type ProgressRowState = "running" | "done" | "unavailable";
type ProgressRowKey = "agents" | "databases";
type ProgressRow = {
	label: string;
	completed: number;
	total: number;
	state: ProgressRowState;
};

/**
 * Small terminal renderer that keeps sync progress readable without interleaving
 * the agent and database generation logs.
 */
class SyncProgressRenderer {
	private readonly spinnerFrames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧"];
	private spinnerIndex = 0;
	private interval: ReturnType<typeof setInterval> | undefined;
	private hasRendered = false;
	private readonly rows: Record<ProgressRowKey, ProgressRow> = {
		agents: {
			label: "Agents",
			completed: 0,
			total: 0,
			state: "running",
		},
		databases: {
			label: "Databases",
			completed: 0,
			total: 0,
			state: "running",
		},
	};

	constructor(private readonly isTTY: boolean) {}

	start(): void {
		const header = this.isTTY
			? "\x1b[1m📐 Updating static types\x1b[0m"
			: "📐 Updating static types";
		console.log(header);
		if (this.isTTY) {
			this.render();
			this.interval = setInterval(() => {
				this.spinnerIndex = (this.spinnerIndex + 1) % this.spinnerFrames.length;
				this.render();
			}, 90);
		} else {
			console.log(this.formatRow(this.rows.agents));
			console.log(this.formatRow(this.rows.databases));
		}
	}

	updateProgress(key: ProgressRowKey, completed: number, total: number): void {
		const row = this.rows[key];
		row.completed = completed;
		row.total = total;
		if (row.state !== "done") {
			if (total === 0) {
				row.state = "unavailable";
			} else if (completed >= total) {
				row.state = "done";
			} else {
				row.state = "running";
			}
		}
		if (this.isTTY) {
			this.render();
		}
	}

	complete(key: ProgressRowKey): void {
		const row = this.rows[key];
		row.state = row.total === 0 ? "unavailable" : "done";
		if (this.isTTY) {
			this.render();
		}
	}

	stop(): void {
		if (this.interval) {
			clearInterval(this.interval);
			this.interval = undefined;
		}
		if (this.isTTY) {
			this.render();
			process.stdout.write("\n");
		} else {
			console.log(this.formatRow(this.rows.agents));
			console.log(this.formatRow(this.rows.databases));
		}
	}

	private formatRow(row: ProgressRow): string {
		if (row.state === "unavailable") {
			return `${row.label}: unavailable`;
		}
		const countLabel = `[${row.completed}/${row.total}]`;
		const marker =
			row.state === "done"
				? "✔"
				: this.isTTY
					? this.spinnerFrames[this.spinnerIndex]
					: "...";
		return `${row.label}: ${marker} ${countLabel}`;
	}

	private render(): void {
		const lines = [
			this.formatRow(this.rows.agents),
			this.formatRow(this.rows.databases),
		];
		if (this.hasRendered) {
			readline.moveCursor(process.stdout, 0, -lines.length);
		}
		for (const line of lines) {
			readline.clearLine(process.stdout, 0);
			process.stdout.write(`${line}\n`);
		}
		this.hasRendered = true;
	}
}

function exitWithError(message: string, error: unknown): never {
	console.error(message);
	console.error(error);
	process.exit(1);
}

/** Runs agent and database generation in parallel, then refreshes the root index once. */
async function runSync(): Promise<void> {
	const renderer = new SyncProgressRenderer(Boolean(process.stdout.isTTY));
	let rendererStarted = false;
	try {
		await validateConfig();
		renderer.start();
		rendererStarted = true;
		// Full sync replaces the entire generated tree so removed DBs/agents and stray
		// files under `notion/` cannot linger (incremental `notion add` does not run this).
		fs.rmSync(AST_FS_PATHS.CODEGEN_ROOT_DIR, { recursive: true, force: true });

		const agentsPromise: Promise<CreateAgentTypesResult> = createAgentTypes({
			skipSourceIndexUpdate: true,
			onProgress: ({ completed, total }) => {
				renderer.updateProgress("agents", completed, total);
			},
		});

		const databasesPromise = createDatabaseTypes({
			type: "all",
			skipSourceIndexUpdate: true,
			onProgress: ({ completed, total }) => {
				renderer.updateProgress("databases", completed, total);
			},
		});

		const [agentsResult, databasesResult] = await Promise.all([
			agentsPromise,
			databasesPromise,
		]);
		renderer.complete("agents");
		renderer.complete("databases");
		// Tear down the spinner before file writes and summary logs so TTY output
		// is not interleaved with the progress interval.
		renderer.stop();
		rendererStarted = false;

		const agentsMetadata = agentsResult.skipped
			? []
			: readAgentMetadataFromDisk();
		updateSourceIndexFile(
			readDatabaseMetadata(),
			agentsMetadata,
			resolveCodegenEnvironment({ configRuntime: findConfigFile() }),
		);

		const { databaseNames, databaseKeys } = databasesResult;
		if (databaseNames.length === 0) {
			console.log("📂 Databases: none in config (nothing generated under notion/databases).");
		} else if (databaseNames.length === 1) {
			console.log(
				`📂 Databases (1): ${databaseNames[0]} → notion.databases.${databaseKeys[0]}`,
			);
		} else {
			const lines = databaseNames
				.map(
					(title, i) =>
						`   • ${title} → notion.databases.${databaseKeys[i]}`,
				)
				.join("\n");
			console.log(`📂 Databases (${databaseNames.length}):\n${lines}`);
		}

		if (agentsResult.skipped) {
			console.log(
				`⚠️  Agents: skipped — Notion Agents SDK not installed. Run \`${AGENTS_SDK_SETUP_COMMAND}\` to generate clients (\`chat\`, \`getMessages\`, \`chatStream\`, thread helpers).`,
			);
		} else if (agentsResult.agentNames.length === 0) {
			console.log("🤖 Agents: none returned for this integration.");
		} else if (agentsResult.agentNames.length === 1) {
			console.log(`🤖 Agents (1): ${agentsResult.agentNames[0]}`);
		} else {
			const lines = agentsResult.agentNames.map((n) => `   • ${n}`).join("\n");
			console.log(`🤖 Agents (${agentsResult.agentNames.length}):\n${lines}`);
		}

		console.log("");
		console.log("💡 Databases: use `notion.databases.*`");
		if (!agentsResult.skipped) {
			console.log(
				"💡 Agents: use `notion.agents.*` (typed `chat`, `getMessages`, `chatStream`, …)",
			);
		}
		console.log("");

		const configFile = findConfigFile();
		if (configFile) {
			const configFileName =
				configFile.path.split(/[\\/]/).pop() ?? NOTION_CONFIG_BASENAME;
			console.log(
				`📝 ${configFileName} contains the full list of connected databases and agents.`,
			);
		} else {
			console.log(
				"📝 No notion config file detected. Using NOTION_KEY from environment.",
			);
		}
	} catch (error: unknown) {
		exitWithError("❌ Error syncing types:", error);
	} finally {
		if (rendererStarted) {
			renderer.stop();
		}
	}
}

/** Best-effort lookup used to annotate config entries with a human-readable name. */
async function fetchDatabaseName(args: {
	auth: string;
	dataSourceId: string;
}): Promise<string | undefined> {
	try {
		const client = new Client({
			auth: args.auth,
			notionVersion: AST_RUNTIME_CONSTANTS.NOTION_API_VERSION,
		});
		const databaseObject = await client.dataSources.retrieve({
			data_source_id: args.dataSourceId,
		});
		return "title" in databaseObject && databaseObject.title?.[0]?.plain_text
			? databaseObject.title[0].plain_text
			: undefined;
	} catch (error: unknown) {
		const reason = error instanceof Error ? `: ${error.message}` : "";
		console.log(
			`⚠️  Could not fetch database name, continuing without comment${reason}`,
		);
		return undefined;
	}
}

/**
 * Adds one database to config if needed, then performs an incremental type
 * generation pass so the new entry is immediately available to consumers.
 */
async function runAdd(input: string): Promise<void> {
	const undashedUuid = validateAndGetUndashedNotionId(input);

	if (!undashedUuid) {
		console.error("❌ Invalid input format");
		console.error("   Expected formats:");
		console.error(
			"   • Database ID: 12345678-1234-1234-1234-123456789abc (with or without dashes)",
		);
		console.error(
			"   • Notion URL: https://www.notion.so/workspace/c88c5ccf109f4e71937d5d3b3ddfeade?v=...",
		);
		process.exit(1);
	}
	const formattedUuid = toDashedNotionId(undashedUuid);
	const configFile = findConfigFile();

	if (!configFile) {
		console.error(
			`❌ No config file found. Could not find notion.config.(${NOTION_CONFIG_EXTENSION_LABELS}) in project root`,
		);
		console.error("Run 'notion init' to create a config file first");
		process.exit(1);
	}

	console.log(
		`🔍 Found config: ${configFile.path.split(/[\\/]/).pop() ?? NOTION_CONFIG_BASENAME}`,
	);

	clearConfigCache();
	const config = await loadConfig(configFile.path);
	const databaseName = await fetchDatabaseName({
		auth: config.auth,
		dataSourceId: undashedUuid,
	});
	const existingDatabaseIds = new Set(config.databases.map(toUndashedNotionId));
	if (existingDatabaseIds.has(undashedUuid)) {
		console.log(
			`⚠️  Database ID ${formattedUuid} is already in the configuration`,
		);
		console.log("   Regenerating types for this database...");
	} else {
		const wasModified = await writeConfigFileWithAST(
			configFile.path,
			undashedUuid,
			configFile.isTS,
			databaseName,
		);

		if (wasModified) {
			console.log("🔗 Added database to config");
		} else {
			console.log(
				`⚠️  Database ID '${formattedUuid}' already in the configuration`,
			);
		}
	}

	clearConfigCache();
	const { databaseNames, databaseKeys } = await createDatabaseTypes({
		type: "incremental",
		id: undashedUuid,
	});

	if (databaseNames.length > 0 && databaseKeys.length > 0) {
		console.log(`✅ Completed schema generation for '${databaseNames[0]}'`);
		console.log(`💡 Access it via \`notion.databases.${databaseKeys[0]}\``);
	}

	console.log(
		"\n\n📄 Tip: In the future run `notion sync` to refresh all database schemas/types",
	);
}

function showHelpMessage(): void {
	console.log("📖 Notion ORM CLI");
	console.log("Usage:");
	console.log(
		"  notion init [--ts|--js]                    - Create a starter notion.config file",
	);
	console.log(
		"  notion sync                                - Sync types for all databases and agents",
	);
	console.log(
		"  notion add <id-or-url> [--type database]  - Add database to config and generate types",
	);
	console.log(
		"  notion setup-agents-sdk                    - Install/update the Notion Agents SDK (paid feature)",
	);
	console.log(
		"  notion generate                            - Deprecated alias for `notion sync`",
	);
	console.log("\nExamples:");
	console.log(
		"  notion add 12345678-1234-1234-1234-123456789abc --type database",
	);
	console.log(
		"  notion add https://www.notion.so/workspace/c88c5ccf109f4e71937d5d3b3ddfeade?v=123",
	);
	console.log("  notion sync");
	console.log("  notion setup-agents-sdk");
	showSetupInstructions();
}

async function main() {
	const args = process.argv.slice(2);
	if (isHelpCommand(args) || args.length === 0) {
		showHelpMessage();
		return;
	}
	const command = args[0];

	switch (command) {
		case "init": {
			const forceTS = args.includes("--ts");
			const forceJS = args.includes("--js");
			if (forceTS && forceJS) {
				console.error("❌ Cannot use both --ts and --js flags together");
				process.exit(1);
			}
			return initializeNotionConfigFile({
				force: forceTS ? "ts" : forceJS ? "js" : undefined,
			});
		}
		case "sync":
			return runSync();
		case "generate":
			console.warn("⚠️  `notion generate` is deprecated. Use `notion sync`.");
			return runSync();
		case "setup-agents-sdk": {
			const { runSetupAgentsSdk } = await import("./agents-sdk-setup");
			return runSetupAgentsSdk();
		}
		case "add": {
			const input = args[1];
			if (!input) {
				console.error("❌ Missing database id or Notion URL.");
				process.exit(1);
			}
			const typeIndex = args.indexOf("--type");
			const requestedType =
				typeIndex !== -1 && args[typeIndex + 1]
					? args[typeIndex + 1]
					: undefined;
			if (requestedType && requestedType !== "database") {
				console.error("❌ Invalid --type value. Must be 'database'");
				process.exit(1);
			}
			return runAdd(input);
		}
		default:
			showHelpMessage();
			return;
	}
}

main().catch((error: unknown) => {
	console.error("❌ Unexpected error:");
	console.error(error);
	process.exit(1);
});
