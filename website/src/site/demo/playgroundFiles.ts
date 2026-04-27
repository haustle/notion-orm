import {
	agentEntryFile as generatedAgentEntryFile,
	databaseEntryFile as generatedDatabaseEntryFile,
	playgroundFiles as generatedPlaygroundFiles,
} from "../../generated/demo-playground-files";

function assertGeneratedPlaygroundFileKey(
	key: string,
	files: typeof generatedPlaygroundFiles,
): asserts key is keyof typeof generatedPlaygroundFiles {
	if (!(key in files)) {
		throw new Error(
			`Demo playground: generated playground file key missing from playgroundFiles: ${key}`,
		);
	}
}

assertGeneratedPlaygroundFileKey(generatedDatabaseEntryFile, generatedPlaygroundFiles);
assertGeneratedPlaygroundFileKey(generatedAgentEntryFile, generatedPlaygroundFiles);

export const databaseEntryFile = generatedDatabaseEntryFile;
export const agentEntryFile = generatedAgentEntryFile;
export const playgroundFiles = generatedPlaygroundFiles;
