For sake of my setup I’m running all commands via 🍞 `bun`, but others work fine (ex. `npm`, `yarn`, `pnpm`)

## Installation

```bash
# 1. Install package (available via `npm` + `yarn`
bun add @haustle/notion-orm

# 2. Generate a boilerplate `notion.config`.(ts|js)
bun notion init
```

## Pre-requisites

1. Create a Notion integration key (don’t lose it) ([walkthrough](https://developers.notion.com/docs/create-a-notion-integration#create-your-integration-in-notion))
2. Connect integration to a data source and copy the data source ID ([walkthrough](https://developers.notion.com/docs/create-a-notion-integration#give-your-integration-page-permissions))

## Setting up config

In the root of the project run `bun notion init`. This will create a `notion.config.ts` (or JS) that looks similar to the following

```tsx
// notion.config.ts

// Be sure to create a .env.local file and add your NOTION_KEY
// If you don't have an API key, sign up for free
// [here](https://developers.notion.com)

const auth = process.env.NOTION_KEY || "your-notion-api-key-here";
const NotionConfig = {
  auth,
  databaseIds: [],
  // Add undashed database source IDs here (ex. "2a3c495da03c80bc99fe000bbf2be4bb")
  // or use the following command to automatically update
  // `notion add <database-source-id or URL>`
  //
  // If you decide to manually add database IDs, be sure to run
  // `notion generate` to properly update the local database types
};

export default NotionConfig;
```

### Creating `.env` file

1. Using the integration key we created in the first [step](https://www.notion.so/CLAUDE-md-2bac495da03c80bba6a6f044d1959b29?pvs=21), create a `.env` file in the root of the project
2. Add a `NOTION_KEY` variable, set to the integration key

```tsx
// .env (in root of project)
NOTION_KEY = ntn_123;
```

## Adding databases

### Easiest

⚠️ If you’re seeing issues in this step, it’s likely that you haven’t connected the integration to the related database in Notion client ([walkthrough](https://developers.notion.com/docs/create-a-notion-integration#give-your-integration-page-permissions))

```bash
bun notion add {data-source-id}
# bun notion add c85b7dc6-2208-430f-9274-654bfa6a6d0d
```

That’s it! During this step, we

1. Validate the database is visible to integration
2. Fetch database schema
3. Generate types and related const property values (learn what’s exposed [here](https://www.notion.so/CLAUDE-md-2bac495da03c80bba6a6f044d1959b29?pvs=21))
4. Update `notion.config.ts`'s `databaseIds`

### Manual

1. Removing, the dashes from the UUID, add it to `databaseIds` array in `notion.config.ts`
2. Run `bun notion generate`

## (Usage) Interacting with databases

Now that we’ve added our databases, lets learn how to actually interact with databases.

### Initialize package and connection

```tsx
// Initialize package
import NotionOrm from "@haustle/notion-orm";
const orm = new NotionOrm({ auth: process.env.NOTION_KEY });
```

### APIs

### Adding pages

```tsx
// Add new run
const run = await orm.runLogs.add({
  name: "Morning run",
  distance: 5.2,
  date: new Date(),
  location: "indoor",
  notes: "Felt pretty good.",
});
```

:ts: **Type safety**

Since we have a property and database meta data generated locally, we can surface a simpler API with complete type safety on expected property names and values.

- For example, when typing `location:` , intellisense will surface the only accepted/possible values (ex. `outdoor` or `indoor`)
- Additionally we have a `zod` validator that’s run before the network call is sent

### Querying pages

```tsx
// Fetch most recent run
const lastRun = await.runLogs.query({
  sort: [
    {
      timestamp: "created_time",
      direction: "descending",
    },
  ],
});

// Fetch indoor runs
const indoorRuns = await.runLogs.query({
  filter: {
    location: {
      equals: "indoor",
    },
  },
});
```

:ts: **Type safety**

We use a simplified API, that just requires listing the desired property values. Since we have a map of property names to types and values, we transform this

<aside>
🤖

With many code editors/IDEs now relying on TypeScript server, the package is quite easy for agents to get the hang of due to simple API and type guardrails

</aside>

## Database Schema

When we generate schemas for related databases we generate the content into the following directory `@haustle/notion-orm/build/{camelCaseName}`

```bash
build/
├── src/
│   └── index.js        # Main NotionORM class
└── db/
    ├── index.js        # Database registry (access all)
    ├── RunLogs.js      # Example `Run Logs` database
    └── BookRatings.js  # Example `Book Ratings` database
```

Inside this directory are a number of helpful exported items for consumers including:

- **Database schema type**
  ```tsx
  export type DatabaseSchemaType = {
    price?: number;
    prepNotes?: string;
    allergens?: ((typeof AllergensPropertyValues)[number] | (string & {}))[];
    recipeBuild?: string;
    category?: (typeof CategoryPropertyValues)[number] | (string & {});
    active?: (typeof ActivePropertyValues)[number] | (string & {});
    estimatedCost?: number;
    itemName: string;
  };
  ```
  This schema is particularly helpful because it’s expected type for the `properties` object when appending new pages to a database. The only required property is the title field
  For example
  ```tsx
  notion.recipes.add({
    properties: {
      itemName: "Honey Pear Tea",
      price: 15,
      type: "Tea",
      prepNotes: "Drink and be happy",
    },
  });
  ```
- **`zod` validation schema**
  ```tsx
  export const MenuRecipesSchema = z.object({
    price: z.number().nullable().optional(),
    prepNotes: z.string().nullable().optional(),
    allergens: z.array(z.enum(AllergensPropertyValues)).nullable().optional(),
    recipeBuild: z.string().nullable().optional(),
    category: z.enum(CategoryPropertyValues).nullable().optional(),
    active: z.enum(ActivePropertyValues).nullable().optional(),
    estimatedCost: z.number().nullable().optional(),
    itemName: z.string(),
  });
  ```
  We utilize this functionality to validate the schema when adding/querying the remote database. However, these are additionally useful for users wanting validation when building the `DatabaseSchemaType`
- **Arrays with possible properties like select and multi-select**
  ```tsx
  export const CategoryPropertyValues = [
    "Coffee",
    "Tea",
    "Non-Coffee",
    "Food",
    "Seasonal",
    "Other",
  ] as const;
  ```
  These should be referenced as the source of
  Additionally if you’d like to get the specific type you can always access the `DatabaseSchemaType` for the related property type (ex. `DatabaseTypeSchema["category"]`
- **Maps holding property name <> property type relationship**
  ```tsx
  const columnNameToColumnProperties = {
    price: {
      columnName: "Price",
      type: "number",
    },
    prepNotes: {
      columnName: "Prep Notes",
      type: "rich_text",
    },
    allergens: {
      columnName: "Allergens",
      type: "multi_select",
    },
    recipeBuild: {
      columnName: "Recipe / Build",
      type: "rich_text",
    },
    category: {
      columnName: "Category",
      type: "select",
    },
  } as const;
  ```

---

## Package development (meta)

When iterating and making changes to the underlying package (`@haustle/notion-orm`), its best to be consuming the package in a secondary app (to test the end to end flow)

To expose this package locally

1. `bun run build` (cut a build)
2. `bun link` (create global symlink pointed to local package)

```bash
✱ bun run build; bun link
$ rm -rf build && bunx tsc
bun link v1.3.3 (274e01c7)
Success! Registered "@haustle/notion-orm"

To use @haustle/notion-orm in a project, run:
  bun link @haustle/notion-orm

Or add it in dependencies in your package.json file:
  "@haustle/notion-orm": "link:@haustle/notion-orm"
```

Due to using a symlink the database data the test package is also being cleared. Meaning on every new build, we need to re-generate the database types by doing the following (will see type errors in locations where databases are being accessed)

1. `bun link @haustle/notion-orm`
2. `bun notion generate`
