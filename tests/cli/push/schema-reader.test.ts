import { describe, expect, test, mock, afterEach } from "bun:test";
import fs from "fs";
import path from "path";
import { readSchemaFiles, type NotionSchemaFile } from "../../../src/cli/push/schema-reader";

describe("Schema Reader", () => {
	const tempDir = path.join(process.cwd(), "tests/temp-schemas");

	afterEach(() => {
		if (fs.existsSync(tempDir)) {
			fs.rmSync(tempDir, { recursive: true, force: true });
		}
	});

	test("returns empty array if directory does not exist", () => {
		const result = readSchemaFiles(path.join(process.cwd(), "non-existent-dir"));
		expect(result).toEqual([]);
	});

	test("reads and parses valid JSON schema files", () => {
		fs.mkdirSync(tempDir, { recursive: true });
		
		const validSchema: NotionSchemaFile = {
			parent_page_id: "123",
			title: [{ type: "text", text: { content: "Test DB" } }],
			properties: {
				Name: { title: {} }
			}
		};
		
		fs.writeFileSync(
			path.join(tempDir, "valid.json"),
			JSON.stringify(validSchema)
		);
		
		// Create a non-json file that should be ignored
		fs.writeFileSync(path.join(tempDir, "ignored.txt"), "hello");

		const result = readSchemaFiles(tempDir);
		
		expect(result.length).toBe(1);
		expect(result[0].fileName).toBe("valid.json");
		expect(result[0].schema.parent_page_id).toBe("123");
		expect(result[0].schema.properties).toHaveProperty("Name");
	});

	test("skips invalid JSON files and logs warning", () => {
		fs.mkdirSync(tempDir, { recursive: true });
		
		// Missing required properties field
		const invalidSchema = {
			parent_page_id: "123",
			title: [{ type: "text", text: { content: "Test DB" } }]
		};
		
		fs.writeFileSync(
			path.join(tempDir, "invalid.json"),
			JSON.stringify(invalidSchema)
		);

		const consoleWarnMock = mock(() => {});
		const originalWarn = console.warn;
		console.warn = consoleWarnMock;

		try {
			const result = readSchemaFiles(tempDir);
			expect(result.length).toBe(0);
			expect(consoleWarnMock).toHaveBeenCalled();
		} finally {
			console.warn = originalWarn;
		}
	});
});
