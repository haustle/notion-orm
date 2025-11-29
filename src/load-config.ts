import { pathToFileURL } from "url";

/**
 * Dynamically loads the user's notion.config file.
 * – tries `import()` first  (Bun & Node-ESM happy)
 * – falls back to `require()` (Node-CJS happy)
 * – auto-registers ts-node for .ts files when using `require()`
 */
export async function loadUserConfig(
  absolutePath: string
): Promise<any> {
  // 1) try import() – works for .js, .mjs and transpiled .ts
  try {
    // Use dynamic import with explicit function to avoid TS compilation issues
    const dynamicImport = new Function('specifier', 'return import(specifier)');
    const mod = await dynamicImport(pathToFileURL(absolutePath).href);
    return mod.default ?? mod;
  } catch (err: any) {
    const recoverable =
      err.code === "ERR_MODULE_NOT_FOUND" ||
      err.message?.includes("Cannot use import") ||
      err.message?.includes("must use import") ||
      err.message?.includes("require() of ES modules");

    if (!recoverable) throw err;
  }

  // 2) fallback to require()
  if (absolutePath.endsWith(".ts")) {
    // register ts-node only when needed
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
