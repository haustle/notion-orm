import { z } from "zod";
import { objectKeys } from "../typeUtils";

export const notionConfigSchema = z.object({
	auth: z.string().min(1, "Missing 'auth' field in notion config"),
	databases: z.array(z.string()),
	agents: z.array(z.string()),
});

export type NotionConfigType = z.infer<typeof notionConfigSchema>;

/** Runtime key list derived from the Zod object shape (auth, databases, agents). */
export const NOTION_CONFIG_FIELD_KEYS = objectKeys(
	notionConfigSchema.shape,
) satisfies ReadonlyArray<keyof NotionConfigType>;
