import fs from "fs";
import path from "path";
import { z } from "zod";

/**
 * Zod schema for a Notion database schema definition file.
 * This is a minimal subset of the Notion API `Create a database` payload.
 */
export const notionSchemaFileSchema = z.object({
	parent_page_id: z.string().optional(),
	title: z.array(z.any()).optional(),
	description: z.array(z.any()).optional(),
	properties: z.record(z.any()),
});

export type NotionSchemaFile = z.infer<typeof notionSchemaFileSchema>;

export interface ParsedSchemaFile {
	filePath: string;
	fileName: string;
	schema: NotionSchemaFile;
}

/**
 * Reads all `.json` files in the `notion/schemas/` directory and parses them.
 */
export function readSchemaFiles(schemasDir: string): ParsedSchemaFile[] {
	if (!fs.existsSync(schemasDir)) {
		return [];
	}

	const files = fs.readdirSync(schemasDir);
	const parsedSchemas: ParsedSchemaFile[] = [];

	for (const file of files) {
		if (!file.endsWith(".json")) {
			continue;
		}

		const filePath = path.join(schemasDir, file);
		const content = fs.readFileSync(filePath, "utf-8");

		try {
			const json = JSON.parse(content);
			const schema = notionSchemaFileSchema.parse(json);
			parsedSchemas.push({
				filePath,
				fileName: file,
				schema,
			});
		} catch (error) {
			console.warn(`s,?  Warning: Failed to parse schema file ${file}:`);
			if (error instanceof z.ZodError) {
				console.warn(error.errors);
			} else {
				console.warn(error);
			}
		}
	}

	return parsedSchemas;
}
