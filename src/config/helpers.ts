import { shouldUseTypeScript, showSetupInstructions } from "cli/helpers";
import path from "path";
import fs from "fs";
import { createConfigTemplate } from "cli/helpers";
import { getNotionConfig } from "./loadConfig";

export type NotionConfigType = {
  auth: string;
  databases: string[];
  agents: string[];
};

// Config validation function
export async function validateConfig(): Promise<void> {
  const config = await getNotionConfig();

  if (!config) {
    console.error("❌ Config file is empty or invalid");
    showSetupInstructions();
    process.exit(1);
  }

  if (!config.auth) {
    console.error("❌ Missing 'auth' field in config");
    console.error("   Please add your Notion integration token");
    showSetupInstructions();
    process.exit(1);
  }

  if (!config.databases) {
    console.error("❌ Missing 'databases' field in config");
    showSetupInstructions();
    process.exit(1);
  }

  if (!Array.isArray(config.databases)) {
    console.error("❌ 'databases' must be an array");
    showSetupInstructions();
    process.exit(1);
  }

  if (!config.agents) {
    console.error("❌ Missing 'agents' field in config");
    showSetupInstructions();
    process.exit(1);
  }

  if (!Array.isArray(config.agents)) {
    console.error("❌ 'agents' must be an array");
    showSetupInstructions();
    process.exit(1);
  }
}

export async function initializeNotionConfigFile(
  options: { force?: "ts" | "js" } = {}
): Promise<void> {
  const existingConfig = await findConfigFile();

  if (existingConfig) {
    console.log("⚠️  A notion.config file already exists:");
    console.log(`   Found ${path.basename(existingConfig.path)}`);
    console.log(
      "   Skipping init. Use that file or remove it before re-running init."
    );
    return;
  }

  const isTS =
    options.force === "ts" || (options.force !== "js" && shouldUseTypeScript());
  const filename = isTS ? "notion.config.ts" : "notion.config.js";
  const configPath = path.join(process.cwd(), filename);

  if (fs.existsSync(configPath)) {
    console.log("⚠️  Config file already exists at:");
    console.log(`   ${configPath}`);
    console.log(
      "   Skipping init. Remove the file if you want to regenerate it."
    );
    return;
  }

  try {
    fs.writeFileSync(configPath, createConfigTemplate(isTS));
    console.log(
      `✅ Created ${filename} (${isTS ? "TypeScript" : "JavaScript"})`
    );
    console.log("   Next steps:");
    console.log(
      "   • Add your NOTION_KEY to a .env.local file (or export it in your shell)"
    );
    console.log(
      "   • Use `notion add <data-source-id or URL>` to append databases"
    );
    console.log("   • Run `notion generate` to build local types");
  } catch (error: unknown) {
    console.error("❌ Error creating config file:");
    console.error(error);
    process.exit(1);
  }
}

export function findConfigFile():
  | {
      path: string;
      isTS: boolean;
    }
  | undefined {
  const projDir = process.cwd();
  const notionConfigPathJS = path.join(projDir, "notion.config.js");
  const notionConfigPathTS = path.join(projDir, "notion.config.ts");

  if (fs.existsSync(notionConfigPathJS)) {
    return { path: notionConfigPathJS, isTS: false };
  }
  if (fs.existsSync(notionConfigPathTS)) {
    return { path: notionConfigPathTS, isTS: true };
  }
  return undefined;
}
