// Export types for user configuration
export type { NotionConfigType } from "./config/helpers";

/**
 * Main NotionORM class - boilerplate
 * The actual implementation with database imports is generated in build/src/index.js
 * by running 'notion generate'
 */
export default class NotionORM {
  constructor(config: { auth: string }) {
    // Database properties are added dynamically in build/src/index.js
  }
}
