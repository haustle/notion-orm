export const CODEGEN_GOLDEN_FILES = {
	registryItems: "registry-items.ts",
	configTemplate: "notion-config-template.ts",
	ormIndexDeclaration: "orm-index.d.ts",

	dbCustomerOrdersTs: "databases/CustomerOrders.ts",
	dbInventoryItemsTs: "databases/InventoryItems.ts",
	dbEdgeCasesTs: "databases/EdgeCases.ts",
} as const;

export const CODEGEN_EMIT_PATHS = {
	indexTs: "index.ts",
	indexDts: "index.d.ts",
	notionConfigTs: "notion.config.ts",
	notionConfigMjs: "notion.config.mjs",
	databasesDir: "databases",
	agentsDir: "agents",
	customerOrdersModuleTs: "CustomerOrders.ts",
	inventoryItemsModuleTs: "InventoryItems.ts",
	edgeCasesModuleTs: "EdgeCases.ts",
	taskDbModuleTs: "TaskDb.ts",
	mealAgentModuleTs: "MealAgent.ts",
} as const;

export const CODEGEN_TEST_PATHS = {
	goldenDir: "golden",
	notionOrmPackageJson: "node_modules/@haustle/notion-orm/package.json",
	notionOrmModuleIndexDts: "node_modules/@haustle/notion-orm/index.d.ts",
	notionOrmModuleIndexJs: "node_modules/@haustle/notion-orm/index.js",
	notionOrmBaseDts: "node_modules/@haustle/notion-orm/base.d.ts",
	notionOrmBaseJs: "node_modules/@haustle/notion-orm/base.js",
	zodModuleIndexDts: "node_modules/zod/index.d.ts",
	zodModuleIndexJs: "node_modules/zod/index.js",
	zodPackageJson: "node_modules/zod/package.json",
} as const;

export const CODEGEN_PARSE_VIRTUAL_FILENAMES = {
	ts: "golden.ts",
	js: "golden.js",
} as const;
