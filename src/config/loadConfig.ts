import { pathToFileURL } from "url";
import { NotionConfigType } from "./helpers";
import { findConfigFile } from "./helpers.js";

let cachedConfig: NotionConfigType | undefined = undefined;

/**
 * Dynamically loads the user's notion.config file.
 * - Works with Bun (native TS support)
 * - Works with Node.js (ESM and CJS)
 * - Supports .ts, .js, .mjs config files
 */
export async function loadUserConfig(absolutePath: string): Promise<any> {
  // Detect if we're running in Bun
  const isBun = typeof (globalThis as any).Bun !== "undefined";

  // 1) Try dynamic import first (works for Bun with .ts, Node with .js/.mjs)
  try {
    // For Bun, use direct import which handles TypeScript natively
    // For Node, convert to file URL for proper ESM loading
    const importPath = isBun ? absolutePath : pathToFileURL(absolutePath).href;
    const mod = await import(importPath);
    return mod.default ?? mod;
  } catch (err) {
    throw new Error(
      `Failed to load config from '${absolutePath}': \n       ${err}`
    );
  }
}

export async function loadConfig(
  configPath: string
): Promise<NotionConfigType> {
  try {
    const config = await loadUserConfig(configPath);
    return config;
  } catch (error: any) {
    throw new Error(
      `Failed to load config from ${configPath}: ${error.message}`
    );
  }
}

export async function getNotionConfig(): Promise<NotionConfigType> {
  if (cachedConfig) {
    return cachedConfig;
  }

  // Try to find config file
  const configFile = await findConfigFile();

  if (!configFile) {
    // Fallback to environment variable
    const authFromEnv = process.env.NOTION_AUTH || process.env.NOTION_KEY;
    if (authFromEnv) {
      const config = {
        auth: authFromEnv,
        databases: [],
        agents: [],
      };
      cachedConfig = config;
      return config;
    }

    throw new Error(
      "No notion.config.js/ts file found and no NOTION_AUTH environment variable set. " +
        "Please create a config file or set the NOTION_AUTH environment variable."
    );
  }

  const config = await loadConfig(configFile.path);

  // Validate config
  if (!config.auth) {
    throw new Error("Missing 'auth' field in notion config");
  }

  // Cache the config
  cachedConfig = config;
  return config;
}

// Clear cache (useful for testing or config updates)
export function clearConfigCache(): void {
  cachedConfig = undefined;
}
