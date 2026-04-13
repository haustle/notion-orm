export const CODEGEN_GOLDEN_FILES = {
	registryItems: "registry-items.ts",
	configTemplate: "notion-config-template.ts",
	ormIndexDeclaration: "orm-index.d.ts",

	dbCustomerOrdersTs: "databases/CustomerOrders.ts",
	dbCustomerOrdersJs: "databases/CustomerOrders.js",
	dbInventoryItemsTs: "databases/InventoryItems.ts",
	dbInventoryItemsJs: "databases/InventoryItems.js",
	dbEdgeCasesTs: "databases/EdgeCases.ts",
	dbEdgeCasesJs: "databases/EdgeCases.js",
} as const;

export const CODEGEN_EMIT_PATHS = {
	indexTs: "index.ts",
	indexJs: "index.js",
	indexDts: "index.d.ts",
	notionConfigTs: "notion.config.ts",
	notionConfigMjs: "notion.config.mjs",
	databasesDir: "databases",
	agentsDir: "agents",
	baseModuleJs: "base.js",
	taskDbModuleJs: "TaskDb.js",
	mealAgentModuleJs: "MealAgent.js",
	customerOrdersModuleTs: "CustomerOrders.ts",
	inventoryItemsModuleTs: "InventoryItems.ts",
	edgeCasesModuleTs: "EdgeCases.ts",
	inventoryItemsModuleJs: "InventoryItems.js",
	customerOrdersModuleJs: "CustomerOrders.js",
	edgeCasesModuleJs: "EdgeCases.js",
} as const;

export const CODEGEN_TEST_PATHS = {
	goldenDir: "golden",
	notionOrmModuleIndexJs: "node_modules/@haustle/notion-orm/index.js",
	zodModuleIndexJs: "node_modules/zod/index.js",
} as const;

export const CODEGEN_PARSE_VIRTUAL_FILENAMES = {
	ts: "golden.ts",
	js: "golden.js",
} as const;
