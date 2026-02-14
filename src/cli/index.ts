#!/usr/bin/env bun

import { Client } from "@notionhq/client";
import {
	findConfigFile,
	initializeNotionConfigFile,
	validateConfig,
} from "config/helpers";
import { createAgentTypes } from "../ast/agents/generate-agents-cli";
import { createDatabaseTypes } from "../ast/database/generate-databases-cli";
import { AST_RUNTIME_CONSTANTS } from "../ast/shared/constants";
import { clearConfigCache, loadConfig } from "../config/loadConfig";
import {
	isHelpCommand,
	showSetupInstructions,
	validateAndGetUndashedUuid,
	writeConfigFileWithAST,
} from "./helpers";

async function runGenerate(): Promise<void> {
	try {
		await validateConfig();

		console.log("🤖 Generating agent types...");
		const { agentNames } = await createAgentTypes();

		if (agentNames.length === 0) {
			console.log("⚠️  Generated no agent types");
		} else {
			console.log("✅ Generated types for the following agents:");
			for (let x = 0; x < agentNames.length; x++) {
				console.log(`   ${x + 1}. ${agentNames[x]}`);
			}
		}

		console.log("\n📊 Generating database types...");
		const { databaseNames } = await createDatabaseTypes({ type: "all" });

		if (databaseNames.length === 0) {
			console.log("⚠️  Generated no database types");
		} else {
			console.log("✅ Generated types for the following databases:");
			for (let x = 0; x < databaseNames.length; x++) {
				console.log(`   ${x + 1}. ${databaseNames[x]}`);
			}
		}
	} catch (error) {
		console.error("❌ Error generating types:");
		console.error(error);
		process.exit(1);
	}
}

async function runAdd(input: string, entityType?: "database"): Promise<void> {
	const undashedUuid = validateAndGetUndashedUuid(input);

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

	const type = entityType || "database";

	const configFile = await findConfigFile();

	if (!configFile) {
		console.error(
			"❌ No config file found. Could not find a notion.config.(ts|js) in project root",
		);
		console.error("Run 'notion init' to create a config file first");
		process.exit(1);
	}

	console.log(
		`🔍 Found config: notion.config.${configFile.isTS ? "ts" : "js"}`,
	);

	clearConfigCache();
	const config = await loadConfig(configFile.path);

	if (type === "database") {
		if (!config.databases) {
			config.databases = [];
		}

		let databaseName: string | undefined;
		try {
			const client = new Client({
				auth: config.auth,
				notionVersion: AST_RUNTIME_CONSTANTS.NOTION_API_VERSION,
			});
			const databaseObject = await client.dataSources.retrieve({
				data_source_id: undashedUuid,
			});
			databaseName =
				"title" in databaseObject && databaseObject.title?.[0]?.plain_text
					? databaseObject.title[0].plain_text
					: undefined;
		} catch {
			console.log(
				"⚠️  Could not fetch database name, continuing without comment",
			);
		}

		if (config.databases.includes(undashedUuid)) {
			console.log(
				`⚠️  Database ID ${undashedUuid} is already in the configuration`,
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
				console.log(`🔗 Added database to config`);
			} else {
				console.log(
					`⚠️  Database ID '${undashedUuid}' already in the configuration`,
				);
			}
		}

		clearConfigCache();

		const { databaseNames } = await createDatabaseTypes({
			type: "incremental",
			id: undashedUuid,
		});

		if (databaseNames.length > 0) {
			console.log(`✅ Completed schema generation for '${databaseNames[0]}'`);
		}

		console.log(
			"\n\n📄 Tip: In the future run `notion generate` to refresh all database schemas/types",
		);
	}
}

function showHelperMessage(): void {
	console.log("📖 Notion ORM CLI");
	console.log("Usage:");
	console.log(
		"  notion init [--ts|--js]                    - Create a starter notion.config file",
	);
	console.log(
		"  notion generate                                - Generate types for all databases and agents",
	);
	console.log(
		"  notion add <id-or-url> [--type database]  - Add database to config and generate types",
	);
	console.log("\nExamples:");
	console.log(
		"  notion add 12345678-1234-1234-1234-123456789abc --type database",
	);
	console.log(
		"  notion add https://www.notion.so/workspace/c88c5ccf109f4e71937d5d3b3ddfeade?v=123",
	);
	console.log("  notion generate");
	showSetupInstructions();
}

async function main() {
	const args = process.argv.slice(2);

	if (args.length >= 1 && args[0] === "init") {
		const forceTS = args.includes("--ts");
		const forceJS = args.includes("--js");

		if (forceTS && forceJS) {
			console.error("❌ Cannot use both --ts and --js flags together");
			process.exit(1);
		}

		return await initializeNotionConfigFile({
			force: forceTS ? "ts" : forceJS ? "js" : undefined,
		});
	} else if (args.length >= 1 && args[0] === "generate") {
		return await runGenerate();
	} else if (args.length >= 2 && args[0] === "add") {
		const typeIndex = args.indexOf("--type");
		const type =
			typeIndex !== -1 && args[typeIndex + 1]
				? (args[typeIndex + 1] as "database")
				: undefined;
		if (type && type !== "database") {
			console.error("❌ Invalid --type value. Must be 'database'");
			process.exit(1);
		}
		return await runAdd(args[1], type);
	} else if (isHelpCommand(args)) {
		showHelperMessage();
		return;
	} else {
		showHelperMessage();
	}
}

main().catch((error: unknown) => {
	console.error("❌ Unexpected error:");
	console.error(error);
	process.exit(1);
});
