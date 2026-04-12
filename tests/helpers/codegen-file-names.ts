export const CODEGEN_GOLDEN_FILES = {
	registryItems: "registry-items.ts",
	configTemplate: "notion-config-template.ts",
	ormIndexDeclaration: "orm-index.d.ts",

	dbCustomerOrdersTs: "databases/customerOrders.ts",
	dbCustomerOrdersJs: "databases/customerOrders.js",
	dbInventoryItemsTs: "databases/inventoryItems.ts",
	dbInventoryItemsJs: "databases/inventoryItems.js",
	dbEdgeCasesTs: "databases/edgeCases.ts",
	dbEdgeCasesJs: "databases/edgeCases.js",
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
	taskDbModuleJs: "taskDb.js",
	mealAgentModuleJs: "mealAgent.js",
	customerOrdersModuleTs: "customerOrders.ts",
	inventoryItemsModuleTs: "inventoryItems.ts",
	edgeCasesModuleTs: "edgeCases.ts",
	inventoryItemsModuleJs: "inventoryItems.js",
	customerOrdersModuleJs: "customerOrders.js",
	edgeCasesModuleJs: "edgeCases.js",
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
