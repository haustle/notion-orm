import fs from "fs";
import path from "path";
import { NotionConfigType } from "./types";

let cachedConfig: NotionConfigType | null = null;

export async function findConfigFile(): Promise<{ path: string; isTS: boolean } | null> {
	const projDir = process.cwd();
	const notionConfigPathJS = path.join(projDir, "notion.config.js");
	const notionConfigPathTS = path.join(projDir, "notion.config.ts");
	
	if (fs.existsSync(notionConfigPathJS)) {
		return { path: notionConfigPathJS, isTS: false };
	}
	if (fs.existsSync(notionConfigPathTS)) {
		return { path: notionConfigPathTS, isTS: true };
	}
	return null;
}

export async function loadConfig(configPath: string, isTS: boolean): Promise<NotionConfigType> {
	try {
		if (isTS) {
					// Only register ts-node in Node.js environments and avoid webpack static analysis
		if (typeof (globalThis as any).window === 'undefined' && typeof process !== 'undefined') {
				try {
					// Use dynamic require to prevent webpack from analyzing this dependency
					const tsNodePath = 'ts-node/register';
					const dynamicRequire = new Function('moduleName', 'return require(moduleName)');
					dynamicRequire(tsNodePath);
				} catch (error: any) {
					throw new Error(
						`TypeScript config found but ts-node failed to load. ` +
						`Consider using a .js config file instead, or ensure ts-node is properly installed. ` +
						`Error: ${error?.message || error}`
					);
				}
			} else {
				throw new Error('TypeScript config files are not supported in browser environments');
			}
		}
		
		// Clear require cache to ensure fresh config load
		if (require.cache[configPath]) {
			delete require.cache[configPath];
		}
		
		let config = require(configPath);
		
		// Extract default export if it exists (for TypeScript configs)
		if (config && config.default) {
			config = config.default;
		}
		
		return config;
	} catch (error: any) {
		throw new Error(`Failed to load config from ${configPath}: ${error.message}`);
	}
}

export async function getNotionConfig(): Promise<NotionConfigType> {
	// Return cached config if available
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
				databaseIds: [] // You might want to handle this differently
			};
			cachedConfig = config;
			return config;
		}
		
		throw new Error(
			"No notion.config.js/ts file found and no NOTION_AUTH environment variable set. " +
			"Please create a config file or set the NOTION_AUTH environment variable."
		);
	}

	const config = await loadConfig(configFile.path, configFile.isTS);
	
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
	cachedConfig = null;
} 