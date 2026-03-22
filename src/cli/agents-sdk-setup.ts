import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import {
	AGENTS_SDK_REPO_URL,
	isAgentsSdkAvailable,
} from "../agents-sdk-resolver";

type PackageManager = "bun" | "npm" | "pnpm" | "yarn";

const CACHE_DIR_NAME = ".notion-agents-sdk";

function getCacheDir(): string {
	return path.join(
		process.cwd(),
		"node_modules",
		".cache",
		CACHE_DIR_NAME,
	);
}

function detectPackageManager(): PackageManager {
	const cwd = process.cwd();
	if (
		fs.existsSync(path.join(cwd, "bun.lockb")) ||
		fs.existsSync(path.join(cwd, "bun.lock"))
	) {
		return "bun";
	}
	if (fs.existsSync(path.join(cwd, "pnpm-lock.yaml"))) {
		return "pnpm";
	}
	if (fs.existsSync(path.join(cwd, "yarn.lock"))) {
		return "yarn";
	}
	if (fs.existsSync(path.join(cwd, "package-lock.json"))) {
		return "npm";
	}
	const userAgent = process.env.npm_config_user_agent ?? "";
	if (userAgent.includes("bun")) {
		return "bun";
	}
	if (userAgent.includes("pnpm")) {
		return "pnpm";
	}
	if (userAgent.includes("yarn")) {
		return "yarn";
	}
	return "npm";
}

function getAddCommand(
	pm: PackageManager,
	packagePath: string,
): { cmd: string; args: string[] } {
	switch (pm) {
		case "bun":
			return { cmd: "bun", args: ["add", packagePath] };
		case "pnpm":
			return { cmd: "pnpm", args: ["add", packagePath] };
		case "yarn":
			return { cmd: "yarn", args: ["add", packagePath] };
		case "npm":
			return { cmd: "npm", args: ["install", packagePath] };
	}
}

function run(
	cmd: string,
	args: string[],
	cwd: string,
	options?: { silent?: boolean },
): boolean {
	const result = spawnSync(cmd, args, {
		cwd,
		stdio: options?.silent ? "ignore" : "inherit",
	});
	return result.status === 0;
}

export async function runSetupAgentsSdk(): Promise<void> {
	const cacheDir = getCacheDir();
	const isUpdate =
		fs.existsSync(cacheDir) &&
		fs.existsSync(path.join(cacheDir, ".git"));
	const pm = detectPackageManager();

	console.log(
		isUpdate
			? "🔄 Updating Notion Agents SDK..."
			: "📦 Installing Notion Agents SDK...",
	);

	if (isUpdate) {
		console.log("   Pulling latest changes...");
		if (!run("git", ["pull", "--ff-only"], cacheDir)) {
			console.error(
				"❌ Failed to pull latest changes. Try removing the cache and rerunning:",
			);
			console.error(`   rm -rf ${cacheDir}`);
			console.error("   notion setup-agents-sdk");
			process.exit(1);
		}
	} else {
		console.log("   Cloning repository...");
		fs.mkdirSync(path.dirname(cacheDir), { recursive: true });
		if (
			!run("git", ["clone", AGENTS_SDK_REPO_URL, cacheDir], process.cwd())
		) {
			console.error(
				"❌ Failed to clone the Notion Agents SDK repository.",
			);
			console.error(
				"   Ensure you have git installed and can access:",
			);
			console.error(`   ${AGENTS_SDK_REPO_URL}`);
			process.exit(1);
		}
	}

	console.log("   Installing SDK dependencies...");
	if (!run("npm", ["install"], cacheDir)) {
		console.error("❌ Failed to install SDK dependencies.");
		process.exit(1);
	}

	console.log("   Building SDK...");
	if (!run("npm", ["run", "build"], cacheDir)) {
		console.error("❌ Failed to build the SDK.");
		process.exit(1);
	}

	console.log(`   Adding to project (${pm})...`);
	const { cmd, args } = getAddCommand(pm, cacheDir);
	if (!run(cmd, args, process.cwd())) {
		console.error("❌ Failed to install the SDK into your project.");
		process.exit(1);
	}

	if (!isAgentsSdkAvailable()) {
		console.error(
			"❌ Installation completed but the SDK could not be resolved.",
		);
		console.error("   Try deleting node_modules and reinstalling.");
		process.exit(1);
	}

	console.log("");
	console.log("✅ Notion Agents SDK installed successfully.");
	console.log("   Next step: run `notion sync` to generate agent types.");
}
