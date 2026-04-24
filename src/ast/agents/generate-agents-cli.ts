/**
 * CLI orchestration for agent type generation.
 * Syncs agent metadata into config, emits agent modules, and refreshes the
 * generated source index when requested.
 */
import fs from "fs";
import { z } from "zod";
import { isAgentsSdkAvailable, loadAgentsSdk } from "../../agents-sdk-resolver";
import { syncAgentsInConfigWithAST } from "../../cli/helpers";
import type { AgentIcon } from "../../client/agent/AgentClient";
import { findConfigFile } from "../../config/findConfigFile";
import { getNotionConfig } from "../../config/loadConfig";
import { camelize, toPascalCase, toUndashedNotionId } from "../../helpers";
import type { CodegenDiagnosticSink } from "../shared/codegen-diagnostics";
import {
	type CachedEntityMetadata,
	readDatabaseMetadata,
} from "../shared/cached-metadata";
import {
	codegenArtifactFileName,
	resolveCodegenEnvironment,
	type CodegenEnvironment,
} from "../shared/codegen-environment";
import { AGENTS_DIR, AST_FS_PATHS, codegenIndexSourcePath } from "../shared/constants";
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
	onDiagnostic?: CodegenDiagnosticSink;
};

type AgentsListResponse = {
	results: Array<{ id: string; name: string; icon: unknown }>;
	has_more?: boolean;
	next_cursor?: string | null;
};

async function listAllAgentsForSync(client: {
	agents: {
		list: (args: {
			page_size: number;
			start_cursor?: string;
		}) => Promise<AgentsListResponse>;
	};
}): Promise<Array<{ id: string; name: string; icon: unknown }>> {
	const out: Array<{ id: string; name: string; icon: unknown }> = [];
	let cursor: string | undefined;
	for (;;) {
		const page = await client.agents.list({
			page_size: 100,
			...(cursor !== undefined ? { start_cursor: cursor } : {}),
		});
		for (const a of page.results) {
			out.push({ id: a.id, name: a.name, icon: a.icon });
		}
		if (!page.has_more || !page.next_cursor) {
			break;
		}
		cursor = page.next_cursor;
	}
	return out;
}

export type CreateAgentTypesResult = {
	agentNames: string[];
	/** Module/registry keys (camelCase), parallel to `agentNames`. */
	agentKeys: string[];
	skipped: boolean;
	/** All agents returned by the API across pages (0 when `skipped`). */
	totalAgentsListed: number;
	/** Agents that failed during file generation (0 when `skipped`). */
	generationFailureCount: number;
};

/** Returns `{ skipped: true }` when the agents SDK is not installed. */
export const createAgentTypes = async (
	options?: CreateAgentTypesOptions,
): Promise<CreateAgentTypesResult> => {
	if (!isAgentsSdkAvailable()) {
		return {
			agentNames: [],
			agentKeys: [],
			skipped: true,
			totalAgentsListed: 0,
			generationFailureCount: 0,
		};
	}

	const sdk = await loadAgentsSdk();
	const config = await getNotionConfig();

	const client = new sdk.NotionAgentsClient({
		auth: config.auth,
	});
	const configFile = findConfigFile();
	const environment = resolveCodegenEnvironment({ configRuntime: configFile });

	const agentsList = await listAllAgentsForSync(client);
	const total = agentsList.length;
	options?.onProgress?.({ completed: 0, total });
	if (configFile) {
		const agentsToSync = agentsList.map(({ id, name }) => ({
			id,
			name,
		}));
		await syncAgentsInConfigWithAST(
			configFile.path,
			agentsToSync,
			configFile.isTS,
			{ onFormatWarning: options?.onDiagnostic },
		);
	}

	const metadataMap = new Map<string, CachedAgentMetadata>();
	const agentNames: string[] = [];
	const agentKeys: string[] = [];
	let completedCount = 0;
	let generationFailureCount = 0;

	for (const agent of agentsList) {
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
			agentKeys.push(agentMetadata.name);
			completedCount += 1;
			options?.onProgress?.({
				completed: completedCount,
				total,
			});
		} catch (error: unknown) {
			generationFailureCount += 1;
			const detail =
				error instanceof Error ? error.message : String(error);
			const message = `Error generating types for agent ${agent.id}: ${detail}`;
			if (options?.onDiagnostic) {
				options.onDiagnostic({ level: "error", message });
			} else {
				// biome-ignore lint/suspicious/noConsole: CLI fallback when no sink
				console.error(`❌ ${message}`);
			}
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

	return {
		agentNames,
		agentKeys,
		skipped: false,
		totalAgentsListed: total,
		generationFailureCount,
	};
};

/** Emits the environment-specific `agents/index` registry module. */
function createAgentBarrelFile(args: {
	agentInfo: Array<{ name: string }>;
	environment: CodegenEnvironment;
}) {
	const { agentInfo, environment } = args;

	emitRegistryModuleArtifacts({
		registryName: "agents",
		entries: agentInfo.map(({ name }) => ({
			importName: name,
			importPath: `./${codegenArtifactFileName(toPascalCase(name), environment)}`,
			registryKey: name,
		})),
		outputPath: codegenIndexSourcePath({ scope: "agents", environment }),
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
