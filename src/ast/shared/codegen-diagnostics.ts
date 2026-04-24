/**
 * Optional sink for codegen warnings/errors so CLI can buffer output until
 * progress UI is torn down.
 */

export type CodegenDiagnosticLevel = "warn" | "error";

export type CodegenDiagnostic = {
	level: CodegenDiagnosticLevel;
	message: string;
};

export type CodegenDiagnosticSink = (diagnostic: CodegenDiagnostic) => void;

/** Human-readable line for skipped / unsupported columns (sync UX). */
export function formatCodegenSkippedPropertyLine(args: {
	databaseDisplayName: string;
	propertyName: string;
	notionType: string;
}): string {
	return `[${args.databaseDisplayName}] \`${args.propertyName}\` (${args.notionType}) was skipped`;
}

/** Select / multi_select column where the handler did not yield an options identifier. */
export function formatCodegenMissingOptionsIdentifierLine(args: {
	databaseModuleName: string;
	propertyName: string;
	propertyType: string;
}): string {
	return `[${args.databaseModuleName}] Missing options identifier for \`${args.propertyName}\` (${args.propertyType}); skipping.`;
}
