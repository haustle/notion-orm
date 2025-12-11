export type { NotionConfigType } from "./config/helpers";
export { AgentClient } from "./client/AgentClient";

export default class NotionORM {
  constructor(config: { auth: string }) {
    // Database and agent properties are added dynamically in build/src/index.js
  }
}
