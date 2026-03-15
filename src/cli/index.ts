#!/usr/bin/env bun

import ora from "ora";
import { loadConfig, clearConfigCache } from "../config/loadConfig";
import { createDatabaseTypes } from "../ast/generate-databases-cli";
import { validateAndGetUndashedUuid, writeConfigFileWithAST, isHelpCommand } from "./helpers";
import { findConfigFile, initializeNotionConfigFile, validateConfig } from "config/helpers";

async function runGenerate(): Promise<void> {
  await validateConfig();

  const spinner = ora().start();

  const { databaseNames } = await createDatabaseTypes({ type: "all" }, {
    onDbStart: (name) => { spinner.start(name); },
    onDbSuccess: (name) => { spinner.succeed(name); },
    onDbError: (name, error) => {
      spinner.fail(name);
      console.error(error);
    },
  });

  spinner.stop();

  if (databaseNames.length === 0) {
    console.log("No schemas generated.");
  } else {
    console.log(`\nGenerated ${databaseNames.length} schema${databaseNames.length === 1 ? "" : "s"}.`);
  }
}

async function runAdd(name: string, input: string): Promise<void> {
  const undashedUuid = validateAndGetUndashedUuid(input);
  if (!undashedUuid) {
    ora().fail("Invalid database ID or URL format");
    process.exit(1);
  }

  const configFile = findConfigFile();
  if (!configFile) {
    ora().fail("No notion.config.ts found. Run `notion init` first.");
    process.exit(1);
  }

  const config = await loadConfig(configFile.path);
  const existing = config.databases ?? {};

  if (Object.values(existing).includes(undashedUuid)) {
    ora().info("Database ID already in config — regenerating types...");
  } else {
    const wasModified = writeConfigFileWithAST(configFile.path, name, undashedUuid);
    if (wasModified) ora().succeed("Added database to config");
  }

  clearConfigCache();

  const spinner = ora().start();

  await createDatabaseTypes({ type: "incremental", name, id: undashedUuid }, {
    onDbStart: (n) => { spinner.start(n); },
    onDbSuccess: (n) => { spinner.succeed(n); },
    onDbError: (n, error) => {
      spinner.fail(n);
      console.error(error);
    },
  });

  spinner.stop();
  console.log("\nRun `notion generate` to refresh all schemas.");
}

function showHelp(): void {
  console.log(`
Notion ORM CLI

Usage:
  notion init                              Create notion.config.ts
  notion generate                          Generate types for all configured databases
  notion add <name> <database-id-or-url>   Add a database and generate its types
`);
}

async function main() {
  const args = process.argv.slice(2);

  if (args[0] === "init") {
    const result = await initializeNotionConfigFile();
    if (result === "exists") ora().warn("notion.config.ts already exists");
    else ora().succeed("Created notion.config.ts");
    return;
  }

  if (args[0] === "generate") {
    try {
      await runGenerate();
    } catch (error) {
      ora().fail(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
    return;
  }

  if (args[0] === "add" && args[1] && args[2]) {
    try {
      await runAdd(args[1], args[2]);
    } catch (error) {
      ora().fail(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
    return;
  }

  if (isHelpCommand(args)) return showHelp();

  showHelp();
}

main().catch((error: unknown) => {
  ora().fail(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
