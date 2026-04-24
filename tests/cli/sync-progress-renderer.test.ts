import { afterEach, describe, expect, test } from "bun:test";
import { SyncProgressState } from "../../src/cli/sync-progress";
import { SyncProgressRenderer } from "../../src/cli/sync-progress-renderer";

describe("SyncProgressRenderer (non-TTY)", () => {
	const originalLog = console.log;

	afterEach(() => {
		console.log = originalLog;
	});

	test("prints databases and agents on stacked lines (non-TTY)", () => {
		const lines: string[] = [];
		console.log = (...args: unknown[]) => {
			lines.push(args.map(String).join(" "));
		};

		const state = new SyncProgressState();
		state.bootstrap({ databaseCount: 2, agentsSdkSkipped: true });
		const renderer = new SyncProgressRenderer(false, () => state.getSnapshot());
		renderer.start();
		renderer.stop();

		const combined = lines.filter((l) => l.includes("Databases:") && l.includes("Agents:"));
		expect(combined.length).toBeGreaterThanOrEqual(2);
		expect(combined.some((l) => l.includes("Databases: [0/2]"))).toBe(true);
		expect(combined.some((l) => l.includes("Agents: skipped"))).toBe(true);
		expect(combined.some((l) => l.includes("\n"))).toBe(true);
	});

	test("uses warning marker when any lane has doneWithErrors (stacked)", () => {
		const lines: string[] = [];
		console.log = (...args: unknown[]) => {
			lines.push(args.map(String).join(" "));
		};

		const state = new SyncProgressState();
		state.bootstrap({ databaseCount: 1, agentsSdkSkipped: false });
		state.applyDatabasesProgress(1, 1);
		state.finalizeAgents({
			skipped: false,
			successCount: 2,
			totalListed: 5,
			failureCount: 3,
		});
		const renderer = new SyncProgressRenderer(false, () => state.getSnapshot());
		renderer.start();
		renderer.stop();

		const combined = lines.filter((l) => l.includes("Databases:") && l.includes("Agents:"));
		expect(combined.some((l) => l.startsWith("⚠"))).toBe(true);
	});
});
