import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const tempDirectories: string[] = [];

export function createTempWorkspace(prefix: string): string {
	const workspacePath = mkdtempSync(join(tmpdir(), prefix));
	tempDirectories.push(workspacePath);
	return workspacePath;
}

export function cleanupTempWorkspaces(): void {
	while (tempDirectories.length > 0) {
		const workspacePath = tempDirectories.pop();
		if (!workspacePath) {
			continue;
		}
		rmSync(workspacePath, { recursive: true, force: true });
	}
}

export function writeWorkspaceFile(args: {
	workspacePath: string;
	relativePath: string;
	content: string;
}): string {
	const absolutePath = resolve(args.workspacePath, args.relativePath);
	mkdirSync(dirname(absolutePath), { recursive: true });
	writeFileSync(absolutePath, args.content);
	return absolutePath;
}

export function readWorkspaceFile(args: {
	workspacePath: string;
	relativePath: string;
}): string {
	return readFileSync(resolve(args.workspacePath, args.relativePath), "utf-8");
}

export async function importWorkspaceModule<TModule>(args: {
	workspacePath: string;
	relativePath: string;
}): Promise<TModule> {
	const absolutePath = resolve(args.workspacePath, args.relativePath);
	const loaded = await import(pathToFileURL(absolutePath).href);
	return loaded satisfies TModule;
}

export async function withTempWorkspace(
	prefix: string,
	run: (workspacePath: string) => Promise<void> | void,
): Promise<void> {
	const workspacePath = createTempWorkspace(prefix);
	try {
		await run(workspacePath);
	} finally {
		rmSync(workspacePath, { recursive: true, force: true });
	}
}
