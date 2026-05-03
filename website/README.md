# Website

Next.js docs site for the repository (MDX content + Panda CSS).

## Commands

```bash
bun install
bun run dev
```

`dev` runs a one-time `build:assets`, then **concurrently**: MDX `build-mdx-content --watch`, Panda `--watch`, and **`next dev --webpack --port ${PORT:-3000}`**.

From the repo root: `bun run site` (same as `bun run dev` in this folder).

By default, the local site serves on `http://localhost:3000` (`PORT` is configurable).

If you need Turbopack explicitly, run `bun run dev:next:turbopack`.

### Agentation (annotations MCP)

#### Cursor: why Agentation was missing from MCP settings

Cursor’s **User MCP Servers** list comes from your **global** config: **`~/.cursor/mcp.json`**.

This repo’s **`.cursor/mcp.json`** is **gitignored**, so teammates don’t get MCP config from git—and **even locally**, Cursor often treats **user** (`~/.cursor/mcp.json`) vs **project** MCP differently in the UI. If **`agentation`** isn’t in the MCP config Cursor is actually using, it won’t show in the MCP list and **`/agentation`** won’t have MCP tools (the HTTP lane on **`:4747`** can still run).

**Fix:** Merge the **`agentation`** block from **[`website/cursor-agentation-mcp.fragment.json`](cursor-agentation-mcp.fragment.json)** into **`~/.cursor/mcp.json`** `mcpServers`, **or** paste the same JSON Cursor-side via **Add a Custom MCP Server**. Uses **`${workspaceFolder}`** so paths resolve when the **`orm`** folder is the workspace root.

Align **`http://localhost:4747`** with the dev HTTP lane below.

#### HTTP (`:4747`) while developing

**`bun run site`** / **`bun run dev`** runs **`node scripts/agentation-http-dev.mjs`** via **`concurrently`** so **`http://localhost:4747`** stays up for the toolbar (**Node**, not Bun—so **`better-sqlite3`** works).

Cursor MCP should use **stdio only** and attach to that HTTP API:

```json
{
  "mcpServers": {
    "agentation": {
      "command": "node",
      "args": [
        "${workspaceFolder}/website/node_modules/agentation-mcp/dist/cli.js",
        "server",
        "--mcp-only",
        "--http-url",
        "http://localhost:4747"
      ]
    }
  }
}
```

Standalone **`bun run agentation:mcp`** starts **both** HTTP + MCP stdio (upstream default). Avoid running it **alongside** **`agentation-http-dev`** (same port). Prefer **`--mcp-only`** in Cursor when using **`bun run site`**.

Official docs: [Agentation MCP](https://www.agentation.com/mcp).

Optional toolbar URL: **`NEXT_PUBLIC_AGENTATION_ENDPOINT`** (default `http://localhost:4747`; keep in sync with **`AGENTATION_HTTP_PORT`**).

The first MCP tool call right after Cursor boots may beat **`agentation-http-dev`**; retry once if tools fetch fails.

## Notes

- This app is intentionally isolated from the npm package build.
- The root package still publishes only `build/` because of the top-level `"files"` setting.
- Deploy the site independently with `bun run deploy` (`next build` + static output).
