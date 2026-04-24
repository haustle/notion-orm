import * as readline from "node:readline";

type ProgressRowState = "running" | "done" | "unavailable";
type ProgressRowKey = "agents" | "databases";
type ProgressRow = {
	label: string;
	completed: number;
	total: number;
	state: ProgressRowState;
};

/**
 * Small terminal renderer that keeps sync progress readable without interleaving
 * the agent and database generation logs. On TTY, redraws two rows (agents +
 * databases) with one shared spinner.
 */
export class SyncProgressRenderer {
	private readonly spinnerFrames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧"];
	private spinnerIndex = 0;
	private interval: ReturnType<typeof setInterval> | undefined;
	private hasRendered = false;
	private readonly rows: Record<ProgressRowKey, ProgressRow> = {
		agents: {
			label: "Agents",
			completed: 0,
			total: 0,
			state: "running",
		},
		databases: {
			label: "Databases",
			completed: 0,
			total: 0,
			state: "running",
		},
	};

	constructor(private readonly isTTY: boolean) {}

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
			console.log(this.formatCombined());
		}
	}

	updateProgress(key: ProgressRowKey, completed: number, total: number): void {
		const row = this.rows[key];
		row.completed = completed;
		row.total = total;
		if (row.state !== "done") {
			if (total === 0) {
				row.state = "unavailable";
			} else if (completed >= total) {
				row.state = "done";
			} else {
				row.state = "running";
			}
		}
		if (this.isTTY) {
			this.render();
		}
	}

	complete(key: ProgressRowKey): void {
		const row = this.rows[key];
		row.state = row.total === 0 ? "unavailable" : "done";
		if (this.isTTY) {
			this.render();
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
			console.log(this.formatCombined());
		}
	}

	private isRowTerminal(row: ProgressRow): boolean {
		return row.state === "done" || row.state === "unavailable";
	}

	private formatSegmentBody(row: ProgressRow): string {
		if (row.state === "unavailable") {
			return "unavailable";
		}
		return `[${row.completed}/${row.total}]`;
	}

	private formatCombined(): string {
		const d = this.rows.databases;
		const a = this.rows.agents;
		const left = `Databases: ${this.formatSegmentBody(d)}`;
		const right = `Agents: ${this.formatSegmentBody(a)}`;
		const allTerminal = this.isRowTerminal(d) && this.isRowTerminal(a);
		const marker = allTerminal
			? "✔"
			: this.isTTY
				? this.spinnerFrames[this.spinnerIndex]
				: "...";
		return `${marker}  ${left}  ·  ${right}`;
	}

	private render(): void {
		const line = this.formatCombined();
		if (this.hasRendered) {
			readline.moveCursor(process.stdout, 0, -1);
		}
		readline.clearLine(process.stdout, 0);
		process.stdout.write(`${line}\n`);
		this.hasRendered = true;
	}
}
