#!/usr/bin/env bun

import {
  getNotionConfig,
  loadConfig,
  clearConfigCache,
} from "../config/loadConfig";
import { createDatabaseTypes } from "../ast/type-generation";
import {
  showSetupInstructions,
  validateAndGetUndashedUuid,
  writeConfigFileWithAST,
  isHelpCommand,
} from "./helpers";
import {
  findConfigFile,
  initializeNotionConfigFile,
  validateConfig,
} from "config/helpers";

async function runGenerate(): Promise<void> {
  try {
    // Validate the config (this validation is now redundant since
    // getNotionConfig does validation)
    await validateConfig();

    const { databaseNames } = await createDatabaseTypes({ type: "all" });

    if (databaseNames.length === 0) {
      console.log("⚠️  Generated no types");
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

async function runAdd(input: string): Promise<void> {
  const undashedUuid = validateAndGetUndashedUuid(input);

  if (!undashedUuid) {
    console.error("❌ Invalid input format");
    console.error("   Expected formats:");
    console.error(
      "   • Database ID: 12345678-1234-1234-1234-123456789abc (with or without dashes)"
    );
    console.error(
      "   • Notion URL: https://www.notion.so/workspace/c88c5ccf109f4e71937d5d3b3ddfeade?v=..."
    );
    process.exit(1);
  }

  const configFile = await findConfigFile();

  if (!configFile) {
    console.error(
      "❌ No config file found. Could not find a notion.config.(ts|js) in project root"
    );
    console.error("Run 'notion init' to create a config file first");
    process.exit(1);
  }

  console.log(
    `🔍 Found config: notion.config.${configFile.isTS ? "ts" : "js"}`
  );

  const config = await loadConfig(configFile.path);

  // Ensure databaseIds array exists
  if (!config.databaseIds) {
    config.databaseIds = [];
  }

  if (config.databaseIds.includes(undashedUuid)) {
    console.log(
      `⚠️  Database ID ${undashedUuid} is already in the configuration`
    );
    console.log("   Regenerating types for this database...");
  } else {
    // Use AST-based modification to preserve structure
    const wasModified = await writeConfigFileWithAST(
      configFile.path,
      undashedUuid,
      configFile.isTS
    );

    if (wasModified) {
      console.log(`🔗 Added database to config`);
    } else {
      console.log(
        `⚠️  Database ID '${undashedUuid}' already in the configuration`
      );
    }
  }

  // Clear the cached config so that createDatabaseTypes() loads the updated config
  clearConfigCache();

  // Generate types only for this database (incremental)
  const { databaseNames } = await createDatabaseTypes({
    type: "incremental",
    id: undashedUuid,
  });

  if (databaseNames.length > 0) {
    console.log(`✅ Completed schema generation for '${databaseNames[0]}'`);
  }

  console.log(
    "\n\n📄 Tip: In the future run `notion generate` to refresh all database schemas/types"
  );
}

function showHelperMessage(): void {
  console.log("📖 Notion ORM CLI");
  console.log("Usage:");
  console.log(
    "  notion init [--ts|--js]            - Create a starter notion.config file"
  );
  console.log(
    "  notion generate                    - Generate types from configured databases"
  );
  console.log(
    "  notion add <database-id-or-url>   - Add database to config and generate types"
  );
  console.log("\nExamples:");
  console.log("  notion add 12345678-1234-1234-1234-123456789abc");
  console.log("  notion add c88c5ccf109f4e71937d5d3b3ddfeade");
  console.log(
    "  notion add https://www.notion.so/workspace/c88c5ccf109f4e71937d5d3b3ddfeade?v=123"
  );
  console.log("  notion generate");
  showSetupInstructions();
}

async function main() {
  const args = process.argv.slice(2);

  // Handle help command

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
  } else if (args.length === 1 && args[0] === "generate") {
    return await runGenerate();
  } else if (args.length === 2 && args[0] === "add") {
    return await runAdd(args[1]);
  } else if (isHelpCommand(args)) {
    showHelperMessage();
    return;
  } else {
    // Invalid command - show usage
    showHelperMessage();
  }
}

main().catch((error: any) => {
  console.error("❌ Unexpected error:");
  console.error(error);
  process.exit(1);
});
