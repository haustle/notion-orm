import fs from "node:fs";
import path from "node:path";
import * as parser from "@babel/parser";
import * as t from "@babel/types";

const BUILD_ROOT = path.resolve(process.cwd(), "build");
const PATCHABLE_EXTENSION = ".js";

function splitSpecifierSuffix(specifier) {
	const suffixStart = specifier.search(/[?#]/);
	if (suffixStart === -1) {
		return {
			pathname: specifier,
			suffix: "",
		};
	}
	return {
		pathname: specifier.slice(0, suffixStart),
		suffix: specifier.slice(suffixStart),
	};
}

function shouldRewriteSpecifier(specifier) {
	const { pathname } = splitSpecifierSuffix(specifier);
	return (
		(pathname.startsWith("./") || pathname.startsWith("../")) &&
		!path.extname(pathname) &&
		!pathname.endsWith("/")
	);
}

function rewriteSpecifier(specifier) {
	if (!shouldRewriteSpecifier(specifier)) {
		return specifier;
	}
	const { pathname, suffix } = splitSpecifierSuffix(specifier);
	return `${pathname}.js${suffix}`;
}

function parseModuleSource(source) {
	return parser.parse(source, {
		sourceType: "unambiguous",
		plugins: ["importAttributes"],
	});
}

function walkAst(node, visitor) {
	if (!node || typeof node !== "object") {
		return;
	}
	visitor(node);
	const childKeys = t.VISITOR_KEYS[node.type] ?? [];
	for (const childKey of childKeys) {
		const child = node[childKey];
		if (Array.isArray(child)) {
			for (const nestedChild of child) {
				walkAst(nestedChild, visitor);
			}
			continue;
		}
		walkAst(child, visitor);
	}
}

function buildSpecifierEdit(args) {
	const { literal, source } = args;
	if (literal.start == null || literal.end == null) {
		return undefined;
	}
	const rewrittenSpecifier = rewriteSpecifier(literal.value);
	if (rewrittenSpecifier === literal.value) {
		return undefined;
	}
	const rawLiteral = source.slice(literal.start, literal.end);
	const quote = rawLiteral[0];
	const preservesOriginalQuotes =
		(quote === '"' || quote === "'") && rawLiteral.at(-1) === quote;
	return {
		start: literal.start,
		end: literal.end,
		replacement: preservesOriginalQuotes
			? `${quote}${rewrittenSpecifier}${quote}`
			: JSON.stringify(rewrittenSpecifier),
	};
}

function collectSpecifierEdits(source) {
	const ast = parseModuleSource(source);
	const edits = [];
	walkAst(ast.program, (node) => {
		if (
			(t.isImportDeclaration(node) ||
				t.isExportNamedDeclaration(node) ||
				t.isExportAllDeclaration(node)) &&
			node.source &&
			t.isStringLiteral(node.source)
		) {
			const edit = buildSpecifierEdit({
				literal: node.source,
				source,
			});
			if (edit) {
				edits.push(edit);
			}
			return;
		}
		if (t.isImportExpression(node) && t.isStringLiteral(node.source)) {
			const edit = buildSpecifierEdit({
				literal: node.source,
				source,
			});
			if (edit) {
				edits.push(edit);
			}
			return;
		}
		if (
			t.isCallExpression(node) &&
			t.isImport(node.callee) &&
			node.arguments.length > 0 &&
			t.isStringLiteral(node.arguments[0])
		) {
			const edit = buildSpecifierEdit({
				literal: node.arguments[0],
				source,
			});
			if (edit) {
				edits.push(edit);
			}
		}
	});
	return edits.sort((left, right) => right.start - left.start);
}

export function rewriteRelativeImportSpecifiers(source) {
	let updated = source;
	for (const edit of collectSpecifierEdits(source)) {
		updated =
			updated.slice(0, edit.start) +
			edit.replacement +
			updated.slice(edit.end);
	}
	return updated;
}

function patchBuildDirectory(directory) {
	for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
		const fullPath = path.join(directory, entry.name);
		if (entry.isDirectory()) {
			patchBuildDirectory(fullPath);
			continue;
		}

		if (path.extname(entry.name) !== PATCHABLE_EXTENSION) {
			continue;
		}

		const original = fs.readFileSync(fullPath, "utf8");
		const updated = rewriteRelativeImportSpecifiers(original);
		if (updated !== original) {
			fs.writeFileSync(fullPath, updated);
		}
	}
}

if (fs.existsSync(BUILD_ROOT)) {
	patchBuildDirectory(BUILD_ROOT);
}
