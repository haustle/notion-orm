import fs from "fs";
import path from "path";
import { config as loadDotEnv } from "dotenv";

const DOT_ENV_FILENAME = ".env";
const loadedDirectories = new Set<string>();

function getDotEnvCandidateFilenames(nodeEnv: string | undefined): string[] {
	const candidates = [
		nodeEnv ? `${DOT_ENV_FILENAME}.${nodeEnv}.local` : undefined,
		`${DOT_ENV_FILENAME}.local`,
		nodeEnv ? `${DOT_ENV_FILENAME}.${nodeEnv}` : undefined,
		DOT_ENV_FILENAME,
	];
	return Array.from(new Set(candidates.filter((value) => value !== undefined)));
}

/**
 * Loads `.env*` files from the current project root using a runtime-agnostic cascade.
 * Explicit shell environment variables always win over file values.
 *
 * Precedence (highest to lowest):
 * 1) `.env.<NODE_ENV>.local`
 * 2) `.env.local`
 * 3) `.env.<NODE_ENV>`
 * 4) `.env`
 */
export function loadDotEnvFromCwd(): void {
	const cwd = process.cwd();
	if (loadedDirectories.has(cwd)) {
		return;
	}

	for (const filename of getDotEnvCandidateFilenames(process.env.NODE_ENV)) {
		const envPath = path.join(cwd, filename);
		if (!fs.existsSync(envPath)) {
			continue;
		}

		const result = loadDotEnv({
			path: envPath,
			override: false,
			processEnv: process.env,
			quiet: true,
		});
		if (result.error) {
			console.warn(
				`Warning: failed to parse ${envPath}: ${result.error.message}`,
			);
		}
	}

	loadedDirectories.add(cwd);
}
