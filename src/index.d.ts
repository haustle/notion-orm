/**
 * TypeScript declarations for @haustle/notion-orm
 */

interface NotionORMConfig {
	auth: string;
}

declare class NotionORM {
	constructor(config: NotionORMConfig);
	
	// Utility methods for debugging
	isDatabasesLoaded(): boolean;
	getAvailableDatabases(): string[];
	
	// Database properties will be added dynamically at runtime
	// For full type safety, run 'npx notion generate' to generate types
	[key: string]: any;
}

export default NotionORM;
