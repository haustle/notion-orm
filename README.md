# Notion ORM

An unofficial [Notion API](https://developers.notion.com/) TypeScript wrapper that leverages static types to deliver a better database (and custom agents) experience

## Key Features

- Full type inference when interacting with databases, including `findMany`, `create`, `update`, `delete`, and more
- Manage databases and agents in Notion
- Sync remote schema changes in a single command
- Quickly start/resume chat streams with your agents
- Access exported property values, schemas, and types from generated modules

## Setup

```bash
bun add @haustle/notion-orm
```

You can use npm, pnpm, or yarn to install the package. For CLI commands, `bunx notion …` and `npx notion …` work the same as `bun notion …` if you are not using Bun as your runtime.

Initialize config from your project root (recommended):

```bash
bun notion init
```

```ts
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

### Adding Custom Agents

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

- Fetch/refresh database schemas. If the agents SDK is installed, also syncs custom agents.

```bash
bun notion sync
```

### Where sync writes files (`notion/`)

`notion sync` writes generated modules under `notion/` at your project root—your synced database schemas, registries, and agent factories. A full sync replaces the entire `notion/` tree so removed databases or agents do not linger.

```txt
notion/
├── index.ts              # NotionORM entry + re-exports
├── index.js
├── index.d.ts
├── databases/
│   ├── index.ts          # `databases` registry barrel
│   ├── <Database>.ts     # one factory module per tracked database (PascalCase stem)
│   └── metadata.json     # sync cache (ids + display names)
└── agents/
    ├── index.ts          # `agents` registry barrel
    ├── <Agent>.ts        # one factory module per agent (PascalCase stem)
    └── metadata.json
```

For the full tree (including declaration maps), how **camelCase** registry keys map to **PascalCase** files, and project-relative import paths, see [Generated exports](#generated-exports) below.

### Initialization

Create a single ORM instance with your Notion integration key:

```ts
import { NotionORM } from "./notion";

const notion = new NotionORM({
  auth: process.env.NOTION_KEY!,
});

const db = notion.databases.yourDatabaseName; // DatabaseClient
const agent = notion.agents.yourAgentName; // AgentClient (after setup-agents-sdk)
```

Optional **REST host override** (for mocks or proxies): set **`NOTION_BASE_URL`** to the API **origin only**, e.g. `https://api.notion.com`. Do not add `/v1` — `@notionhq/client` appends that. When unset or blank, the package uses **`NOTION_DEFAULT_BASE_URL`** (`https://api.notion.com`, exported from the package root). The env key string is **`NOTION_BASE_URL_KEY`**. Applies to database / data-source **`@notionhq/client`** usage, including matching CLI steps—not to **`@notionhq/agents-client`** in this package.

Generated database and agent names are camelCased and exposed on an instance of `NotionORM`.

- Use `notion.databases.<camelCaseDatabaseName>` for database operations (`findMany`, `create`, `update`, `delete`, …).
- Use `notion.agents.<camelCaseAgentName>` for `chat()`, `chatStream()`, thread helpers, and history APIs (requires `notion setup-agents-sdk`).

## Databases

Every generated database exposes a Prisma-style API with full type inference from your schema. Here are a few highlights—see the [API Reference](#api-reference) for `findFirst`, `findUnique`, `count`, `createMany`, `updateMany`, `upsert`, `deleteMany`, and more.

### Create a page

```ts
await notion.databases.books.create({
  properties: {
    bookName: "Creativity, Inc.",
    author: "Ed Catmull",
    genre: ["Non-fiction"],
    numberOfPages: 368,
    publishDate: { start: "2014-04-08" },
  },
  icon: { type: "emoji", emoji: "📕" },
});
```

### Create a page with markdown content

Add body content to a page using Notion's [enhanced markdown format](https://developers.notion.com/guides/data-apis/working-with-markdown-content#block-type-support). Headings, lists, code blocks, quotes, and checklists are all supported.

```ts
await notion.databases.books.create({
  properties: {
    bookName: "Reading Notes",
  },
  markdown: "# Key Takeaways\n\n- Creativity requires candor\n- Protect the new\n\n> \"Quality is the best business plan.\"",
});
```

`markdown` is mutually exclusive with `children` / `content`—use one or the other. When `properties.title` is provided, the `# h1` heading is treated as body content; when omitted, Notion extracts it as the page title.

### Find many with filters

```ts
const books = await notion.databases.books.findMany({
  where: {
    and: [
      { genre: { contains: "Non-fiction" } },
      { publishDate: { on_or_after: "2024-01-01" } },
    ],
  },
  sortBy: [{ property: "bookName", direction: "ascending" }],
  select: ["bookName", "genre"],
});
```

### Update by ID

```ts
await notion.databases.books.update({
  where: { id: "page-id" },
  properties: { status: "Done", numberOfPages: 460 },
});
```

### Delete by filter

```ts
await notion.databases.books.deleteMany({
  where: { status: { equals: "Archived" } },
});
```

### Stream large result sets

`size` limits a single request. With `stream: n`, each Notion call returns up to n rows, cursors advance automatically, and `for await` walks the full result one row at a time without buffering everything or hand-rolling `nextCursor` (see [Cursor pagination](#cursor-pagination) and `[findMany](#database-client-methods)` in the API reference).

```ts
// Notion is queried in chunks of 50; the loop runs once per matching row, not just the first chunk
for await (const book of notion.databases.books.findMany({ stream: 50 })) {
  console.log(book.bookName);
}
```

### Cursor pagination

```ts
// First page (after: null); next pages use prev.nextCursor
const first = await notion.databases.books.findMany({ after: null, size: 10 });
const next = await notion.databases.books.findMany({
  after: first.nextCursor,
  size: 10,
});
// first.data, first.hasMore, next.data
```

## Agents

Agents require the Notion Agents SDK. Run `notion setup-agents-sdk` first, then `notion sync` to generate agent types.

Once set up, agents shared with your integration are exposed at `notion.agents.*`.

See [Agent methods](#agent-methods) and [Thread response shapes](#thread-response-shapes) for full method signatures, thread helpers, and message APIs.

#### Chat and read messages

```ts
const chat = await notion.agents.helpBot.chat({
  message: "Is the company closed today",
});
await notion.agents.helpBot.pollThread(chat.threadId);
const messages = await notion.agents.helpBot.getMessages(chat.threadId, {
  role: "agent",
});
```

#### Stream chat

```ts
const thread = await notion.agents.helpBot.chatStream({
  message: "How can I update my shipping address?",
  onMessage: (msg) => {
    if (msg.role === "agent") process.stdout.write(msg.content);
  },
});
```

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

# Additional database operations

The sections below expand on [Databases](#databases) with more examples. Query filters are typed by your generated schema, including nested compound filters. Find Notion filter operators [here](https://developers.notion.com/reference/post-database-query-filter).

## Adding

Only title is required by Notion for a minimal page.

```ts
await notion.databases.books.create({
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

## Querying

Example single filter:

```ts
await notion.databases.books.findMany({
  where: {
    genre: {
      contains: "Sci-Fi",
    },
  },
  sortBy: [
    {
      property: "bookName",
      direction: "ascending",
    },
  ],
});
```

Example compound filters:

```ts
await notion.databases.books.findMany({
  where: {
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

Projection is available via `select` and `omit` string arrays:

```ts
const response = await notion.databases.books.findMany({
  where: {
    genre: { contains: "Sci-Fi" },
  },
  select: ["bookName", "genre"],
});
```

Successful response shape:

```ts
[
  {
    bookName: "The Dream Machine",
    genre: ["Non-fiction"],
  },
]
```

# API Reference

## Runtime access (detailed)


| runtime property   | type                             | description                                                    | go deeper                                          |
| ------------------ | -------------------------------- | -------------------------------------------------------------- | -------------------------------------------------- |
| `notion.databases` | `Record<string, DatabaseClient>` | Generated database client map keyed by camelCase database name | [Adding](#adding), [Querying](#querying)           |
| `notion.agents`    | `Record<string, AgentClient>`    | Generated agent client map keyed by camelCase agent name       | [Agents](#agents), [Agent methods](#agent-methods) |


## Database client methods


| member                                                                  | kind     | description                                                                                                                                           | go deeper                                                                              |
| ----------------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `id`                                                                    | property | Notion data source ID used by this client instance                                                                                                    | -                                                                                      |
| `name`                                                                  | property | Human-readable database name captured during generation                                                                                               | -                                                                                      |
| `findMany({ where?, sortBy?, size?, select?, omit?, stream?, after? })` | method   | Queries database pages with typed filters, projection, pagination, or streaming                                                                       | [Querying](#querying), [Supported database properties](#supported-database-properties) |
| `findFirst({ where?, sortBy?, select?, omit? })`                        | method   | Returns the first matching row or `null`                                                                                                              | [Querying](#querying)                                                                  |
| `findUnique({ where: { id }, select?, omit? })`                         | method   | Fetches a row by page ID with optional projection                                                                                                     | [Querying](#querying)                                                                  |
| `create({ properties, icon?, cover?, markdown? })`                      | method   | Creates a page with optional [markdown body content](https://developers.notion.com/guides/data-apis/working-with-markdown-content#block-type-support) | [Adding](#adding), [Markdown](#adding-page-content-with-markdown)                      |


## Agent methods


| member                                           | kind     | description                                                     | go deeper                                                            |
| ------------------------------------------------ | -------- | --------------------------------------------------------------- | -------------------------------------------------------------------- |
| `id`                                             | property | Notion agent ID used by this client instance                    | -                                                                    |
| `name`                                           | property | Human-readable agent name                                       | -                                                                    |
| `icon`                                           | property | Normalized agent icon metadata (or `null`)                      | -                                                                    |
| `listThreads()`                                  | method   | Lists recent threads with `id`, `title`, and `status`           | [Thread response shapes](#thread-response-shapes)                    |
| `getThreadInfo(threadId)`                        | method   | Fetches a single thread record                                  | [Thread response shapes](#thread-response-shapes)                    |
| `getThreadTitle(threadId)`                       | method   | Convenience helper to fetch just the thread title               | [Thread response shapes](#thread-response-shapes)                    |
| `chat({ message, threadId? })`                   | method   | Sends a message and creates/resumes a thread                    | [Agents](#agents), [Thread response shapes](#thread-response-shapes) |
| `chatStream({ message, threadId?, onMessage? })` | method   | Streams messages and returns final `ThreadInfo`                 | [Agents](#agents), [Thread response shapes](#thread-response-shapes) |
| `getMessages(threadId, { role? })`               | method   | Gets full (or role-filtered) message history                    | [Thread response shapes](#thread-response-shapes)                    |
| `pollThread(threadId, options?)`                 | method   | Polls until thread processing completes                         | [Thread response shapes](#thread-response-shapes)                    |
| `AgentClient.getAgentResponse(threadInfo)`       | method   | Extract combined plain-text agent output from a streamed thread | [Thread response shapes](#thread-response-shapes)                    |


## Generated exports


| import path                            | what you get                                                                                                                                              | when to use                                                  |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `./notion/` (relative)                 | `NotionORM` class (generated entry; same as `./notion/index` but shorter)                                                                                 | Typical app code after `notion sync`                         |
| `./notion/databases/<DatabaseName>.js` | `<DatabaseName>(auth)` factory, `PageSchema`, `CreateSchema`, `QuerySchema`, `columns` metadata, option tuples (select/status/multi-select), type aliases | Script-level direct DB usage without the `NotionORM` wrapper |
| `./notion/agents/<AgentName>.js`       | `<AgentName>(auth)` factory that returns an `AgentClient` (PascalCase export; registry keys on `notion.agents` stay camelCase)                            | Script-level direct agent usage                              |
| `./notion/databases/index.js`          | `databases` barrel object (all database factories)                                                                                                        | Dynamic database selection or custom registry wiring         |
| `./notion/agents/index.js`             | `agents` barrel object (all agent factories)                                                                                                              | Dynamic agent selection or custom registry wiring            |


## Thread response shapes

`chatStream(...)` returns `ThreadInfo` with the following properties:


| ThreadInfo property | type                  | description                                              | example                                                |
| ------------------- | --------------------- | -------------------------------------------------------- | ------------------------------------------------------ |
| `threadId`          | `string`              | Stable thread identifier used to continue a conversation | `"1f4e6f4a-5b58-4d91-a7fc-2f5f2a0f6bb1"`               |
| `agentId`           | `string`              | Agent identifier that produced the response              | `"2c3c495da03c8078b95500927f02d213"`                   |
| `messages`          | `Array<{ role: "user" | "agent"; content: string }>`                             | Full message history currently available in the thread |


`messages` item shape:


| message property | type     | description                |
| ---------------- | -------- | -------------------------- |
| `role`           | `user`   | `agent` (`string`)         |
| `content`        | `string` | Plain text message content |


## Supported database properties


| property_type      | expected returned shape                | example value                                 |
| ------------------ | -------------------------------------- | --------------------------------------------- |
| `title`            | `string`                               | `"The Dream Machine"`                         |
| `rich_text`        | `string`                               | `"Long-form notes from the page"`             |
| `number`           | `number`                               | `460`                                         |
| `date`             | `{ start: string; end: string }`       | `{ start: "2026-03-01", end: "2026-03-02" }`  |
| `status`           | `string`                               | `"In progress"`                               |
| `select`           | `string`                               | `"Non-fiction"`                               |
| `multi_select`     | `string[]`                             | `["Sci-Fi", "Biography"]`                     |
| `checkbox`         | `boolean`                              | `true`                                        |
| `email`            | `string`                               | `"tyrus@haustle.studio"`                      |
| `phone_number`     | `string`                               | `"0000000000"`                                |
| `url`              | `string`                               | `"https://developers.notion.com/"`            |
| `files`            | `Array<{ name: string; url: string }>` | `[{ name: "brief.pdf", url: "https://..." }]` |
| `people`           | `string[]`                             | `["1f4e6f4a-5b58-4d91-a7fc-2f5f2a0f6bb1"]`    |
| `relation`         | `string[]`                             | `["6f7f9cbf-8d45-48f8-a194-661e73f7f5d9"]`    |
| `created_by`       | `string`                               | `"Ada Lovelace"`                              |
| `last_edited_by`   | `string`                               | `"user_123"`                                  |
| `created_time`     | `string`                               | `"2026-03-01T10:30:00.000Z"`                  |
| `last_edited_time` | `string`                               | `"2026-03-01T13:15:00.000Z"`                  |
| `unique_id`        | `string`                               | `"TASK-42"`                                   |


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
└── notion               # generated output (after notion sync)
    ├── index.*          # import as ./notion/ or ./notion
    ├── databases
    └── agents
```

