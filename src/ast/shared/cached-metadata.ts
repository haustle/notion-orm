/**
 * Shared metadata schema and read helpers for database and agent caches.
 * Keeps a single shape so index emission can treat both uniformly.
 */

import fs from "fs";
import { z } from "zod";
import { toUndashedNotionId } from "../../helpers";
import { AST_FS_PATHS } from "./constants";

const cachedEntityMetadataSchema = z.object({
	id: z.string(),
	name: z.string(),
	displayName: z.string(),
});
const legacyCachedEntityMetadataSchema = z.object({
	id: z.string(),
	className: z.string().optional(),
	displayName: z.string(),
	camelCaseName: z.string(),
});
const cachedEntityMetadataArraySchema = z.array(
	z.union([cachedEntityMetadataSchema, legacyCachedEntityMetadataSchema]),
);

export type CachedEntityMetadata = z.infer<typeof cachedEntityMetadataSchema>;

type ParsedCachedMetadataEntry = z.infer<
	typeof cachedEntityMetadataArraySchema
>[number];
type NormalizableCachedMetadataEntry =
	| ({ kind: "current" } & z.infer<typeof cachedEntityMetadataSchema>)
	| ({ kind: "legacy" } & z.infer<typeof legacyCachedEntityMetadataSchema>);

function toNormalizableEntry(
	entry: ParsedCachedMetadataEntry,
): NormalizableCachedMetadataEntry {
	if ("name" in entry) {
		return { kind: "current", ...entry };
	}
	return { kind: "legacy", ...entry };
}

function normalizeMetadataEntry(
	entry: NormalizableCachedMetadataEntry,
): CachedEntityMetadata {
	if (entry.kind === "current") {
		return {
			id: toUndashedNotionId(entry.id),
			name: entry.name,
			displayName: entry.displayName,
		};
	}
	return {
		id: toUndashedNotionId(entry.id),
		name: entry.camelCaseName,
		displayName: entry.displayName,
	};
}

export function parseMetadataArray(content: string): CachedEntityMetadata[] {
	let parsedContent: unknown;
	try {
		parsedContent = JSON.parse(content);
	} catch {
		return [];
	}

	const parseResult = cachedEntityMetadataArraySchema.safeParse(parsedContent);
	if (!parseResult.success) {
		return [];
	}
	return parseResult.data.map(toNormalizableEntry).map(normalizeMetadataEntry);
}

/** Reads metadata from disk; returns [] if file missing or unparseable. */
function readMetadataFromDisk(filePath: string): CachedEntityMetadata[] {
	try {
		if (!fs.existsSync(filePath)) {
			return [];
		}
		const content = fs.readFileSync(filePath, "utf-8");
		return parseMetadataArray(content);
	} catch {
		return [];
	}
}

/** Loads cached database metadata used for incremental generation and index emit. */
export function readDatabaseMetadata(): CachedEntityMetadata[] {
	return readMetadataFromDisk(AST_FS_PATHS.metadataFile);
}

/** Loads cached agent metadata so source index emission can include both databases and agents. */
export function readAgentMetadataFromDisk(): CachedEntityMetadata[] {
	return readMetadataFromDisk(AST_FS_PATHS.agentMetadataFile);
}
