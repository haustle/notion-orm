import { describe, expect, test } from "bun:test";
import {
	SyncProgressState,
	formatSyncLaneSegment,
	syncProgressHasDoneWithErrors,
} from "../../src/cli/sync-progress";

describe("SyncProgressState", () => {
	test("bootstrap sets empty databases when count is zero", () => {
		const s = new SyncProgressState();
		s.bootstrap({ databaseCount: 0, agentsSdkSkipped: false });
		expect(s.getSnapshot().databases.kind).toBe("empty");
		expect(formatSyncLaneSegment(s.getSnapshot().databases)).toBe("none");
	});

	test("bootstrap sets skipped agents when SDK is absent", () => {
		const s = new SyncProgressState();
		s.bootstrap({ databaseCount: 3, agentsSdkSkipped: true });
		expect(s.getSnapshot().agents.kind).toBe("skipped");
		expect(formatSyncLaneSegment(s.getSnapshot().agents)).toBe("skipped");
	});

	test("finalizeAgents marks doneWithErrors when failures occurred", () => {
		const s = new SyncProgressState();
		s.bootstrap({ databaseCount: 1, agentsSdkSkipped: false });
		s.applyAgentsProgress(7, 10);
		s.finalizeAgents({
			skipped: false,
			successCount: 7,
			totalListed: 10,
			failureCount: 3,
		});
		const snap = s.getSnapshot();
		expect(snap.agents.kind).toBe("doneWithErrors");
		expect(syncProgressHasDoneWithErrors(snap)).toBe(true);
		expect(formatSyncLaneSegment(snap.agents)).toBe("[7/10]");
	});

	test("finalizeAgents marks done when all succeed", () => {
		const s = new SyncProgressState();
		s.bootstrap({ databaseCount: 1, agentsSdkSkipped: false });
		s.applyAgentsProgress(5, 5);
		s.finalizeAgents({
			skipped: false,
			successCount: 5,
			totalListed: 5,
			failureCount: 0,
		});
		const snap = s.getSnapshot();
		expect(snap.agents.kind).toBe("done");
		expect(syncProgressHasDoneWithErrors(snap)).toBe(false);
	});
});
