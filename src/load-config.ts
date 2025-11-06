import { pathToFileURL } from "url";

/**
 * Dynamically loads the user's notion.config file.
 * - Works with Bun (native TS support)
 * - Works with Node.js (ESM and CJS)
 * - Supports .ts, .js, .mjs config files
 */
export async function loadUserConfig(
  absolutePath: string
): Promise<any> {
  // Detect if we're running in Bun
  const isBun = typeof (globalThis as any).Bun !== "undefined";
  
  // 1) Try dynamic import first (works for Bun with .ts, Node with .js/.mjs)
  try {
    // For Bun, use direct import which handles TypeScript natively
    // For Node, convert to file URL for proper ESM loading
    const importPath = isBun ? absolutePath : pathToFileURL(absolutePath).href;
    const mod = await import(importPath);
    return mod.default ?? mod;
  } catch (err: any) {
    // If we're in Bun and it failed, throw immediately (Bun handles .ts natively)
    if (isBun) {
      throw new Error(
        `Failed to load config from ${absolutePath}: ${err.message}`
      );
    }
    
    // For Node.js, check if this is a recoverable error
    const recoverable =
      err.code === "ERR_MODULE_NOT_FOUND" ||
      err.code === "ERR_UNKNOWN_FILE_EXTENSION" ||
      err.message?.includes("Cannot use import") ||
      err.message?.includes("must use import") ||
      err.message?.includes("require() of ES modules") ||
      err.message?.includes("Unknown file extension");

    if (!recoverable) throw err;
  }

  // 2) Node.js fallback: try require() for CJS
  // Only attempt this in Node.js environment
  if (typeof require !== "undefined") {
    if (absolutePath.endsWith(".ts")) {
      // Register ts-node only when needed for Node.js
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        require("ts-node/register");
      } catch (tsNodeError: any) {
        if (tsNodeError.code === 'MODULE_NOT_FOUND') {
          throw new Error(
            `TypeScript config found but ts-node is not available. ` +
            `Please install ts-node: npm install -D ts-node`
          );
        }
        throw tsNodeError;
      }
    }
    
    try {
      // Clear require cache to ensure fresh config load (if it exists)
      if (require.cache[absolutePath]) {
        delete require.cache[absolutePath];
      }
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mod = require(absolutePath);
      return mod.default ?? mod;
    } catch (requireError: any) {
      throw new Error(`Failed to load config from ${absolutePath}: ${requireError.message}`);
    }
  }

  // If we get here, nothing worked
  throw new Error(
    `Failed to load config from ${absolutePath}. ` +
    `Please ensure the file exists and is properly formatted.`
  );
}
