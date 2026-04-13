import generate from "@babel/generator";
import * as parser from "@babel/parser";
import * as t from "@babel/types";
import type {
	ConfigListItem,
	ConfigListKey,
	ConfigListUpdateStrategy,
} from "../../src/ast/shared/emit/config-emitter";
import { renderConfigTemplateModule } from "../../src/ast/shared/emit/config-emitter";
import type { OrmEntityMetadata } from "../../src/ast/shared/emit/orm-index-emitter";
import type { RegistryEntry } from "../../src/ast/shared/emit/registry-emitter";
import { MOCK_DATA_SOURCE_ID, MOCK_DATA_SOURCE_ID_B } from "./test-mock-ids";

export const REGISTRY_SCENARIO = {
	registryName: "items",
	entries: [
		{
			importName: "InventoryItems",
			importPath: "./InventoryItems",
			registryKey: "inventoryItems",
		},
		{
			importName: "CustomerOrders",
			importPath: "./CustomerOrders",
			registryKey: "customerOrders",
		},
	],
} as const satisfies {
	registryName: string;
	entries: RegistryEntry[];
};

export interface ConfigPatchScenario {
	name: string;
	isTypeScript: boolean;
	initialConfig: {
		databases: ConfigListItem[];
		agents: ConfigListItem[];
	};
	type: ConfigListKey;
	items: ConfigListItem[];
	strategy: ConfigListUpdateStrategy;
	expected: {
		modified: boolean;
		databases: string[];
		agents: string[];
	};
}

function createConfigArrayExpression(
	items: ConfigListItem[],
): t.ArrayExpression {
	return t.arrayExpression(
		items.map((item) => {
			const literal = t.stringLiteral(item.value);
			if (item.comment) {
				t.addComment(literal, "trailing", ` ${item.comment} `, false);
			}
			return literal;
		}),
	);
}

function updateConfigListProperty(args: {
	objectExpression: t.ObjectExpression;
	key: ConfigListKey;
	items: ConfigListItem[];
}): void {
	const property = args.objectExpression.properties.find(
		(node): node is t.ObjectProperty =>
			t.isObjectProperty(node) &&
			t.isIdentifier(node.key) &&
			node.key.name === args.key &&
			t.isArrayExpression(node.value),
	);
	if (!property) {
		throw new Error(
			`Expected NotionConfig to include '${args.key}' array property`,
		);
	}
	property.value = createConfigArrayExpression(args.items);
}

export function buildNotionConfigSource(args: {
	isTypeScript: boolean;
	databases: ConfigListItem[];
	agents: ConfigListItem[];
}): string {
	const { isTypeScript, databases, agents } = args;
	const templateSource = renderConfigTemplateModule({ isTS: isTypeScript });
	const ast = parser.parse(templateSource, {
		sourceType: "module",
		plugins: isTypeScript ? ["typescript"] : [],
	});
	const notionConfigDeclaration = ast.program.body.find(
		(node): node is t.VariableDeclaration =>
			t.isVariableDeclaration(node) &&
			node.declarations.some(
				(declaration) =>
					t.isIdentifier(declaration.id) &&
					declaration.id.name === "NotionConfig" &&
					t.isObjectExpression(declaration.init),
			),
	);
	if (!notionConfigDeclaration) {
		throw new Error("Unable to locate NotionConfig declaration in template");
	}
	const notionConfigObject = notionConfigDeclaration.declarations.find(
		(
			declaration,
		): declaration is t.VariableDeclarator & {
			init: t.ObjectExpression;
		} =>
			t.isIdentifier(declaration.id) &&
			declaration.id.name === "NotionConfig" &&
			t.isObjectExpression(declaration.init),
	)?.init;
	if (!notionConfigObject) {
		throw new Error("Unable to locate NotionConfig object literal in template");
	}
	updateConfigListProperty({
		objectExpression: notionConfigObject,
		key: "databases",
		items: databases,
	});
	updateConfigListProperty({
		objectExpression: notionConfigObject,
		key: "agents",
		items: agents,
	});
	return generate(ast, { retainLines: true, concise: false }).code;
}

export const CONFIG_PATCH_SCENARIOS = [
	{
		name: "append unique database entries",
		isTypeScript: true,
		initialConfig: {
			databases: [{ value: MOCK_DATA_SOURCE_ID }],
			agents: [{ value: "agent-old" }],
		},
		type: "databases",
		items: [{ value: MOCK_DATA_SOURCE_ID_B, comment: "Orders" }],
		strategy: "appendUnique",
		expected: {
			modified: true,
			databases: [MOCK_DATA_SOURCE_ID, MOCK_DATA_SOURCE_ID_B],
			agents: ["agent-old"],
		},
	},
	{
		name: "replace all agent entries",
		isTypeScript: true,
		initialConfig: {
			databases: [{ value: MOCK_DATA_SOURCE_ID }],
			agents: [{ value: "agent-old" }],
		},
		type: "agents",
		items: [
			{ value: "agent-1", comment: "Food Manager" },
			{ value: "agent-2", comment: "Research Assistant" },
		],
		strategy: "replaceAll",
		expected: {
			modified: true,
			databases: [MOCK_DATA_SOURCE_ID],
			agents: ["agent-1", "agent-2"],
		},
	},
] as const satisfies ConfigPatchScenario[];

export const ORM_INDEX_SCENARIO = {
	databases: [{ name: "taskDb" }],
	agents: [{ name: "mealAgent" }],
} as const satisfies {
	databases: OrmEntityMetadata[];
	agents: OrmEntityMetadata[];
};
