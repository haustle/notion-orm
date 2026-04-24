import * as readline from "node:readline";
import {
	formatSyncLaneSegment,
	isSyncLaneSpinnerTerminal,
	type SyncProgressSnapshot,
	syncProgressHasDoneWithErrors,
} from "./sync-progress";

/**
 * Terminal painter for `notion sync`: reads a snapshot from `SyncProgressState`
 * so rendering stays separate from progress semantics.
 */
export class SyncProgressRenderer {
	private readonly spinnerFrames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧"];
	private spinnerIndex = 0;
	private interval: ReturnType<typeof setInterval> | undefined;
	private hasRendered = false;
	private lastRenderedLineCount = 0;

	constructor(
		private readonly isTTY: boolean,
		private readonly getSnapshot: () => SyncProgressSnapshot,
	) {}

	start(): void {
		const header = this.isTTY
			? "\x1b[1m📐 Updating static types\x1b[0m"
			: "📐 Updating static types";
		console.log(header);
		if (this.isTTY) {
			this.render();
			this.interval = setInterval(() => {
				this.spinnerIndex = (this.spinnerIndex + 1) % this.spinnerFrames.length;
				this.render();
			}, 90);
		} else {
			console.log(this.formatCombined(this.getSnapshot()));
		}
	}

	stop(): void {
		if (this.interval) {
			clearInterval(this.interval);
			this.interval = undefined;
		}
		if (this.isTTY) {
			this.render();
			process.stdout.write("\n");
		} else {
			console.log(this.formatCombined(this.getSnapshot()));
		}
	}

	private formatCombined(snapshot: SyncProgressSnapshot): string {
		const d = snapshot.databases;
		const a = snapshot.agents;
		const left = `Databases: ${formatSyncLaneSegment(d)}`;
		const right = `Agents: ${formatSyncLaneSegment(a)}`;
		const allTerminal =
			isSyncLaneSpinnerTerminal(d) && isSyncLaneSpinnerTerminal(a);
		const marker = allTerminal
			? syncProgressHasDoneWithErrors(snapshot)
				? "⚠"
				: "✔"
			: this.isTTY
				? this.spinnerFrames[this.spinnerIndex]
				: "...";
		const indent = " ".repeat(marker.length + 2);
		return `${marker}  ${left}\n${indent}${right}`;
	}

	private render(): void {
		const text = this.formatCombined(this.getSnapshot());
		const lines = text.split("\n");
		if (this.hasRendered) {
			readline.moveCursor(process.stdout, 0, -this.lastRenderedLineCount);
		}
		for (let i = 0; i < lines.length; i++) {
			readline.clearLine(process.stdout, 0);
			process.stdout.write(lines[i]!);
			if (i < lines.length - 1) {
				process.stdout.write("\n");
			}
		}
		process.stdout.write("\n");
		this.lastRenderedLineCount = lines.length;
		this.hasRendered = true;
	}
}
