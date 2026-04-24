export type SyncLaneDisplay =
	| { kind: "running"; completed: number; total: number }
	| { kind: "empty" }
	| { kind: "skipped" }
	| { kind: "done"; completed: number; total: number }
	| { kind: "doneWithErrors"; completed: number; total: number };

export type SyncProgressSnapshot = {
	databases: SyncLaneDisplay;
	agents: SyncLaneDisplay;
};

/**
 * Holds explicit per-lane sync progress for `notion sync`. Generators still
 * report coarse `(completed, total)`; this type maps those events into stable
 * UI states (skipped, empty, done with errors).
 */
export class SyncProgressState {
	private databases: SyncLaneDisplay = {
		kind: "running",
		completed: 0,
		total: 0,
	};
	private agents: SyncLaneDisplay = {
		kind: "running",
		completed: 0,
		total: 0,
	};

	getSnapshot(): SyncProgressSnapshot {
		return { databases: this.databases, agents: this.agents };
	}

	/**
	 * Call once after config validation: known database count from config,
	 * and whether the agents SDK is absent (agents lane is skipped immediately).
	 */
	bootstrap(args: { databaseCount: number; agentsSdkSkipped: boolean }): void {
		if (args.databaseCount === 0) {
			this.databases = { kind: "empty" };
		} else {
			this.databases = { kind: "running", completed: 0, total: args.databaseCount };
		}
		if (args.agentsSdkSkipped) {
			this.agents = { kind: "skipped" };
		} else {
			this.agents = { kind: "running", completed: 0, total: 0 };
		}
	}

	applyDatabasesProgress(completed: number, total: number): void {
		if (total === 0) {
			this.databases = { kind: "empty" };
			return;
		}
		if (completed >= total) {
			this.databases = { kind: "done", completed, total };
			return;
		}
		this.databases = { kind: "running", completed, total };
	}

	applyAgentsProgress(completed: number, total: number): void {
		if (this.agents.kind === "skipped") {
			return;
		}
		if (total === 0) {
			this.agents = { kind: "empty" };
			return;
		}
		if (completed >= total) {
			this.agents = { kind: "done", completed, total };
			return;
		}
		this.agents = { kind: "running", completed, total };
	}

	/**
	 * After `createAgentTypes` resolves: fix agents lane when some generations
	 * failed (progress callbacks only count successes).
	 */
	finalizeAgents(args: {
		skipped: boolean;
		successCount: number;
		totalListed: number;
		failureCount: number;
	}): void {
		if (args.skipped) {
			this.agents = { kind: "skipped" };
			return;
		}
		if (args.totalListed === 0) {
			this.agents = { kind: "empty" };
			return;
		}
		if (args.failureCount > 0) {
			this.agents = {
				kind: "doneWithErrors",
				completed: args.successCount,
				total: args.totalListed,
			};
			return;
		}
		this.agents = {
			kind: "done",
			completed: args.successCount,
			total: args.totalListed,
		};
	}
}

export function isSyncLaneSpinnerTerminal(lane: SyncLaneDisplay): boolean {
	return (
		lane.kind === "empty" ||
		lane.kind === "skipped" ||
		lane.kind === "done" ||
		lane.kind === "doneWithErrors"
	);
}

export function syncProgressHasDoneWithErrors(snapshot: SyncProgressSnapshot): boolean {
	// Databases lane does not use `doneWithErrors` today; only agents can fail per-item.
	return snapshot.agents.kind === "doneWithErrors";
}

export function formatSyncLaneSegment(lane: SyncLaneDisplay): string {
	switch (lane.kind) {
		case "empty":
			return "none";
		case "skipped":
			return "skipped";
		case "running":
			if (lane.total === 0) {
				return "…";
			}
			return `[${lane.completed}/${lane.total}]`;
		case "done":
			return `[${lane.completed}/${lane.total}]`;
		case "doneWithErrors":
			return `[${lane.completed}/${lane.total}]`;
	}
}
