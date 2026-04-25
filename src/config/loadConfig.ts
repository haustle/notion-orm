import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { pathToFileURL } from "url";
import { findConfigFile } from "./findConfigFile.js";
import { loadDotEnvFromCwd } from "./loadDotEnvFromCwd";
import { NOTION_CONFIG_EXTENSION_LABELS } from "./notion-config-filenames.js";
import { notionConfigSchema, type NotionConfigType } from "./types";

let cachedConfig: NotionConfigType | undefined;

function getErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

/** Validates the user config at the ingestion boundary and returns a typed shape. */
function parseNotionConfig(input: unknown): NotionConfigType {
	const parseResult = notionConfigSchema.safeParse(input);
	if (!parseResult.success) {
		const details = parseResult.error.issues
			.map((issue) => {
				const pathLabel =
					issue.path.length > 0 ? issue.path.join(".") : "config";
				return `${pathLabel}: ${issue.message}`;
			})
			.join(", ");
		throw new Error(`Invalid notion config shape: ${details}`);
	}
	const data = parseResult.data;
	return {
		auth: data.auth,
		databases: data.databases,
		agents: data.agents,
	};
}

/**
 * Dynamically loads the user's notion.config file via `import()`.
 * Use a `file://` URL so Node, Bun, and other ESM runtimes resolve the path consistently.
 * Plain Node loads `.js`/`.mjs` natively. For `.ts`, we only support the
 * JS-compatible template emitted by `notion init --ts`, not arbitrary TS syntax.
 */
async function loadUserConfig(absolutePath: string): Promise<unknown> {
	try {
		if (path.extname(absolutePath) === ".ts") {
			return await loadJsCompatibleTsConfig(absolutePath);
		}
		const importPath = pathToFileURL(absolutePath).href;
		const mod = await import(importPath);
		return mod.default ?? mod;
	} catch (error: unknown) {
		throw new Error(
			`Failed to load config from '${absolutePath}': ${getErrorMessage(error)}`,
		);
	}
}

/**
 * `notion init --ts` emits JS-compatible source with a `.ts` extension.
 * Keep the real project-relative module resolution by mirroring that source to a
 * temporary sibling `.mjs` file for import under plain Node.
 */
async function loadJsCompatibleTsConfig(absolutePath: string): Promise<unknown> {
	const configSource = await fs.readFile(absolutePath, "utf8");
	const runtimePath = path.join(
		path.dirname(absolutePath),
		`${path.basename(absolutePath, ".ts")}.runtime-${randomUUID()}.mjs`,
	);
	try {
		await fs.writeFile(runtimePath, configSource);
		try {
			const importPath = pathToFileURL(runtimePath).href;
			const mod = await import(importPath);
			return mod.default ?? mod;
		} catch (error: unknown) {
			throw new Error(
				"Plain Node only supports JS-compatible notion.config.ts files " +
					"(like the template emitted by `notion init --ts`). " +
					getErrorMessage(error),
			);
		}
	} finally {
		await fs.rm(runtimePath, { force: true });
	}
}

/** Loads and validates a user config module from a known path. */
export async function loadConfig(
	configPath: string,
): Promise<NotionConfigType> {
	try {
		loadDotEnvFromCwd();
		const config = await loadUserConfig(configPath);
		return parseNotionConfig(config);
	} catch (error: unknown) {
		throw new Error(
			`Failed to load config from ${configPath}: ${getErrorMessage(error)}`,
		);
	}
}

/**
 * Resolves config once per process, falling back to environment variables when
 * no config file is present. This keeps CLI calls fast while preserving a
 * single trust boundary for config validation.
 */
export async function getNotionConfig(): Promise<NotionConfigType> {
	if (cachedConfig) {
		return cachedConfig;
	}

	loadDotEnvFromCwd();

	// Try to find config file
	const configFile = findConfigFile();

	if (!configFile) {
		// Fallback to environment variable
		const authFromEnv = process.env.NOTION_KEY;
		if (authFromEnv) {
			const config = parseNotionConfig({
				auth: authFromEnv,
				databases: [],
				agents: [],
			});
			cachedConfig = config;
			return config;
		}

		throw new Error(
			`No notion.config.${NOTION_CONFIG_EXTENSION_LABELS} file found and no NOTION_KEY environment variable set. ` +
				"Please create a config file or set NOTION_KEY.",
		);
	}

	const config = await loadConfig(configFile.path);

	cachedConfig = config;
	return config;
}

// Clear cache (useful for testing or config updates)
export function clearConfigCache(): void {
	cachedConfig = undefined;
}
