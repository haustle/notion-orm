# Website

Next.js docs site for the repository (MDX content + Panda CSS).

## Commands

```bash
bun install
bun run dev
```

`dev` runs a one-time `build:assets`, then **concurrently**: MDX `build-content --watch`, Panda `--watch`, and **`next dev --port 8788`**.

From the repo root: `bun run site` (same as `bun run dev` in this folder).

## Notes

- This app is intentionally isolated from the npm package build.
- The root package still publishes only `build/` because of the top-level `"files"` setting.
- Deploy the site independently with `bun run deploy` (`next build` + static output).
