/**
 * Removes generated `notion/` artifacts before a full sync while preserving
 * `notion/schemas/` (push inputs and other hand-maintained schema JSON).
 */
import fs from "fs";
import path from "path";
import { AST_FS_PATHS } from "./constants";
import {
	type CodegenEnvironment,
	codegenArtifactFileName,
} from "./codegen-environment";

type ClearNotionCodegenOutputArgs = {
	environment: CodegenEnvironment;
};

export function clearNotionCodegenOutputForSync(
	args: ClearNotionCodegenOutputArgs,
): void {
	const { environment } = args;
	const root = AST_FS_PATHS.CODEGEN_ROOT_DIR;

	for (const dir of [AST_FS_PATHS.DATABASES_DIR, AST_FS_PATHS.AGENTS_DIR]) {
		if (fs.existsSync(dir)) {
			fs.rmSync(dir, { recursive: true, force: true });
		}
	}

	const rootGeneratedFiles = [
		path.join(root, codegenArtifactFileName("index", environment)),
		AST_FS_PATHS.buildIndexDts,
		AST_FS_PATHS.buildIndexDtsMap,
	];
	for (const filePath of rootGeneratedFiles) {
		if (fs.existsSync(filePath)) {
			fs.rmSync(filePath, { force: true });
		}
	}
}
