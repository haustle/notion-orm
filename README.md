# notion-orm

TypeScript ORM for Notion databases. Generates fully-typed clients from your Notion schemas.

## Installation

```bash
npm install @elumixor/notion-orm
```

## Setup

**1. Initialize config**

```bash
notion init
```

Creates `notion.config.ts` in your project root:

```ts
import type { NotionConfigType } from "@elumixor/notion-orm";

export default {
  auth: process.env.NOTION_API_KEY ?? "",
  databases: {
    tasks: "2ec26381fbfd80f78a11ceed660e9a07",
    people: "abcdef1234567890abcdef1234567890",
  },
} satisfies NotionConfigType;
```

**2. Generate types**

```bash
notion generate
```

Generates `generated/notion-orm/` with a typed client per database and an `index.ts` entry point.

**3. Use in your project**

```ts
import { NotionORM } from "../generated/notion-orm";

const notion = new NotionORM(process.env.NOTION_API_KEY);

// or with a config object
const notion = new NotionORM({ auth: process.env.NOTION_API_KEY });
```

## API

All methods are fully typed based on your Notion schema.

### Reading

```ts
// All records
const tasks = await notion.tasks.findMany();

// With filter, sort, and limit
const tasks = await notion.tasks.findMany({
  where: { status: { equals: "In Progress" } },
  orderBy: { name: "asc" },
  take: 10,
});

// First match or null
const task = await notion.tasks.findFirst({
  where: { name: { contains: "bug" } },
});

// By page ID
const task = await notion.tasks.findUnique({ where: { id: "page-id" } });

// Page-by-page (UI pagination)
const page1 = await notion.tasks.paginate({ take: 20 });
const page2 = await notion.tasks.paginate({ take: 20, after: page1.nextCursor });
// => { data, nextCursor, hasMore }

// Streaming all results in batches (AsyncIterable)
for await (const task of notion.tasks.findMany({ stream: 50 })) {
  console.log(task.name);
}

// Count
const total = await notion.tasks.count({ where: { status: { equals: "Done" } } });
```

### Select / omit

```ts
// Return only specific fields
const tasks = await notion.tasks.findMany({
  select: { name: true, status: true },
});

// Exclude specific fields
const tasks = await notion.tasks.findMany({
  omit: { internalNotes: true },
});
```

### Writing

```ts
// Create
const task = await notion.tasks.create({
  data: { name: "Fix bug", status: "Todo" },
});

// Create many
await notion.tasks.createMany({
  data: [{ name: "Task A" }, { name: "Task B" }],
});

// Update by ID
await notion.tasks.update({
  where: { id: "page-id" },
  data: { status: "Done" },
});

// Update all matching
await notion.tasks.updateMany({
  where: { status: { equals: "Todo" } },
  data: { status: "In Progress" },
});

// Upsert
await notion.tasks.upsert({
  where: { name: { equals: "Fix bug" } },
  create: { name: "Fix bug", status: "Todo" },
  update: { status: "In Progress" },
});

// Delete by ID
await notion.tasks.delete({ where: { id: "page-id" } });

// Delete all matching
await notion.tasks.deleteMany({
  where: { status: { equals: "Done" } },
});
```

## CLI

```
notion init                              Create notion.config.ts
notion generate                          Generate types for all configured databases
notion add <name> <database-id-or-url>   Add a database and generate its types
```

## Config options

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `auth` | `string` | — | Notion integration token |
| `databases` | `Record<string, string>` | — | Map of name → database ID |
| `outputDir` | `string` | `"generated/notion-orm"` | Output directory (relative to project root) |

## Environment

Set `NOTION_API_KEY` in your environment or `.env` file, or pass it directly via the `auth` field in `notion.config.ts`.
