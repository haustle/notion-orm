# Notion ORM

A lightweight TypeScript [Notion API](https://developers.notion.com/) wrapper that aims to improve interactions with databases and custom agents, by leveraging static schema types

## Key Features
- Type inference when interacting with databases (e.g, `add` and `query`)
- Sync remote schema changes in single command
- Quickly start/resume chat streams with your agents
- Access exported property values, schemas, and types
- Logs console warnings when local vs remote schema drift is detected


## Installation
```bash
bun add @haustle/notion-orm
```

# Quick start

Initialize config from your project root (recommended):

```bash
bun notion init
```

Generated config shape:

```ts
// notion.config.ts

// If you don't have an API key, sign up for free
// [here](https://developers.notion.com)

const auth = process.env.NOTION_KEY || "your-notion-api-key-here";
const NotionConfig = {
  auth,
  databases: [
    // Use: notion add <database-id>
  ],
  agents: [
    // Auto-populated by: notion sync
  ],
};

export default NotionConfig;
```

### Adding databases

Add new database to track and generate static types (ex. how to find ID [here](https://developers.notion.com/guides/data-apis/working-with-databases#adding-pages-to-a-database) )

```bash
bun notion add <database-id>
```


### Adding agents (paid feature)

Agent support requires the [Notion Agents SDK](https://github.com/makenotion/notion-agents-sdk-js), which is **currently in alpha** and not published to npm. Because of this, a one-command setup handles the entire download-and-install flow for you:

```bash
bun notion setup-agents-sdk
```

**What this does:**
1. Clones the SDK repository into a local cache (`node_modules/.cache/.notion-agents-sdk`)
2. Installs the SDK's dependencies and builds it
3. Adds the built `@notionhq/agents-client` package to your project

After setup, run `notion sync` to generate agent types. Agents linked to your integration are automatically discovered.

**Updating:** When the upstream SDK receives changes, rerun the same command. It pulls the latest from the cached clone, rebuilds, and reinstalls:

```bash
bun notion setup-agents-sdk
bun notion sync
```

If you have not run the setup command, `notion sync` will skip agent generation and only produce database types. Once the SDK is published to npm, this step will no longer be necessary.

Learn more about [Custom Agents](https://www.notion.com/help/custom-agents) in the Notion documentation.

### Full sync command (`notion sync`)

Fetch/refresh database schemas. If the agents SDK is installed, also syncs custom agents.

```bash
bun notion sync
```

## Basic examples
### Add page to database

```ts
await notion.databases.books.add({
  icon: {
    type: "emoji",
    emoji: "📕",
  },
  // Expected <key,value> is constrained to `books` database schema
  properties: {
    bookName: "Creativity, Inc.",
    genre: ["Non-fiction"],
    publishDate: {
      start: "2026-03-01",
    },
  },
});

```

### Query/filter database

```ts
const response = await notion.databases.books.query({
  // Expected `properties` object is constrained to `books` database schema
  filter: {
    and: [
      { genre: { contains: "Non-fiction" } },
      { publishDate: { on_or_after: "2026-01-01" } },
      {
        or: [
          { bookName: { contains: "Creativity" } },
          { bookName: { contains: "Innovation" } },
        ],
      },
    ],
  },
});

```

### Chat with agent
```ts
const chat = await notion.agents.helpBot.chat({message: "Is the company closed today"})
await notion.agents.helpBot.pollThread(chat.threadId)
const messages = await notion.agents.helpBot.getMessages(chat.threadId, {
  role: "agent",
});
```


### Chat with agent (stream)

```ts
const thread = await notion.agents.helpBot.chatStream({
  message: "How can I update my shipping address?",
  onMessage: ({content, role}) => (msg.content),
});

```

# Implementation


### Client setup

Create a single ORM instance with your Notion integration key:

```ts
import NotionORM from "@haustle/notion-orm";

const notion = new NotionORM({
  auth: process.env.NOTION_KEY!,
});

const db = notion.databases.yourDatabaseName; // DatabaseClient
const agent = notion.agents.yourAgentName; // AgentClient
```

Generated database and agent names are camelCased and exposed on an instance of `NotionORM`.

- Use `notion.databases.<camelCaseDatabaseName>` for `add()` and `query()`.
- Use `notion.agents.<camelCaseAgentName>` for `chat()`, `chatStream()`, thread helpers, and history APIs.
- For full method signatures and response shapes, see [API Reference](#api-reference).

# Available database operations

## Adding

Only title is required by Notion for a minimal page.

```ts
await notion.databases.books.add({
  properties: {
    bookName: "Raphael, Painter in Rome: a Novel", // title
    author: "Stephanie Storey", // rich_text
    status: "In progress", // status
    numberOfPages: 307, // number
    genre: ["Historical Fiction"], // multi_select
    startDate: {
      start: "2023-01-01",
    }, // date
    phone: "0000000000", // phone_number
    email: "tyrus@haustle.studio", // email
  },
});
```

## Adding page content with markdown

Pass a `markdown` string alongside `properties` to create a page with body content in a single call. This uses Notion's [enhanced markdown format](https://developers.notion.com/guides/data-apis/working-with-markdown-content#block-type-support), which supports headings, lists, code blocks, quotes, checklists, and more.

```ts
await notion.databases.books.create({
  properties: {
    bookName: "Hello World",
  },
  markdown: "# Hello World\n\nThis is a page created with **markdown**.",
});
```

`markdown` is mutually exclusive with `children` / `content` — use one or the other. When `properties.title` is provided, the `# h1` heading is treated as body content; when omitted, Notion extracts it as the page title.

## Querying

Query filters are typed by your generated schema, including nested compound filters. Find Notion filter operators [here](https://developers.notion.com/reference/post-database-query-filter).

Example single filter:

```ts
await notion.databases.books.query({
  filter: {
    genre: {
      contains: "Sci-Fi",
    },
  },
  sort: [
    {
      property: "Book Name",
      direction: "ascending",
    },
  ],
});
```

Example compound filters:

```ts
await notion.databases.books.query({
  filter: {
    and: [
      {
        or: [
          { genre: { contains: "Sci-Fi" } },
          { genre: { contains: "Biography" } },
        ],
      },
      { numberOfPages: { greater_than: 250 } },
    ],
  },
});
```

You can request the full Notion payload by setting `includeRawResponse: true`:

```ts
const response = await notion.databases.books.query({
  filter: {
    genre: { contains: "Sci-Fi" },
  },
  includeRawResponse: true,
});

response.rawResponse; // strongly typed full Notion query response
```

Successful query shape:

```ts
{
  results: [
    {
      bookName: "The Dream Machine",
      genre: ["Non-fiction"],
      numberOfPages: 460,
    },
  ],
}
```

When `includeRawResponse: true` is provided, the response additionally includes:

```ts
{
  rawResponse: { /* full Notion API response */ },
}
```

### Agents

Agents are generated from those shared with your integration and exposed at `notion.agents.*`.

#### Basic chat (non-streaming)

- Useful when you want a straightforward request/response flow.
- Helpful when you plan to fetch message history after completion.

```ts
const chat = await notion.agents.yourAgentName.chat({
  message: "Give me a summary of this month",
});

await notion.agents.yourAgentName.pollThread(chat.threadId);

const messages = await notion.agents.yourAgentName.getMessages(chat.threadId, {
  role: "agent",
});
```

#### Continue an existing thread

- Useful when you want to preserve context across follow-up prompts.
- Helpful for chat UIs where users continue the same conversation.

```ts
const nextTurn = await notion.agents.yourAgentName.chat({
  threadId: chat.threadId,
  message: "Now turn that into a grocery list.",
});
```

#### Streaming patterns



How to start a new chat stream (pass `threadId` to resume):
```ts
import { AgentClient } from "@haustle/notion-orm";

const thread = await notion.agents.yourAgentName.chatStream({
  message: "Generate a prep list for that plan.",

  onMessage: (msg) => {
    if (msg.role === "agent") process.stdout.write(msg.content);
  },
});


const finalResponse = AgentClient.getAgentResponse(thread);
console.log("Thread ID:", thread.threadId);
console.log("Final:", finalResponse);
```





See [API Reference](#api-reference) for full method signatures, `ThreadInfo` shape, and message schemas.

# API Reference

## Runtime access (detailed)

| runtime property   | type                             | description                                                    | go deeper                                                            |
| ------------------ | -------------------------------- | -------------------------------------------------------------- | -------------------------------------------------------------------- |
| `notion.databases` | `Record<string, DatabaseClient>` | Generated database client map keyed by camelCase database name | [Adding](#adding), [Querying](#querying)                             |
| `notion.agents`    | `Record<string, AgentClient>`    | Generated agent client map keyed by camelCase agent name       | [Agents](#agents), [Agent methods](#agent-methods) |

## Database client methods

| member                       | kind     | description                                                   | go deeper                                                                              |
| ---------------------------- | -------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `id`                         | property | Notion data source ID used by this client instance            | -                                                                                      |
| `name`                       | property | Human-readable database name captured during generation       | -                                                                                      |
| `add({ properties, icon? })` | method   | Creates a page in the database using typed `properties`       | [Adding](#adding)                                                                      |
| `create({ properties, icon?, cover?, markdown? })` | method | Creates a page with optional [markdown body content](https://developers.notion.com/guides/data-apis/working-with-markdown-content#block-type-support) | [Adding](#adding), [Markdown](#adding-page-content-with-markdown) |
| `query({ filter?, sort?, includeRawResponse? })`  | method   | Queries database pages and returns `{ results }` by default (`rawResponse` is included when `includeRawResponse: true`) | [Querying](#querying), [Supported database properties](#supported-database-properties) |

## Agent methods

| member                                           | kind     | description                                           | go deeper                                                            |
| ------------------------------------------------ | -------- | ----------------------------------------------------- | -------------------------------------------------------------------- |
| `id`                                             | property | Notion agent ID used by this client instance          | -                                                                    |
| `name`                                           | property | Human-readable agent name                             | -                                                                    |
| `icon`                                           | property | Normalized agent icon metadata (or `null`)            | -                                                                    |
| `listThreads()`                                  | method   | Lists recent threads with `id`, `title`, and `status` | [Thread response shapes](#thread-response-shapes)                    |
| `getThreadInfo(threadId)`                        | method   | Fetches a single thread record                        | [Thread response shapes](#thread-response-shapes)                    |
| `getThreadTitle(threadId)`                       | method   | Convenience helper to fetch just the thread title     | [Thread response shapes](#thread-response-shapes)                    |
| `chat({ message, threadId? })`                   | method   | Sends a message and creates/resumes a thread          | [Agents](#agents), [Thread response shapes](#thread-response-shapes) |
| `chatStream({ message, threadId?, onMessage? })` | method   | Streams messages and returns final `ThreadInfo`       | [Agents](#agents), [Thread response shapes](#thread-response-shapes) |
| `getMessages(threadId, { role? })`               | method   | Gets full (or role-filtered) message history          | [Thread response shapes](#thread-response-shapes)                    |
| `pollThread(threadId, options?)`                 | method   | Polls until thread processing completes               | [Thread response shapes](#thread-response-shapes)                    |
| `AgentClient.getAgentResponse(threadInfo)`       | method   | Extract combined plain-text agent output from a streamed thread | [Thread response shapes](#thread-response-shapes)             |

## Generated exports

| import path                                    | what you get                                                                                                                                                                 | when to use                                                  |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `@haustle/notion-orm/build/db/<databaseName>`  | `<databaseName>(auth)` factory, `DatabaseSchemaType`, `QuerySchemaType`, generated Zod schema, generated option tuples (for select/status/multi-select), schema/type aliases | Script-level direct DB usage without the `NotionORM` wrapper |
| `@haustle/notion-orm/build/agents/<agentName>` | `<agentName>(auth)` factory that returns an `AgentClient`                                                                                                                    | Script-level direct agent usage                              |
| `@haustle/notion-orm/build/db`                 | `databases` barrel object (all database factories)                                                                                                                           | Dynamic database selection or custom registry wiring         |
| `@haustle/notion-orm/build/agents`             | `agents` barrel object (all agent factories)                                                                                                                                 | Dynamic agent selection or custom registry wiring            |

## Thread response shapes

`chatStream(...)` returns `ThreadInfo` with the following properties:

| ThreadInfo property | type                                                 | description                                              | example                                                                                            |
| ------------------- | ---------------------------------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `threadId`          | `string`                                             | Stable thread identifier used to continue a conversation | `"1f4e6f4a-5b58-4d91-a7fc-2f5f2a0f6bb1"`                                                           |
| `agentId`           | `string`                                             | Agent identifier that produced the response              | `"2c3c495da03c8078b95500927f02d213"`                                                               |
| `messages`          | `Array<{ role: "user" | "agent"; content: string }>` | Full message history currently available in the thread   | `[{ role: "user", content: "Plan meals" }, { role: "agent", content: "Here is a 3-day plan..." }]` |

`messages` item shape:

| message property | type               | description                |
| ---------------- | ------------------ | -------------------------- |
| `role`           | `user` | `agent` (`string`) | Message author             |
| `content`        | `string`           | Plain text message content |

## Supported database properties


| property_type      | expected returned shape                                              | example value                                 |
| ------------------ | -------------------------------------------------------------------- | --------------------------------------------- |
| `title`            | `string`                                                             | `"The Dream Machine"`                         |
| `rich_text`        | `string`                                                      | `"Long-form notes from the page"`             |
| `number`           | `number`                                                      | `460`                                         |
| `date`             | `{ start: string; end: string }`                             | `{ start: "2026-03-01", end: "2026-03-02" }`  |
| `status`           | `string`                                                      | `"In progress"`                               |
| `select`           | `string`                                                      | `"Non-fiction"`                               |
| `multi_select`     | `string[]`                                                    | `["Sci-Fi", "Biography"]`                     |
| `checkbox`         | `boolean`                                                            | `true`                                        |
| `email`            | `string`                                                      | `"tyrus@haustle.studio"`                      |
| `phone_number`     | `string`                                                      | `"0000000000"`                                |
| `url`              | `string`                                                      | `"https://developers.notion.com/"`            |
| `files`            | `Array<{ name: string; url: string }>`                               | `[{ name: "brief.pdf", url: "https://..." }]` |
| `people`           | `string[]`                                                           | `["1f4e6f4a-5b58-4d91-a7fc-2f5f2a0f6bb1"]`    |
| `relation`         | `string[]`                                                           | `["6f7f9cbf-8d45-48f8-a194-661e73f7f5d9"]`    |
| `created_by`       | `string`                                                      | `"Ada Lovelace"`                              |
| `last_edited_by`   | `string`                                                      | `"user_123"`                                  |
| `created_time`     | `string`                                                      | `"2026-03-01T10:30:00.000Z"`                  |
| `last_edited_time` | `string`                                                      | `"2026-03-01T13:15:00.000Z"`                  |
| `unique_id`        | `string`                                                      | `"TASK-42"`                                   |


## Unsupported properties

`rollup` and `formula` are intentionally unsupported.

- `formula`: Notion computes formula values at read time, and the actual output shape depends on the formula expression and its current result type. That makes it a poor fit for the generated static schema this client exposes. Because we cannot provide a stable contract for reads, writes, or filters, formula properties are skipped entirely during code generation.
- `rollup`: Rollup values are polymorphic and still need additional normalization before we can expose them as a predictable typed contract.

All supported properties can be used in typed filters. Formula properties are not surfaced in the generated client at all, so they are unavailable for selection, filtering, and normalized query results.

## Project Structure

```txt
.
├── src
│   ├── cli              # notion init / add / sync / setup-agents-sdk
│   ├── config           # config discovery, loading, and validation
│   ├── client           # runtime DatabaseClient + AgentClient
│   │   └── query        # typed filters + response simplification
│   ├── ast              # code generation internals
│   │   ├── database
│   │   ├── agents
│   │   └── shared
│   └── types            # local type bridges
├── plugins              # lint/tooling helpers
└── build                # generated output (after build/sync)
    ├── src
    ├── db
    └── agents
```

