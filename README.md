# Notion ORM

⚠️ This package is Still in development 🏗️

A library to simplify adding and querying [Notion](https://notion.so/product) databases/tables. Giving typeahead/intellisense support on columns and expected column values on user specified databases. Built on top of [Notion API](https://developers.notion.com/)

Databases with the following column types are supported:

- Multi-select
- Select
- Status
- Date
- Text
- Url
- Checkbox
- Email
- Phone Number

## Installation

The only requirement is a Notion Developer API key ([here](https://developers.notion.com/)) and database IDs you want. Be sure to connect your [integration](https://developers.notion.com/docs/working-with-databases#adding-pages-to-a-database) (🚧 *Permissions* section) with your tables

```bash
npm install @haustle/notion-orm --save-dev
```

At the root of your project run the CLI to scaffold a config file (defaults to JavaScript unless a `tsconfig.json` is present):

```bash
npx notion init
# or
bun notion init
```

You can force a specific format with `--js` or `--ts`. You’ll need to pass your developer key and database IDs. How to get database IDs [here](https://developers.notion.com/docs/working-with-databases#adding-pages-to-a-database)

```tsx
// notion.config.ts (generated with `notion init --ts`)

// Be sure to create a .env.local file and add your NOTION_KEY

// If you don't have an API key, sign up for free
// [here](https://developers.notion.com)

const auth = process.env.NOTION_KEY || "your-notion-api-key-here";
const NotionConfig = {
  auth,
  databaseIds: [
    // Add undashed database source IDs here (ex. "2a3c495da03c80bc99fe000bbf2be4bb")
    // or use the following command to automatically update
    // `notion add <database-source-id or URL>`
    // If you decide to manually add database IDs, be sure to run
    // `notion generate` to properly update the local database types
  ],
};

export default NotionConfig;
```

Execute the following command from the root project directory.

```bash
npx notion generate
```

**Package Size**
Unpackaged size is 70.6KB and the installation size is 5.12MB (5.03MB from `@notionhq/client` dependency)

## Implementation

Databases can be imported via barrel file or from the individual database file. All database names will be camelCase 🐫.

```tsx
// Barrel Import (access to all databases)
import * as notion from "@haustle/notion-orm";
notion.databaseName.add();
notion.databaseName2.query();
```

```jsx
// Individual Database Import
import {
  databaseName,
  DatabaseSchemaType,
  QuerySchemaType,
} from "@haustle/notion-orm/build/db/databaseName";

databaseName.add();
```

- `DatabaseSchemaType`: Object type accepted in the database’s `add()` function
- `QuerySchemaType`: Object type accepted in the database’s `query()` function

The following examples for querying & adding are for server-side calls. If you’re looking to use this framework to execute client-side calls (ex. button click add/query X) visit the [Client (React)](https://www.notion.so/Notion-ORM-README-fdd30271bf944a3e85cb999ec8d5447d) section after reading

**Adding**

Only required column required is the title.

```jsx
notion.books.add({
  bookName: "Raphael, Painter in Rome: a Novel", // title
  author: "Stephanie Storey", // text
  status: "In progress", // status
  numberOfPages: 307, // number
  genre: ["Historical Fiction"], // multi-select
  rating: "⭐️⭐️⭐️⭐️", // select
  startDate: {
    // date
    start: "2023-01-01",
  },
  phone: "0000000000", // phone
  email: "tyrus@haustle.studio", // email
});
```

All column types in Notion databases are mapped to a typescript type.

| Column Type  | Object         |
| ------------ | -------------- |
| Title        | string         |
| Text         | string         |
| Select       | string         |
| Multi-select | Array (string) |
| Status       | string         |
| Number       | number         |
| Date         | Object         |
| Phone number | string         |
| Email        | string         |

**Querying**

For each column type you’ll be presented with the available querying filter. Find all filter conditions [here](https://developers.notion.com/reference/post-database-query-filter)

While the querying functionality works, it’s **not complete and there is room for user error**. For instance, the `filter` object should contain one child. Either the column name (signifies single filter), or `and` or `or` (signify compound filters). However there is no typecheck in place to stop adding multiple children

Unlike `add()` , there is no transformation after the inputted object. So the querying object you’re creating is exactly what you’d normally use to query the Notion API. Learn more about them [here](https://developers.notion.com/reference/post-database-query-filter)

Example of a single filter

```tsx
notion.books.query({
  filter: {
    genre: {
      contains: "Sci-Fi",
    },
  },
  sort: [
    {
      property: "name",
      direction: "ascending",
    },
    {
      property: "Author name",
      direction: "ascending",
    },
  ],
});
```

Example of compound filters, which is signified with `and` and `or`. You can nest these are far as you want (i.e `and` filters within `or` filter). Learn more [here](https://developers.notion.com/reference/post-database-query-filter#compound-filter-object)

```tsx
await notion.books.query({
  filter: {
    or: [
      {
        genre: {
          contains: "Sci-Fi",
        },
      },
      {
        genre: {
          contains: "Biography",
        },
      },
    ],
  },
});
```

Down below is what’s returned on a successful response. `results` being a simplified extracted version of the `rawResponse` (response from Notion API)

```tsx
{
	rawResponse: { /* Whatever Notion API returns */},
	results: [
		{
			bookName: "How to Change Your Mind",
			genre: ["Non-fiction"],
			numberPages: 460,
			rating: "⭐️⭐️⭐️⭐️"
		},
	]
}
```

## Client-side (React)

Notion API currently blocks calls from browser (per CORS)

You can get around this by creating API endpoints on stack of your choice. I’ve provided examples only for **Next.js**, but the high level implementation should work with any backend.

If you’re planning to only make server-side calls to your Notion database (from `GetStaticProps` or `GetServerSideProps`). These calls work totally fine, as these functions are executed server-side before page load. So you can ignore the proceeding steps

```tsx
export const getStaticProps: GetStaticProps = async () => {
	const response = await NotionClient.books.query({
		filter: {
			genre: {
				is_not_empty: true,
			},
		},
	});
	return {
		props: {
			apiResponse: response
		}
	}
```

To execute calls client-side (ex. on button click) an API endpoint is needed to get around CORS. In this example we’re passing the databases `DatabaseSchemaType` as the body of the API call.

```tsx
import { DatabaseSchemaType } from "@haustle/notion-orm/build/db/books";

async function addPageToNotionDatabase() {
  const example: DatabaseSchemaType = {
    bookName: "How to Change Your Mind",
    genre: ["Non-fiction"],
  };

  // make sure this route reflects your API path
  await fetch("/api/notion/books", {
    method: "POST",
    body: JSON.stringify(example),
  });
}
```

```jsx
<button onClick={ async() => await addPageToNotionDatabase()}>
```

Example API endpoint below, where we’re taking the body of type `DatabaseSchemaType` and passing it into the respected databases `add()` function to add a new page to the database. Learn more about _Next.js_ API’s and routing [here](https://nextjs.org/docs/api-routes/introduction).

```tsx
// pages/api/notion/yourDatabaseName.ts

import type { NextApiRequest, NextApiResponse } from "next";
import {
  DatabaseSchemaType,
  yourDatabaseName,
} from "@haustle/notion-orm/build/db/yourDatabaseName";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { method, body } = req;

  if (method === "POST") {
    const bodyJSON = JSON.parse(body) as DatabaseSchemaType;
    await yourDatabaseName.add(bodyJSON);
  }
}
```
