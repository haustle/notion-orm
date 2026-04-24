import { describe, expect, test } from "bun:test";
import { rewriteRelativeImportSpecifiers } from "../../../scripts/patch-build-import-extensions.mjs";

describe("patch build import extensions", () => {
	test("rewrites static import and export specifiers without touching bare imports", () => {
		const source = [
			'import thing from "./thing";',
			'export { thing } from "../shared/value";',
			'import pkg from "some-package";',
		].join("\n");

		expect(rewriteRelativeImportSpecifiers(source)).toBe(
			[
				'import thing from "./thing.js";',
				'export { thing } from "../shared/value.js";',
				'import pkg from "some-package";',
			].join("\n"),
		);
	});

	test("rewrites dynamic import specifiers and preserves query or hash suffixes", () => {
		const source = [
			'const lazyValue = import("./lazy/module");',
			'const withQuery = import("./feature?worker");',
			'const withHash = import("./chunk#entry");',
		].join("\n");

		expect(rewriteRelativeImportSpecifiers(source)).toBe(
			[
				'const lazyValue = import("./lazy/module.js");',
				'const withQuery = import("./feature.js?worker");',
				'const withHash = import("./chunk.js#entry");',
			].join("\n"),
		);
	});

	test("leaves already-qualified and directory specifiers alone", () => {
		const source = [
			'import "./already.js";',
			'import "../nested/index.mjs";',
			'import "./folder/";',
		].join("\n");

		expect(rewriteRelativeImportSpecifiers(source)).toBe(source);
	});
});
