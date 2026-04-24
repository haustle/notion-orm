import fs from "node:fs";
import path from "node:path";
import * as babelParser from "@babel/parser";
import * as babelTypes from "@babel/types";

/**
 * Rewrites extensionless relative specifiers in emitted JS files to explicit
 * `.js` or `/index.js` forms so Node ESM resolution is deterministic.
 */
const BUILD_ROOT = path.resolve(process.cwd(), "build");
const JAVASCRIPT_EXTENSION = ".js";
const INDEX_BASENAME = "index.js";

function splitImportPathAndSuffix(importPathText) {
	const suffixStart = importPathText.search(/[?#]/);
	if (suffixStart === -1) {
		return {
			pathname: importPathText,
			suffix: "",
		};
	}
	return {
		pathname: importPathText.slice(0, suffixStart),
		suffix: importPathText.slice(suffixStart),
	};
}

function isRelativeImportPathWithoutExtension(importPathText) {
	const { pathname } = splitImportPathAndSuffix(importPathText);
	return (
		(pathname.startsWith("./") || pathname.startsWith("../")) &&
		!path.extname(pathname) &&
		!pathname.endsWith("/")
	);
}

/**
 * TypeScript may emit an import path like `"../dir"` for a real
 * `../dir/index.js` target.
 * Node ESM requires fully specified directory indexes (`../dir/index.js`).
 */
function rewriteRelativeImportPath(importPathText, importerFilePath) {
	if (!isRelativeImportPathWithoutExtension(importPathText)) {
		return importPathText;
	}
	const { pathname, suffix } = splitImportPathAndSuffix(importPathText);
	if (!importerFilePath) {
		return `${pathname}${JAVASCRIPT_EXTENSION}${suffix}`;
	}

	const importerDirectoryPath = path.dirname(importerFilePath);
	const resolvedImportPath = path.resolve(importerDirectoryPath, pathname);
	const resolvedFilePath = `${resolvedImportPath}${JAVASCRIPT_EXTENSION}`;
	const resolvedIndexPath = path.join(resolvedImportPath, INDEX_BASENAME);

	let rewrittenPathname = `${pathname}${JAVASCRIPT_EXTENSION}`;
	if (!fs.existsSync(resolvedFilePath) && fs.existsSync(resolvedIndexPath)) {
		rewrittenPathname = `${pathname}/${INDEX_BASENAME}`;
	}
	return `${rewrittenPathname}${suffix}`;
}

function parseModuleSource(moduleSourceText) {
	return babelParser.parse(moduleSourceText, {
		sourceType: "unambiguous",
		plugins: ["importAttributes"],
	});
}

function visitAst(astNode, visitor) {
	if (!astNode || typeof astNode !== "object") {
		return;
	}
	visitor(astNode);
	const childPropertyNames = babelTypes.VISITOR_KEYS[astNode.type] ?? [];
	for (const childPropertyName of childPropertyNames) {
		const childNode = astNode[childPropertyName];
		if (Array.isArray(childNode)) {
			for (const nestedChildNode of childNode) {
				visitAst(nestedChildNode, visitor);
			}
			continue;
		}
		visitAst(childNode, visitor);
	}
}

function createImportPathEdit(args) {
	const { importPathLiteralNode, moduleSourceText, importerFilePath } = args;
	if (importPathLiteralNode.start == null || importPathLiteralNode.end == null) {
		return undefined;
	}
	const rewrittenImportPathText = rewriteRelativeImportPath(
		importPathLiteralNode.value,
		importerFilePath,
	);
	if (rewrittenImportPathText === importPathLiteralNode.value) {
		return undefined;
	}
	const originalLiteralSource = moduleSourceText.slice(
		importPathLiteralNode.start,
		importPathLiteralNode.end,
	);
	const quoteCharacter = originalLiteralSource[0];
	const preservesOriginalQuotes =
		(quoteCharacter === '"' || quoteCharacter === "'") &&
		originalLiteralSource.at(-1) === quoteCharacter;
	return {
		start: importPathLiteralNode.start,
		end: importPathLiteralNode.end,
		replacement: preservesOriginalQuotes
			? `${quoteCharacter}${rewrittenImportPathText}${quoteCharacter}`
			: JSON.stringify(rewrittenImportPathText),
	};
}

function getImportPathLiteralNode(astNode) {
	const sourceLiteralNode =
		babelTypes.isImportDeclaration(astNode) ||
		babelTypes.isExportNamedDeclaration(astNode) ||
		babelTypes.isExportAllDeclaration(astNode) ||
		babelTypes.isImportExpression(astNode)
			? astNode.source
			: undefined;
	if (sourceLiteralNode && babelTypes.isStringLiteral(sourceLiteralNode)) {
		return sourceLiteralNode;
	}
	if (
		babelTypes.isCallExpression(astNode) &&
		babelTypes.isImport(astNode.callee) &&
		astNode.arguments.length > 0 &&
		babelTypes.isStringLiteral(astNode.arguments[0])
	) {
		return astNode.arguments[0];
	}
	return undefined;
}

function collectImportPathEdits(moduleSourceText, importerFilePath) {
	let parsedModuleAst;
	try {
		parsedModuleAst = parseModuleSource(moduleSourceText);
	} catch (error) {
		const reason = error instanceof Error ? error.message : String(error);
		const fileLabel = importerFilePath ?? "<unknown>";
		console.warn(
			`Warning: skipping import-path rewrite for ${fileLabel}: ${reason}`,
		);
		return [];
	}

	const importPathEdits = [];
	visitAst(parsedModuleAst.program, (astNode) => {
		const importPathLiteralNode = getImportPathLiteralNode(astNode);
		if (!importPathLiteralNode) {
			return;
		}
		const edit = createImportPathEdit({
			importPathLiteralNode,
			moduleSourceText,
			importerFilePath,
		});
		if (edit) {
			importPathEdits.push(edit);
		}
	});
	return importPathEdits.sort(
		(laterEdit, earlierEdit) => earlierEdit.start - laterEdit.start,
	);
}

export function rewriteRelativeImportSpecifiers(
	moduleSourceText,
	importerFilePath,
) {
	let rewrittenModuleSourceText = moduleSourceText;
	for (const importPathEdit of collectImportPathEdits(
		moduleSourceText,
		importerFilePath,
	)) {
		rewrittenModuleSourceText =
			rewrittenModuleSourceText.slice(0, importPathEdit.start) +
			importPathEdit.replacement +
			rewrittenModuleSourceText.slice(importPathEdit.end);
	}
	return rewrittenModuleSourceText;
}

function patchBuildDirectory(directoryPath) {
	for (const directoryEntry of fs.readdirSync(directoryPath, {
		withFileTypes: true,
	})) {
		const entryPath = path.join(directoryPath, directoryEntry.name);
		if (directoryEntry.isDirectory()) {
			patchBuildDirectory(entryPath);
			continue;
		}

		if (path.extname(directoryEntry.name) !== JAVASCRIPT_EXTENSION) {
			continue;
		}

		const originalFileSource = fs.readFileSync(entryPath, "utf8");
		const rewrittenFileSource = rewriteRelativeImportSpecifiers(
			originalFileSource,
			entryPath,
		);
		if (rewrittenFileSource !== originalFileSource) {
			fs.writeFileSync(entryPath, rewrittenFileSource);
		}
	}
}

if (fs.existsSync(BUILD_ROOT)) {
	patchBuildDirectory(BUILD_ROOT);
}
