import {
	afterEach,
	beforeEach,
	describe,
	expect,
	test,
} from "bun:test";
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { clearNotionCodegenOutputForSync } from "../../../src/ast/shared/clear-notion-codegen-output";

describe("clearNotionCodegenOutputForSync", () => {
	const prevCwd = process.cwd();
	let tempDir: string;

	beforeEach(() => {
		tempDir = mkdtempSync(join(tmpdir(), "notion-clear-"));
		process.chdir(tempDir);
	});

	afterEach(() => {
		process.chdir(prevCwd);
		rmSync(tempDir, { recursive: true, force: true });
	});

	test("removes databases, agents, root index; preserves notion/schemas", () => {
		mkdirSync(join("notion", "schemas"), { recursive: true });
		writeFileSync(join("notion", "schemas", "keep.json"), "{}");
		mkdirSync(join("notion", "databases"), { recursive: true });
		writeFileSync(join("notion", "databases", "Foo.ts"), "// x");
		mkdirSync(join("notion", "agents"), { recursive: true });
		writeFileSync(join("notion", "agents", "A.ts"), "// y");
		writeFileSync(join("notion", "index.ts"), "export {}");
		writeFileSync(join("notion", "index.d.ts"), "export {}");
		writeFileSync(join("notion", "index.d.ts.map"), "{}");

		clearNotionCodegenOutputForSync({ environment: "typescript" });

		expect(existsSync(join("notion", "schemas", "keep.json"))).toBe(true);
		expect(existsSync(join("notion", "databases"))).toBe(false);
		expect(existsSync(join("notion", "agents"))).toBe(false);
		expect(existsSync(join("notion", "index.ts"))).toBe(false);
		expect(existsSync(join("notion", "index.d.ts"))).toBe(false);
		expect(existsSync(join("notion", "index.d.ts.map"))).toBe(false);
	});

	test("javascript environment removes index.js", () => {
		mkdirSync("notion", { recursive: true });
		writeFileSync(join("notion", "index.js"), "export {}");
		clearNotionCodegenOutputForSync({ environment: "javascript" });
		expect(existsSync(join("notion", "index.js"))).toBe(false);
	});
});
