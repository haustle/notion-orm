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
			// The Notion SDK types for create database are currently missing the properties field
			// even though the API requires it. We cast to any to bypass this type error.
			const response = await client.databases.create({
				parent: {
					type: "page_id",
					page_id: parentPageId,
				},
				title: schema.title,
				description: schema.description,
				properties: schema.properties,
			} as any);

			const newDatabaseId = response.id;
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
