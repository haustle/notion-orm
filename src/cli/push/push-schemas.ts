import { Client } from "@notionhq/client";
import path from "path";
import { getNotionConfig } from "../../config/loadConfig";
import { findConfigFile } from "../../config/findConfigFile";
import { writeConfigFileWithAST } from "../helpers";
import { readDatabaseMetadata } from "../../ast/shared/cached-metadata";
import { AST_FS_PATHS } from "../../ast/shared/constants";
import { readSchemaFiles, type ParsedSchemaFile } from "./schema-reader";
import { toDashedNotionId } from "../../helpers";
import { PACKAGE_RUNTIME_CONSTANTS } from "../../runtime-constants";

/**
 * Extracts a plain text title from a Notion rich text array.
 */
function getPlainTextTitle(titleArray: any[] | undefined): string | undefined {
	if (!titleArray || !Array.isArray(titleArray) || titleArray.length === 0) {
		return undefined;
	}
	return titleArray.map((t) => t.plain_text || t.text?.content || "").join("").trim();
}

/**
 * Checks if a schema matches an existing database in the local metadata.
 * We match by title. If the schema has no title, we match by filename (without extension).
 */
function isSchemaAlreadyPushed(
	schemaFile: ParsedSchemaFile,
	existingDatabases: ReturnType<typeof readDatabaseMetadata>,
): boolean {
	const schemaTitle = getPlainTextTitle(schemaFile.schema.title);
	const fallbackName = path.basename(schemaFile.fileName, ".json");
	
	const targetName = schemaTitle || fallbackName;

	return existingDatabases.some((db) => {
		// Compare against the display name (which is the Notion title)
		// or the camelCased name if display name isn't available
		return db.displayName === targetName || db.name === targetName;
	});
}

type UnknownRecord = Record<string, unknown>;

function firstDataSourceIdFromDatabaseResponse(
	database: UnknownRecord,
): string | undefined {
	const refs = database["data_sources"] ?? database["dataSources"];
	if (!Array.isArray(refs) || refs.length === 0) {
		return undefined;
	}
	const first = refs[0] as UnknownRecord | undefined;
	const id = first?.id;
	return typeof id === "string" ? id : undefined;
}

/**
 * Codegen calls `dataSources.retrieve`, which needs a **data source** id. The database
 * **container** id from `response.id` fails retrieve. The JS SDK may camelCase
 * `data_sources` → `dataSources`.
 */
async function resolveDataSourceIdAfterDatabaseCreate(args: {
	client: Client;
	createResponse: UnknownRecord;
}): Promise<string> {
	const fromCreate = firstDataSourceIdFromDatabaseResponse(args.createResponse);
	if (fromCreate) {
		return fromCreate;
	}

	const databaseId = args.createResponse.id;
	if (typeof databaseId !== "string") {
		throw new Error("Create database response missing string `id`.");
	}

	console.warn(
		"s,?  Create-database response had no data source id; fetching database to read data_sources.",
	);
	const retrieved = (await args.client.databases.retrieve({
		database_id: databaseId,
	})) as unknown as UnknownRecord;

	const fromRetrieve = firstDataSourceIdFromDatabaseResponse(retrieved);
	if (fromRetrieve) {
		return fromRetrieve;
	}

	console.warn(
		"s,?  Could not resolve data source id; using database id (sync may fail — use `dataSources.retrieve` id in notion.config).",
	);
	return databaseId;
}

export interface PushSchemasOptions {
	/**
	 * If true, skips pushing schemas and just returns.
	 */
	dryRun?: boolean;
}

/**
 * Reads local schemas, diffs against metadata, and pushes new schemas to Notion.
 * Returns true if any new databases were created (meaning config was updated).
 */
export async function pushNewSchemas(options?: PushSchemasOptions): Promise<boolean> {
	const config = await getNotionConfig();
	const configFile = findConfigFile();

	if (!configFile) {
		console.warn("s,?  No config file found, skipping schema push.");
		return false;
	}

	const schemasDir = path.join(AST_FS_PATHS.CODEGEN_ROOT_DIR, "schemas");
	const parsedSchemas = readSchemaFiles(schemasDir);

	if (parsedSchemas.length === 0) {
		return false;
	}

	const existingDatabases = readDatabaseMetadata();
	const schemasToPush = parsedSchemas.filter(
		(schema) => !isSchemaAlreadyPushed(schema, existingDatabases),
	);

	if (schemasToPush.length === 0) {
		return false;
	}

	if (options?.dryRun) {
		console.log(`s,?  Found ${schemasToPush.length} new schemas to push (dry run).`);
		return false;
	}

	console.log(`o. Found ${schemasToPush.length} new schemas to push.`);

	const client = new Client({
		auth: config.auth,
		notionVersion: PACKAGE_RUNTIME_CONSTANTS.NOTION_API_VERSION,
	});

	let configUpdated = false;

	for (const schemaFile of schemasToPush) {
		const { schema, fileName } = schemaFile;
		
		const parentPageId = schema.parent_page_id || config.defaultParentPageId;
		
		if (!parentPageId) {
			console.error(`?O Error: Schema '${fileName}' is missing a parent_page_id, and no defaultParentPageId is set in notion.config.ts.`);
			console.error(`   Skipping creation of '${fileName}'.`);
			continue;
		}

		const schemaTitle = getPlainTextTitle(schema.title) || path.basename(fileName, ".json");

		console.log(`   Pushing schema '${schemaTitle}'...`);

		try {
			// API 2025-09-03+: properties belong under `initial_data_source`; top-level
			// `properties` is ignored by the server (SDK warns). Cast until types catch up.
			const response = (await client.databases.create({
				parent: {
					type: "page_id",
					page_id: toDashedNotionId(parentPageId),
				},
				title: schema.title,
				description: schema.description,
				initial_data_source: {
					properties: schema.properties,
				},
			} as any)) as unknown as UnknownRecord;

			const newDatabaseId = await resolveDataSourceIdAfterDatabaseCreate({
				client,
				createResponse: response,
			});
			console.log(`   Created database '${schemaTitle}' with ID: ${toDashedNotionId(newDatabaseId)}`);

			// Update config file
			await writeConfigFileWithAST(
				configFile.path,
				newDatabaseId,
				configFile.isTS,
				schemaTitle,
			);
			
			configUpdated = true;
		} catch (error) {
			console.error(`?O Failed to create database for schema '${fileName}':`);
			if (error instanceof Error) {
				console.error(`   ${error.message}`);
			} else {
				console.error(error);
			}
		}
	}

	return configUpdated;
}
