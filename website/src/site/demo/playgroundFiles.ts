import {
	agentEntryFile as generatedAgentEntryFile,
	databaseEntryFile as generatedDatabaseEntryFile,
	ormAllDatabasesEntryFile as generatedOrmAllDatabasesEntryFile,
	playgroundFiles as generatedPlaygroundFiles,
} from "../../generated/demo-playground-files";

function assertGeneratedPlaygroundFileKey(
	key: string,
	files: typeof generatedPlaygroundFiles,
): asserts key is keyof typeof generatedPlaygroundFiles {
	if (!(key in files)) {
		throw new Error(
			`Demo playground: generated ormAllDatabasesEntryFile key missing from playgroundFiles: ${key}`,
		);
	}
}

const ormKey = generatedOrmAllDatabasesEntryFile;
assertGeneratedPlaygroundFileKey(ormKey, generatedPlaygroundFiles);

export const databaseEntryFile = generatedDatabaseEntryFile;
export const agentEntryFile = generatedAgentEntryFile;
export const ormAllDatabasesEntryFile: keyof typeof generatedPlaygroundFiles =
	ormKey;
export const playgroundFiles = generatedPlaygroundFiles;
