# Notion ORM

A lightweight TypeScript [Notion API](https://developers.notion.com/) wrapper that aims to improve interactions with databases and custom agents, by leveraging static schema types

## Key Features
- Type inference when interacting with databases (e.g, `add` and `query`)
- Sync remote schema changes in single command
- Quickly start/resume chat streams with your agents
- Exposed types for consumption (ex. values, and zod validators)


## Installation
```bash
bun add @haustle/notion-orm
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


# Quick start

Initialize config from your project root (recommended):

```bash
bun notion init
```

If needed, you can force config format:

```bash
bun notion init --ts
# or
bun notion init --js
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


### Adding agents

Agents linked to the integration are automatically populated during `notion sync` (No manual edits required)

### Full sync command (`notion sync`)

Fetch/refresh database schemas + custom agents.

```bash
bun notion sync
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

Successful query shape:

```ts
{
  rawResponse: { /* full Notion API response */ },
  results: [
    {
      bookName: "The Dream Machine",
      genre: ["Non-fiction"],
      numberOfPages: 460,
    },
  ],
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
| `query({ filter?, sort? })`  | method   | Queries database pages and returns `{ results, rawResponse }` | [Querying](#querying), [Supported database properties](#supported-database-properties) |

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
| `formula`          | `string | number | boolean | { start: string; end?: string }` | `42`                                          |
| `files`            | `Array<{ name: string; url: string }>`                               | `[{ name: "brief.pdf", url: "https://..." }]` |
| `people`           | `string[]`                                                           | `["1f4e6f4a-5b58-4d91-a7fc-2f5f2a0f6bb1"]`    |
| `relation`         | `string[]`                                                           | `["6f7f9cbf-8d45-48f8-a194-661e73f7f5d9"]`    |
| `created_by`       | `string`                                                      | `"Ada Lovelace"`                              |
| `last_edited_by`   | `string`                                                      | `"user_123"`                                  |
| `created_time`     | `string`                                                      | `"2026-03-01T10:30:00.000Z"`                  |
| `last_edited_time` | `string`                                                      | `"2026-03-01T13:15:00.000Z"`                  |
| `unique_id`        | `string`                                                      | `"TASK-42"`                                   |


`rollup` is not supported yet.

Filterable properties are a subset (for example, `formula`, `files`, and `relation` are currently non-filterable).

## Project Structure

```txt
.
├── src
│   ├── cli              # notion init / add / sync
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

