/**
 * CLI orchestration for database type generation.
 * Resolves target database ids, emits per-database modules, persists metadata,
 * and refreshes the generated registries used by the root ORM index.
 */
import { Client } from "@notionhq/client";
import fs from "fs";
import { getNotionConfig } from "../../config/loadConfig";
import { toUndashedNotionId } from "../../helpers";
import { toPascalCase } from "../shared/ast-builders";
import {
	type CachedEntityMetadata,
	readAgentMetadataFromDisk,
	readDatabaseMetadata,
} from "../shared/cached-metadata";
import {
	getCodegenArtifactExtension,
	resolveCodegenEnvironment,
	type CodegenEnvironment,
} from "../shared/codegen-environment";
import { AST_FS_PATHS, AST_RUNTIME_CONSTANTS } from "../shared/constants";
import { updateSourceIndexFile } from "../shared/emit/orm-index-emitter";
import { emitRegistryModuleArtifacts } from "../shared/emit/registry-emitter";
import { createCodegenFileForDatabase } from "./database-file-writer";

function writeDatabaseMetadata(metadata: CachedEntityMetadata[]): void {
	const databasesDir = AST_FS_PATHS.DATABASES_DIR;
	if (!fs.existsSync(databasesDir)) {
		fs.mkdirSync(databasesDir, { recursive: true });
	}
	fs.writeFileSync(
		AST_FS_PATHS.metadataFile,
		JSON.stringify(metadata, null, 2),
	);
}

type CreateDatabaseTypesOptions =
	| { type: "all" }
	| { type: "incremental"; id: string };
type GenerationProgress = { completed: number; total: number };
type CreateDatabaseTypesArgs = CreateDatabaseTypesOptions & {
	onProgress?: (progress: GenerationProgress) => void;
	skipSourceIndexUpdate?: boolean;
};

/**
 * Main database generation entrypoint used by CLI commands.
 * Supports both full regeneration and incremental single-database refreshes.
 */
export const createDatabaseTypes = async (
	options: CreateDatabaseTypesArgs,
): Promise<{ databaseNames: string[]; databaseKeys: string[] }> => {
	const config = await getNotionConfig();
	const environment = resolveCodegenEnvironment();

	const client = new Client({
		auth: config.auth,
		notionVersion: AST_RUNTIME_CONSTANTS.NOTION_API_VERSION,
	});

	const isFullGenerate = options.type === "all";
	const targetIds = isFullGenerate ? config.databases : [options.id];

	let metadataMap: Map<string, CachedEntityMetadata>;

	if (isFullGenerate) {
		// Start from a clean generated directory so removed databases do not linger.
		// (When called via `notion sync`, the parent codegen root is already wiped,
		// but this is still needed for direct callers and tests.)
		fs.rmSync(AST_FS_PATHS.DATABASES_DIR, { recursive: true, force: true });
		metadataMap = new Map();
	} else {
		if (targetIds.length === 0) {
			console.error("Please pass some database Ids");
			process.exit(1);
		}
		metadataMap = prepareIncrementalMetadata(config.databases);
	}
	options.onProgress?.({ completed: 0, total: targetIds.length });

	if (targetIds.length === 0) {
		writeDatabaseMetadata([]);
		createDatabaseBarrelFile({ databaseInfo: [], environment });
		if (!options.skipSourceIndexUpdate) {
			const agentsMetadata = readAgentMetadataFromDisk();
			updateSourceIndexFile([], agentsMetadata, environment);
		}
		return { databaseNames: [], databaseKeys: [] };
	}

	const databaseNames: string[] = [];
	const databaseKeys: string[] = [];
	let completedCount = 0;

	for (const databaseId of targetIds) {
		try {
			const databaseMetadata = await generateDatabaseTypes(
				client,
				databaseId,
				environment,
			);
			metadataMap.set(databaseMetadata.id, databaseMetadata);
			databaseNames.push(databaseMetadata.displayName);
			databaseKeys.push(databaseMetadata.name);
			completedCount += 1;
			options.onProgress?.({
				completed: completedCount,
				total: targetIds.length,
			});
		} catch (error: unknown) {
			throw new Error(
				`Error generating types for ${databaseId}: ${
					error instanceof Error ? error.message : String(error)
				}`,
			);
		}
	}

	const databasesMetadata = Array.from(metadataMap.values());
	writeDatabaseMetadata(databasesMetadata);

	createDatabaseBarrelFile({
		databaseInfo: databasesMetadata.map((db) => ({ name: db.name })),
		environment,
	});

	if (!options.skipSourceIndexUpdate) {
		const agentsMetadata = readAgentMetadataFromDisk();
		updateSourceIndexFile(databasesMetadata, agentsMetadata, environment);
	}

	return { databaseNames, databaseKeys };
};

/** Emits `databases/index.ts` so generated databases can be addressed as a registry. */
function createDatabaseBarrelFile(args: {
	databaseInfo: Array<{ name: string }>;
	environment: CodegenEnvironment;
}) {
	const { databaseInfo, environment } = args;
	const artifactExtension = getCodegenArtifactExtension(environment);

	emitRegistryModuleArtifacts({
		registryName: "databases",
		entries: databaseInfo.map(({ name }) => ({
			importName: toPascalCase(name),
			importPath: `./${toPascalCase(name)}.${artifactExtension}`,
			registryKey: name,
		})),
		tsPath: AST_FS_PATHS.databaseBarrelTs,
		jsPath: AST_FS_PATHS.databaseBarrelJs,
		environment,
	});
}

function createMetadata(
	id: string,
	name: string,
	displayName: string,
): CachedEntityMetadata {
	return {
		id: toUndashedNotionId(id),
		name,
		displayName,
	};
}

/** Generates one database module and returns the normalized metadata entry. */
async function generateDatabaseTypes(
	client: Client,
	databaseId: string,
	environment: CodegenEnvironment,
): Promise<CachedEntityMetadata> {
	const databaseObject = await client.dataSources.retrieve({
		data_source_id: databaseId,
	});

	const { databaseModuleName, databaseName, databaseId: id } =
		await createCodegenFileForDatabase({
			dataSourceResponse: databaseObject,
			environment,
		});

	return createMetadata(id, databaseModuleName, databaseName);
}

/**
 * For incremental generation, keep only cached metadata for databases that are
 * still present in config so stale registry entries are not re-emitted.
 */
function prepareIncrementalMetadata(
	configDatabaseIds: string[],
): Map<string, CachedEntityMetadata> {
	const cachedDatabaseMetadata = readDatabaseMetadata();
	const metadataMap = new Map<string, CachedEntityMetadata>();

	const configIdsSet = new Set(configDatabaseIds.map(toUndashedNotionId));
	for (const dbMetadata of cachedDatabaseMetadata) {
		if (configIdsSet.has(dbMetadata.id)) {
			metadataMap.set(dbMetadata.id, dbMetadata);
		}
	}

	return metadataMap;
}
