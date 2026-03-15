import path from "path";
import fs from "fs";
import { getNotionConfig } from "./loadConfig";

export type NotionConfigType = {
  auth: string;
  databases: Record<string, string>;
  /** Output directory for generated files, relative to project root. Defaults to "generated/notion-orm" */
  outputDir?: string;
};

export async function validateConfig(): Promise<void> {
  const config = await getNotionConfig();
  if (!config.auth) throw new Error("Integration key not found. Add NOTION_API_KEY to your env or notion.config.ts");
  if (!config.databases || Object.keys(config.databases).length === 0)
    throw new Error("'databases' must be a non-empty object in notion.config.ts");
}

export function findConfigFile(): { path: string; isTS: true } | undefined {
  const configPath = path.join(process.cwd(), "notion.config.ts");
  if (fs.existsSync(configPath)) return { path: configPath, isTS: true };
  return undefined;
}

export async function initializeNotionConfigFile(): Promise<"created" | "exists"> {
  if (findConfigFile()) return "exists";

  const configPath = path.join(process.cwd(), "notion.config.ts");
  const template = `import type { NotionConfigType } from "@elumixor/notion-orm";

export default {
  auth: process.env.NOTION_API_KEY ?? "",
  databases: {
    // Add databases here, e.g.:
    // tasks: "2ec26381fbfd80f78a11ceed660e9a07"
  },
} satisfies NotionConfigType;
`;
  fs.writeFileSync(configPath, template);
  return "created";
}
