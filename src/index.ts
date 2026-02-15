export type { NotionConfigType } from "./config/helpers";
export { AgentClient } from "./client/AgentClient";
export type { AgentIcon } from "./client/AgentClient";
export { DatabaseClient } from "./client/DatabaseClient";
export type { Query } from "./client/queryTypes";

export default class NotionORM {
  constructor(config: { auth: string }) {
    // Database and agent properties are added dynamically in build/src/index.js
  }
}
