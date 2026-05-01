#!/usr/bin/env node
// Node shebang: `notion` bin must run under Node (see `engines.node`) so `npx notion` works without Bun.

import fs from "fs";
import { Client } from "@notionhq/client";
import { initializeNotionConfigFile, validateConfig } from "../config/helpers";
import { findConfigFile } from "../config/findConfigFile";
import { showSetupInstructions } from "../config/init";
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
import { isAgentsSdkAvailable } from "../agents-sdk-resolver";
import type {
	CodegenDiagnostic,
	CodegenDiagnosticSink,
} from "../ast/shared/codegen-diagnostics";
import {
	readAgentMetadataFromDisk,
	readDatabaseMetadata,
} from "../ast/shared/cached-metadata";
import { clearNotionCodegenOutputForSync } from "../ast/shared/clear-notion-codegen-output";
import { updateSourceIndexFile } from "../ast/shared/emit/orm-index-emitter";
import {
	clearConfigCache,
	getNotionConfig,
	loadConfig,
} from "../config/loadConfig";
import { toDashedNotionId, toUndashedNotionId } from "../helpers";
import { PACKAGE_RUNTIME_CONSTANTS } from "../runtime-constants";
import {
	isHelpCommand,
	validateAndGetUndashedNotionId,
	writeConfigFileWithAST,
} from "./helpers";
import { SyncProgressRenderer } from "./sync-progress-renderer";
import { SyncProgressState } from "./sync-progress";
import { logSyncReport } from "./sync-report";

import { pushNewSchemas } from "./push/push-schemas";

function exitWithError(message: string, error: unknown): never {
	console.error(message);
	console.error(error);
	process.exit(1);
}

/** Runs agent and database generation in parallel, then refreshes the root index once. */
async function runSync(options?: { noPush?: boolean }): Promise<void> {
	const diagnostics: CodegenDiagnostic[] = [];
	const onDiagnostic: CodegenDiagnosticSink = (d) => {
		diagnostics.push(d);
	};

	const progressState = new SyncProgressState();
	const renderer = new SyncProgressRenderer(
		Boolean(process.stdout.isTTY),
		() => progressState.getSnapshot(),
	);
	let rendererStarted = false;
	try {
		await validateConfig();

		if (!options?.noPush) {
			const configUpdated = await pushNewSchemas();
			if (configUpdated) {
				// Clear cache so the newly pushed database IDs are loaded for generation
				clearConfigCache();
			}
		}

		const previousOnDisk = {
			databases: readDatabaseMetadata(),
			agents: readAgentMetadataFromDisk(),
		};

		const config = await getNotionConfig();
		progressState.bootstrap({
			databaseCount: config.databases.length,
			agentsSdkSkipped: !isAgentsSdkAvailable(),
		});

		renderer.start();
		rendererStarted = true;
		// Replace generated database/agent modules and root index artifacts. Preserves
		// `notion/schemas/` (push inputs). Incremental `notion add` does not run this.
		clearNotionCodegenOutputForSync({
			environment: resolveCodegenEnvironment({
				configRuntime: findConfigFile(),
			}),
		});

		const agentsPromise: Promise<CreateAgentTypesResult> = createAgentTypes({
			skipSourceIndexUpdate: true,
			onProgress: ({ completed, total }) => {
				progressState.applyAgentsProgress(completed, total);
			},
			onDiagnostic,
		});

		const databasesPromise = createDatabaseTypes({
			type: "all",
			skipSourceIndexUpdate: true,
			onProgress: ({ completed, total }) => {
				progressState.applyDatabasesProgress(completed, total);
			},
			onDiagnostic,
		});

		const [agentsResult, databasesResult] = await Promise.all([
			agentsPromise,
			databasesPromise,
		]);

		progressState.finalizeAgents({
			skipped: agentsResult.skipped,
			successCount: agentsResult.agentNames.length,
			totalListed: agentsResult.totalAgentsListed,
			failureCount: agentsResult.generationFailureCount,
		});

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

		logSyncReport({
			databasesResult: databasesResult,
			agentsResult,
			diagnostics,
			previousOnDisk,
			configFile: findConfigFile(),
		});
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
			notionVersion: PACKAGE_RUNTIME_CONSTANTS.NOTION_API_VERSION,
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
		"  notion sync [--no-push]                    - Sync types for all databases and agents",
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
		case "sync": {
			const noPush = args.includes("--no-push");
			return runSync({ noPush });
		}
		case "generate":
			console.warn("⚠️  `notion generate` is deprecated. Use `notion sync`.");
			return runSync({ noPush: true });
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
