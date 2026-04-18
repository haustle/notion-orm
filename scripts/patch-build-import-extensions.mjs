import fs from "node:fs";
import path from "node:path";

const BUILD_ROOT = path.resolve(process.cwd(), "build");
const JS_EXTENSIONS = new Set([".js", ".mjs", ".cjs", ".json"]);

function shouldRewriteSpecifier(specifier) {
	return (
		(specifier.startsWith("./") || specifier.startsWith("../")) &&
		!path.extname(specifier) &&
		!specifier.endsWith("/")
	);
}

function rewriteRelativeImportSpecifiers(source) {
	return source.replace(
		/(from\s+["'])(\.{1,2}\/[^"'?#]+)(["'])|((?:import|export)\s*\(\s*["'])(\.{1,2}\/[^"'?#]+)(["']\s*\))/g,
		(...args) => {
			const staticPrefix = args[1];
			const staticSpecifier = args[2];
			const staticSuffix = args[3];
			if (staticSpecifier && staticPrefix && staticSuffix) {
				return shouldRewriteSpecifier(staticSpecifier)
					? `${staticPrefix}${staticSpecifier}.js${staticSuffix}`
					: `${staticPrefix}${staticSpecifier}${staticSuffix}`;
			}

			const dynamicPrefix = args[4];
			const dynamicSpecifier = args[5];
			const dynamicSuffix = args[6];
			if (dynamicSpecifier && dynamicPrefix && dynamicSuffix) {
				return shouldRewriteSpecifier(dynamicSpecifier)
					? `${dynamicPrefix}${dynamicSpecifier}.js${dynamicSuffix}`
					: `${dynamicPrefix}${dynamicSpecifier}${dynamicSuffix}`;
			}

			return args[0];
		},
	);
}

function patchBuildDirectory(directory) {
	for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
		const fullPath = path.join(directory, entry.name);
		if (entry.isDirectory()) {
			patchBuildDirectory(fullPath);
			continue;
		}

		if (!JS_EXTENSIONS.has(path.extname(entry.name))) {
			continue;
		}
		if (path.extname(entry.name) !== ".js") {
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
