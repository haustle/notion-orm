import { z } from "zod";

export const notionConfigSchema = z.object({
	auth: z.string().min(1, "Missing 'auth' field in notion config"),
	databases: z.array(z.string()),
	agents: z.array(z.string()),
});

export type NotionConfigType = z.infer<typeof notionConfigSchema>;
