import * as babelGenerator from "@babel/generator";
import * as parser from "@babel/parser";
import * as t from "@babel/types";
import fs from "fs";
import path from "path";

const generate = babelGenerator.default || babelGenerator;

export function shouldUseTypeScript(): boolean {
  const cwd = process.cwd();
  const tsConfigCandidates = [
    "tsconfig.json",
    "tsconfig.app.json",
    "tsconfig.base.json",
    "tsconfig.build.json",
  ];

  for (const candidate of tsConfigCandidates) {
    if (fs.existsSync(path.join(cwd, candidate))) {
      return true;
    }
  }

  return false;
}

export function createConfigTemplate(isTS: boolean): string {
  const lines = [
    "// Be sure to create a .env.local file and add your NOTION_KEY",
    "",
    "// If you don't have an API key, sign up for free ",
    "// [here](https://developers.notion.com)",
    "",
    'const auth = process.env.NOTION_KEY || "your-notion-api-key-here";',
    "const NotionConfig = {",
    "\tauth,",
    "\tdatabaseIds: [",
    '\t\t// Add undashed database source IDs here (ex. "2a3c495da03c80bc99fe000bbf2be4bb")',
    "\t\t// or use the following command to automatically update",
    "\t\t// `notion add <database-source-id or URL>`",
    "\t\t// If you decide to manually add database IDs, be sure to run",
    "\t\t// `notion generate` to properly update the local database types",
    "\t],",
    "};",
    "",
    isTS ? "export default NotionConfig;" : "module.exports = NotionConfig;",
    "",
  ];

  return `${lines.join("\n")}\n`;
}

export function showSetupInstructions(): void {
  console.log("\n📚 Setup Instructions:");
  console.log(
    "1. Run: 'notion init' to create a notion.config file in project root"
  );
  console.log(
    "2. Create API key and connect databases (learn [here](https://developers.notion.com/docs/create-a-notion-integration))"
  );
  console.log(
    "3. Run 'notion add <data-source-id>' to add database to config and generate types"
  );
}

export function validateAndGetUndashedUuid(id: string): string | undefined {
  // Notion database IDs are UUIDs (with or without dashes)
  const uuidPattern =
    /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i;
  const undashedUuid = id.replace(/-/g, "");
  const isValidUndashedUuid = uuidPattern.test(undashedUuid);

  // Validate that the undashed version is a valid UUID (32 hex characters)
  if (!isValidUndashedUuid) {
    return undefined;
  }

  return undashedUuid;
}

export async function writeConfigFileWithAST(
  configPath: string,
  newDatabaseId: string,
  isTS: boolean
): Promise<boolean> {
  try {
    // Read the original file content
    const originalContent = fs.readFileSync(configPath, "utf-8");

    // Parse the file as AST
    const ast = parser.parse(originalContent, {
      sourceType: "module",
      allowImportExportEverywhere: true,
      plugins: isTS ? ["typescript"] : [],
    });

    // Find and modify the databaseIds array
    let modified = false;

    function modifyDatabaseIdsInObject(objExpression: any): void {
      for (const prop of objExpression.properties) {
        if (
          t.isObjectProperty(prop) &&
          t.isIdentifier(prop.key) &&
          prop.key.name === "databaseIds" &&
          t.isArrayExpression(prop.value)
        ) {
          // Check if the database ID already exists
          const existingIds = prop.value.elements
            .filter((el: any) => t.isStringLiteral(el))
            .map((el: any) => el.value);

          if (!existingIds.includes(newDatabaseId)) {
            // Add the new database ID to the array
            prop.value.elements.push(t.stringLiteral(newDatabaseId));
            modified = true;
          }
          break;
        }
      }
    }

    function visitNode(node: any): void {
      if (t.isVariableDeclarator(node) && t.isIdentifier(node.id)) {
        // Handle: const NotionConfig = { ... }
        if (t.isObjectExpression(node.init)) {
          modifyDatabaseIdsInObject(node.init);
        }
      } else if (
        t.isAssignmentExpression(node) &&
        t.isMemberExpression(node.left) &&
        t.isIdentifier(node.left.property) &&
        node.left.property.name === "exports"
      ) {
        // Handle: module.exports = { ... }
        if (t.isObjectExpression(node.right)) {
          modifyDatabaseIdsInObject(node.right);
        }
      } else if (t.isExportDefaultDeclaration(node)) {
        // Handle: export default { ... }
        if (t.isObjectExpression(node.declaration)) {
          modifyDatabaseIdsInObject(node.declaration);
        }
      }
    }

    // Traverse the AST
    function traverse(node: any): void {
      if (!node || typeof node !== "object") return;

      visitNode(node);

      // Recursively traverse child nodes
      for (const key in node) {
        if (node[key] && typeof node[key] === "object") {
          if (Array.isArray(node[key])) {
            node[key].forEach(traverse);
          } else {
            traverse(node[key]);
          }
        }
      }
    }

    traverse(ast);

    if (modified) {
      // Generate the code from the modified AST
      const output = generate(ast, {
        retainLines: true,
        concise: false,
      });

      // Write the modified content back to the file
      fs.writeFileSync(configPath, output.code);
      return true;
    }

    return false; // No modification needed (ID already exists)
  } catch (error: any) {
    console.error("❌ Error updating config file with AST:");
    console.error(error.message);
    throw new Error(
      `Failed to update config file. Please manually add the database ID "${newDatabaseId}" to your config file.`
    );
  }
}

export function isHelpCommand(args: string[]): boolean {
  const possibleArgument = args.length >= 1 ? args[0] : null;
  if (!possibleArgument) {
    return false;
  }
  switch (possibleArgument) {
    case "help":
    case "--help":
    case "-h":
      return true;
    default:
      return false;
  }
}
