import { beforeAll, describe, expect, test } from "bun:test";
import { execSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

const repoRoot = join(import.meta.dir, "../..");
const builtCliPath = join(repoRoot, "build/src/cli/index.js");

beforeAll(() => {
	if (!existsSync(builtCliPath)) {
		execSync("npm run build", { cwd: repoRoot, stdio: "pipe" });
	}
});

function runCli(args: string[]) {
	// Use the `node` binary explicitly: under `bun test`, `process.execPath` is Bun,
	// which resolves the built CLI's imports differently than Node users.
	return spawnSync("node", [builtCliPath, ...args], {
		cwd: repoRoot,
		encoding: "utf-8",
		env: process.env,
	});
}

describe("CLI index integration", () => {
	test("prints help output for help command", () => {
		const output = runCli(["help"]);
		expect(output.status).toBe(0);
		expect(output.stdout).toContain("Notion ORM CLI");
	});

	test("help output includes setup-agents-sdk command", () => {
		const output = runCli(["help"]);
		expect(output.status).toBe(0);
		expect(output.stdout).toContain("setup-agents-sdk");
	});

	test("fails for invalid add type", () => {
		const output = runCli([
			"add",
			"12345678-1234-1234-1234-123456789abc",
			"--type",
			"agent",
		]);
		expect(output.status).toBe(1);
		expect(output.stderr).toContain(
			"Invalid --type value. Must be 'database'",
		);
	});

	test("fails when both --ts and --js are provided for init", () => {
		const output = runCli(["init", "--ts", "--js"]);
		expect(output.status).toBe(1);
		expect(output.stderr).toContain(
			"Cannot use both --ts and --js flags together",
		);
	});
});
