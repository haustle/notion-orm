/**
 * CLI orchestration for agent type generation.
 * Syncs agent metadata into config, emits agent modules, and refreshes the
 * generated source index when requested.
 */
import fs from "fs";
import path from "path";
import { z } from "zod";
import { isAgentsSdkAvailable, loadAgentsSdk } from "../../agents-sdk-resolver";
import { syncAgentsInConfigWithAST } from "../../cli/helpers";
import type { AgentIcon } from "../../client/agent/AgentClient";
import { findConfigFile } from "../../config/helpers";
import { getNotionConfig } from "../../config/loadConfig";
import { camelize, toPascalCase, toUndashedNotionId } from "../../helpers";
import {
	type CachedEntityMetadata,
	readDatabaseMetadata,
} from "../shared/cached-metadata";
import {
	getCodegenArtifactExtension,
	resolveCodegenEnvironment,
	type CodegenEnvironment,
} from "../shared/codegen-environment";
import { AGENTS_DIR, AST_FS_PATHS } from "../shared/constants";
import { updateSourceIndexFile } from "../shared/emit/orm-index-emitter";
import { emitRegistryModuleArtifacts } from "../shared/emit/registry-emitter";
import { createTypescriptFileForAgent } from "./agent-file-writer";

function writeAgentMetadata(metadata: CachedAgentMetadata[]): void {
	if (!fs.existsSync(AGENTS_DIR)) {
		fs.mkdirSync(AGENTS_DIR, { recursive: true });
	}
	fs.writeFileSync(
		AST_FS_PATHS.agentMetadataFile,
		JSON.stringify(metadata, null, 2),
	);
}

type CachedAgentMetadata = CachedEntityMetadata;
type GenerationProgress = { completed: number; total: number };
type CreateAgentTypesOptions = {
	onProgress?: (progress: GenerationProgress) => void;
	skipSourceIndexUpdate?: boolean;
};

export type CreateAgentTypesResult = {
	agentNames: string[];
	skipped: boolean;
};

/** Returns `{ skipped: true }` when the agents SDK is not installed. */
export const createAgentTypes = async (
	options?: CreateAgentTypesOptions,
): Promise<CreateAgentTypesResult> => {
	if (!isAgentsSdkAvailable()) {
		return { agentNames: [], skipped: true };
	}

	const sdk = await loadAgentsSdk();
	const config = await getNotionConfig();

	const client = new sdk.NotionAgentsClient({
		auth: config.auth,
	});
	const configFile = findConfigFile();
	const environment = resolveCodegenEnvironment({ configRuntime: configFile });

	const agentsList = await client.agents.list({
		page_size: 100,
	});
	options?.onProgress?.({ completed: 0, total: agentsList.results.length });
	if (configFile) {
		const agentsToSync = agentsList.results.map(({ id, name }) => ({
			id,
			name,
		}));
		await syncAgentsInConfigWithAST(
			configFile.path,
			agentsToSync,
			configFile.isTS,
		);
	}

	const metadataMap = new Map<string, CachedAgentMetadata>();
	const agentNames: string[] = [];
	let completedCount = 0;

	for (const agent of agentsList.results) {
		try {
			const normalizedIdForStorage = toUndashedNotionId(agent.id);
			const agentMetadata = await generateAgentTypes(
				normalizedIdForStorage,
				agent.name,
				parseAgentIcon(agent.icon),
				environment,
			);
			metadataMap.set(agentMetadata.id, agentMetadata);
			agentNames.push(agentMetadata.displayName);
			completedCount += 1;
			options?.onProgress?.({
				completed: completedCount,
				total: agentsList.results.length,
			});
		} catch (error: unknown) {
			// biome-ignore lint/suspicious/noConsole: CLI
			console.error(`❌ Error generating types for agent: ${agent.id}`, error);
		}
	}

	const agentsMetadata = Array.from(metadataMap.values());
	writeAgentMetadata(agentsMetadata);

	createAgentBarrelFile({
		agentInfo: agentsMetadata.map((agent) => ({ name: agent.name })),
		environment,
	});

	if (!options?.skipSourceIndexUpdate) {
		const databasesMetadata = readDatabaseMetadata();
		updateSourceIndexFile(databasesMetadata, agentsMetadata, environment);
	}

	return { agentNames, skipped: false };
};

/** Emits the environment-specific `agents/index` registry module. */
function createAgentBarrelFile(args: {
	agentInfo: Array<{ name: string }>;
	environment: CodegenEnvironment;
}) {
	const { agentInfo, environment } = args;
	const artifactExtension = getCodegenArtifactExtension(environment);

	emitRegistryModuleArtifacts({
		registryName: "agents",
		entries: agentInfo.map(({ name }) => ({
			importName: name,
			importPath: `./${toPascalCase(name)}.${artifactExtension}`,
			registryKey: name,
		})),
		tsPath: AST_FS_PATHS.agentBarrel("typescript"),
		jsPath: AST_FS_PATHS.agentBarrel("javascript"),
		environment,
	});
}

function createMetadata(
	id: string,
	name: string,
	displayName: string,
): CachedAgentMetadata {
	return {
		id,
		name,
		displayName,
	};
}

/** Trust boundary for icon payloads returned by the Notion Agents API. */
const agentIconSchema: z.ZodType<AgentIcon> = z.union([
	z.object({
		type: z.literal("emoji"),
		emoji: z.string(),
	}),
	z.object({
		type: z.literal("file"),
		file: z.object({
			url: z.string(),
			expiry_time: z.string(),
		}),
	}),
	z.object({
		type: z.literal("external"),
		external: z.object({
			url: z.string(),
		}),
	}),
	z.object({
		type: z.literal("custom_emoji"),
		custom_emoji: z.object({
			id: z.string(),
			name: z.string(),
			url: z.string(),
		}),
	}),
	z.object({
		type: z.literal("custom_agent_avatar"),
		custom_agent_avatar: z.object({
			static_url: z.string(),
			animated_url: z.string(),
		}),
	}),
	z.null(),
]);

function parseAgentIcon(input: unknown): AgentIcon {
	const parseResult = agentIconSchema.safeParse(input);
	return parseResult.success ? parseResult.data : null;
}

async function generateAgentTypes(
	agentId: string,
	agentName: string,
	agentIcon: AgentIcon,
	environment: CodegenEnvironment,
): Promise<CachedAgentMetadata> {
	const agentModuleName = camelize(agentName);

	await createTypescriptFileForAgent({
		agentId,
		agentName,
		agentModuleName,
		agentIcon,
		environment,
	});

	const agentMetadata = createMetadata(agentId, agentModuleName, agentName);
	return agentMetadata;
}
