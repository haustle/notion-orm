import fs from "fs";
import path from "path";
import { findConfigFile } from "./findConfigFile";
import {
	createConfigTemplate,
	shouldUseTypeScript,
	showSetupInstructions,
} from "./init";
import { NOTION_CONFIG_FILENAMES } from "./notion-config-filenames";
import { getNotionConfig } from "./loadConfig";

/** Filename used by `notion init` when creating a new config file. */
function getNotionConfigInitFilename(isTS: boolean): string {
	return isTS ? NOTION_CONFIG_FILENAMES.ts : NOTION_CONFIG_FILENAMES.js;
}

/** Verifies that config can be resolved and parsed before running CLI commands. */
export async function validateConfig(): Promise<void> {
	try {
		await getNotionConfig();
	} catch (error: unknown) {
		console.error("❌ Invalid notion config");
		if (error instanceof Error) {
			console.error(`   ${error.message}`);
		}
		showSetupInstructions();
		process.exit(1);
	}
}

/** Creates a starter config file unless one already exists in the project root. */
export async function initializeNotionConfigFile(
	options: { force?: "ts" | "js" } = {},
): Promise<void> {
	const existingConfig = findConfigFile();

	if (existingConfig) {
		console.log("⚠️  A notion.config file already exists:");
		console.log(`   Found ${path.basename(existingConfig.path)}`);
		console.log(
			"   Skipping init. Use that file or remove it before re-running init.",
		);
		return;
	}

	const isTS =
		options.force === "ts" || (options.force !== "js" && shouldUseTypeScript());
	const filename = getNotionConfigInitFilename(isTS);
	const configPath = path.join(process.cwd(), filename);

	if (fs.existsSync(configPath)) {
		console.log("⚠️  Config file already exists at:");
		console.log(`   ${configPath}`);
		console.log(
			"   Skipping init. Remove the file if you want to regenerate it.",
		);
		return;
	}

	try {
		fs.writeFileSync(configPath, createConfigTemplate(isTS));
		console.log(
			`✅ Created ${filename} (${isTS ? "TypeScript" : "JavaScript"})`,
		);
		console.log("   Next steps:");
		console.log(
			"   • Add your NOTION_KEY to a .env file (or export it in your shell)",
		);
		console.log(
			"   • Use `notion add <data-source-id or URL>` to append databases",
		);
		console.log("   • Run `notion sync` to build local types");
	} catch (error: unknown) {
		console.error("❌ Error creating config file:");
		console.error(error);
		process.exit(1);
	}
}
