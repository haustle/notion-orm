import fs from "fs";
import path from "path";
import {
	NOTION_CONFIG_CANDIDATE_FILENAMES,
	NOTION_CONFIG_FILENAMES,
} from "./notion-config-filenames";

export type NotionConfigFile = {
	path: string;
	isTS: boolean;
};

/** Looks for supported notion config filenames in the same order as the loader. */
export function findConfigFile(): NotionConfigFile | undefined {
	const projectDir = process.cwd();
	for (const filename of NOTION_CONFIG_CANDIDATE_FILENAMES) {
		const candidatePath = path.join(projectDir, filename);
		if (fs.existsSync(candidatePath)) {
			return {
				path: candidatePath,
				isTS: filename === NOTION_CONFIG_FILENAMES.ts,
			};
		}
	}
	return undefined;
}
