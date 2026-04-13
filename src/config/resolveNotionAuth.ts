/**
 * Input accepted by {@link resolveNotionAuth} and {@link NotionORMBase}.
 */
export type NotionORMConfig = {
	auth?: string;
};

/**
 * Resolves the Notion API token from explicit `config.auth` or `process.env.NOTION_KEY`.
 *
 * @throws Error with actionable guidance when neither yields a non-empty string.
 */
export function resolveNotionAuth(config: NotionORMConfig): string {
	const token = config.auth?.trim() || process.env.NOTION_KEY?.trim();
	if (token === undefined || token.length === 0) {
		throw new Error(
			[
				"Missing Notion API credentials.",
				"Pass `auth` when constructing NotionORM (for example `new NotionORM({ auth: process.env.NOTION_KEY })`),",
				"or set the NOTION_KEY environment variable (for example in a `.env` file loaded by your runtime).",
			].join(" "),
		);
	}
	return token;
}
