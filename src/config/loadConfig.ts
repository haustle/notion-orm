import { pathToFileURL } from "url";
import { z } from "zod";
import type { NotionConfigType } from "./helpers";
import { findConfigFile } from "./helpers.js";

let cachedConfig: NotionConfigType | undefined;

const notionConfigSchema = z.object({
	auth: z.string().min(1, "Missing 'auth' field in notion config"),
	databases: z.array(z.string()),
	agents: z.array(z.string()),
});

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
 * Dynamically loads the user's notion.config file.
 * - Works with Bun (native TS support)
 * - Works with Node.js (ESM and CJS)
 * - Supports .ts, .js, .mjs config files
 */
export async function loadUserConfig(absolutePath: string): Promise<unknown> {
	const isBun = "Bun" in globalThis;

	// 1) Try dynamic import first (works for Bun with .ts, Node with .js/.mjs)
	try {
		const importPath = isBun ? absolutePath : pathToFileURL(absolutePath).href;
		const mod = await import(importPath);
		return mod.default ?? mod;
	} catch (error: unknown) {
		throw new Error(
			`Failed to load config from '${absolutePath}': ${getErrorMessage(error)}`,
		);
	}
}

/** Loads and validates a user config module from a known path. */
export async function loadConfig(configPath: string): Promise<NotionConfigType> {
		try {
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

	// Try to find config file
	const configFile = findConfigFile();

	if (!configFile) {
		// Fallback to environment variable
		const authFromEnv = process.env.NOTION_KEY;
		if (authFromEnv) {
			const databases: string[] = [];
			const agents: string[] = [];
			const config: NotionConfigType = {
				auth: authFromEnv,
				databases,
				agents,
			};
			cachedConfig = config;
			return config;
		}

		throw new Error(
			"No notion.config.js/ts/mjs file found and no NOTION_KEY environment variable set. " +
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
