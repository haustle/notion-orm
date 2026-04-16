import fs from "fs";
import path from "path";

const AGENTS_SDK_PACKAGE = "@notionhq/agents-client";

export const AGENTS_SDK_SETUP_COMMAND = "notion setup-agents-sdk";

export const AGENTS_SDK_REPO_URL =
	"https://github.com/makenotion/notion-agents-sdk-js.git";

const AGENTS_SDK_MISSING_MESSAGE =
	`Agent support requires the Notion Agents SDK (paid feature).\n` +
	`Run \`${AGENTS_SDK_SETUP_COMMAND}\` to install it, then run \`notion sync\`.`;

/** Filesystem probe instead of `createRequire` for Bun + Node compatibility. */
export function isAgentsSdkAvailable(): boolean {
	const sdkPackageJson = path.join(
		process.cwd(),
		"node_modules",
		...AGENTS_SDK_PACKAGE.split("/"),
		"package.json",
	);
	return fs.existsSync(sdkPackageJson);
}

export async function loadAgentsSdk(): Promise<
	typeof import("@notionhq/agents-client")
> {
	if (!isAgentsSdkAvailable()) {
		throw new Error(AGENTS_SDK_MISSING_MESSAGE);
	}
	return import(AGENTS_SDK_PACKAGE);
}

/** Inlined so `AgentClient.getAgentResponse` works without eagerly importing the SDK. */
export function stripLangTags(text: string): string {
	return text.replace(/<\/?lang[^>]*>/g, "");
}
