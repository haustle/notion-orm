import fs from "fs";
import path from "path";

export type CodegenEnvironment = "typescript" | "javascript";

export type CodegenConfigRuntime = {
	isTS: boolean;
};

const TSCONFIG_CANDIDATES = [
	"tsconfig.json",
	"tsconfig.app.json",
	"tsconfig.base.json",
	"tsconfig.build.json",
] as const;

function hasTypeScriptConfig(projectRoot: string): boolean {
	return TSCONFIG_CANDIDATES.some((candidate) =>
		fs.existsSync(path.join(projectRoot, candidate)),
	);
}

export function resolveCodegenEnvironment(args?: {
	projectRoot?: string;
	configRuntime?: CodegenConfigRuntime;
}): CodegenEnvironment {
	const projectRoot = args?.projectRoot ?? process.cwd();
	if (args?.configRuntime?.isTS) {
		return "typescript";
	}
	return hasTypeScriptConfig(projectRoot) ? "typescript" : "javascript";
}

export function getCodegenArtifactExtension(
	environment: CodegenEnvironment,
): "ts" | "js" {
	return environment === "typescript" ? "ts" : "js";
}

export function getCodegenImportExtension(): "js" {
	return "js";
}
