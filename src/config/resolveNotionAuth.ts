import { loadDotEnvFromCwd } from "./loadDotEnvFromCwd";

/**
 * Input accepted by {@link resolveNotionAuth} and {@link NotionORMBase}.
 */
export type NotionORMConfig = {
	auth?: string;
};

/**
 * Resolves the Notion API token using a single, predictable precedence:
 *
 * 1. Explicit `config.auth` (trimmed, when non-empty).
 * 2. `process.env.NOTION_KEY` — populated either by the shell or by a `.env`
 *    file in the current project root, which this module loads automatically
 *    (shell values always win over `.env` values).
 *
 * @throws Error with actionable guidance when neither yields a non-empty string.
 */
export function resolveNotionAuth(config: NotionORMConfig): string {
	loadDotEnvFromCwd();
	const token = config.auth?.trim() || process.env.NOTION_KEY?.trim();
	if (token === undefined || token.length === 0) {
		throw new Error(
			[
				"Missing Notion API credentials.",
				"Pass `auth` when constructing NotionORM (for example `new NotionORM({ auth: process.env.NOTION_KEY })`),",
				"or set the NOTION_KEY environment variable in your shell or in a `.env` file at your project root.",
			].join(" "),
		);
	}
	return token;
}
