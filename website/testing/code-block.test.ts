/// <reference types="bun-types" />
import { expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CodeBlock } from "../src/site/CodeBlock";

test("code blocks include highlighted, indented lines before client JavaScript runs", async () => {
	const html = renderToStaticMarkup(
		createElement(
			CodeBlock,
			null,
			createElement(
				"code",
				{ className: "language-ts" },
				'// file: example.ts\nconst title: string = "Coffee";\n  console.log(title);\n',
			),
		),
	);

	expect(html).toContain("example.ts");
	expect(html).not.toContain("// file:");
	expect(html).toMatch(/class="token declaration" style="[^"]+">const<\/span>/);
	expect(html).toMatch(
		/class="token string" style="[^"]+">&quot;Coffee&quot;<\/span>/,
	);
	const lines: string[] = [];
	await new HTMLRewriter()
		.on(".token-line", {
			element() {
				lines.push("");
			},
			text(chunk) {
				lines[lines.length - 1] += chunk.text;
			},
		})
		.transform(new Response(html))
		.text();
	expect(lines).toEqual([
		"const title: string = &quot;Coffee&quot;;",
		"  console.log(title);",
	]);
});

test("terminal, plain-text, and unsupported fences stay readable without highlighting", () => {
	for (const language of ["bash", "txt", "not-a-grammar", null]) {
		const html = renderToStaticMarkup(
			createElement(
				CodeBlock,
				null,
				createElement(
					"code",
					{ className: language === null ? undefined : `language-${language}` },
					"first line\n  second line\n",
				),
			),
		);

		expect(html).toContain("first line\n  second line</code>");
		expect(html).not.toContain('class="token ');
	}
});
