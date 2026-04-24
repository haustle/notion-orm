import { renderConfigTemplateModule } from "../ast/shared/emit/config-emitter";
import { resolveCodegenEnvironment } from "../ast/shared/codegen-environment";

/** Heuristic for `notion init`: TS projects get a TS config template by default. */
export function shouldUseTypeScript(): boolean {
	return resolveCodegenEnvironment() === "typescript";
}

/** Renders the starter config template and guarantees a trailing newline. */
export function createConfigTemplate(isTS: boolean): string {
	const renderedTemplate = renderConfigTemplateModule({ isTS });
	return renderedTemplate.endsWith("\n")
		? renderedTemplate
		: `${renderedTemplate}\n`;
}

/** Prints setup guidance together with copy-pastable example configs. */
export function showSetupInstructions(): void {
	console.log("\n📚 Setup Instructions:");
	console.log(
		"1. Run: notion init [--ts|--js] (defaults to TypeScript when tsconfig.json is present)",
	);
	console.log("2. Add your Notion integration token and database IDs");
	console.log("3. Run: notion sync (generates database types)");
	console.log(
		"4. (Optional) Run: notion setup-agents-sdk (installs the paid Agents SDK, then re-run notion sync)",
	);

	console.log("\n📝 Example JavaScript config (notion.config.js):");
	console.log(`\n${createConfigTemplate(false).trimEnd()}\n`);

	console.log("📝 Example TypeScript config (notion.config.ts):");
	console.log(`\n${createConfigTemplate(true).trimEnd()}\n`);

	console.log("\n🔗 Need help getting your integration token?");
	console.log(
		"   Visit: https://developers.notion.com/docs/create-a-notion-integration",
	);
}
