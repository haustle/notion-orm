---
name: orm-consumer-pack-test
description: Builds @haustle/notion-orm as a published-style tarball and installs it into one or more consuming apps for realistic integration testing (no bun link). Produces structured reports on pack steps, test pass counts, and database add/query property coverage. Use when the user wants npm pack / .tgz consumption, realistic installs, or verification that related Notion properties behave correctly end-to-end.
---

# ORM Consumer Pack (Tarball) Test

## Purpose

Validate ORM changes the way consumers actually receive the package: **compiled output inside a `.tgz`**, installed via `bun add <path-to-tgz>`. This exercises `files`, `main`, `bin`, and install layout—unlike `bun link`, which symlinks source and can hide packaging mistakes.

## When to Use

Use this skill when:
- The user wants to test consumption without `bun link`.
- The user mentions **`npm pack`**, **tarball**, **`.tgz`**, or **realistic / published-style** local install.
- The user asks to verify `@haustle/notion-orm` in `orm-testing` or another app after building.

## Required Inputs

- `orm_repo_path` (default: `/Users/tyrus/repos/orm`)
- `consumer_app_paths` (one or more absolute paths; default single consumer: `/Users/tyrus/repos/orm-testing`)

If `consumer_app_paths` are missing, default to `orm_repo_path/../orm-testing` when that directory exists; otherwise ask for paths before running commands.

## Preflight Checklist (run before workflow)

```text
- [ ] Build ORM with the real release pipeline: `bun run build` (or `rm -rf build && tsc && node ./scripts/patch-build-import-extensions.mjs` + `chmod +x build/src/cli/index.js`). Do **not** use `bunx tsc` alone — the published CLI requires the import-extension patch or `notion sync` / `notion` will fail in consumers with missing `.js` modules.
- [ ] Confirm source uses package-safe internal imports (no bare internal aliases like `config/helpers` or `cli/helpers`)
- [ ] Confirm consumer has exactly one `@haustle/notion-orm` dependency entry in `package.json` (fix duplicate keys if a tool rewrote the file)
- [ ] If dependency history looks noisy/stale, delete consumer `bun.lock` and run `bun install`
- [ ] Confirm tarball ignores are in place (`*.tgz` in ORM `.gitignore`)
- [ ] Confirm scripts/env needed for integration smoke are present (`NOTION_KEY`)
- [ ] Treat generated output as disposable (do not hardwire source to repo-local generated files)
```

## Workflow

Copy this checklist and track progress:

```text
ORM pack consumer validation progress
- [ ] Build ORM with `bun run build` (includes import patch; required for CLI)
- [ ] Create tarball with npm pack
- [ ] Install tarball in each consuming app (bun add …tgz)
- [ ] (orm-testing) Optional but recommended: full refresh — see **“Full refresh: `orm-testing`”** below
- [ ] Regenerate generated types in each app if needed (`notion sync`)
- [ ] Run validation/tests in each consuming app
- [ ] Report using structured template (pack pipeline, per-command results, test counts, DB add/query/property coverage)
```

### 1) Build package in ORM repo

From `orm_repo_path`, run the package **release-style** build so the CLI works from the tarball:

```bash
bun run build
```

This runs `tsc` plus `patch-build-import-extensions.mjs` and marks the CLI executable. **Bare `tsc` is insufficient** for validating `notion` / `notion sync` in a consumer.

### 2) Create the tarball

Still in `orm_repo_path`:

```bash
npm pack
```

Note the emitted filename (e.g. `haustle-notion-orm-<version>.tgz`) at the repo root. Optionally read `version` from `package.json` if the path must be constructed without parsing CLI output.

### 3) Install tarball in each consuming app

For each directory in `consumer_app_paths`, install the tarball with a **filesystem path** to the `.tgz` (adjust relative path from the consumer to `orm_repo_path`):

```bash
bun add <path-to>/haustle-notion-orm-<version>.tgz
```

Example when `orm` and `orm-testing` are sibling repos:

```bash
bun add ../orm/haustle-notion-orm-0.0.44.tgz
```

**Bun caveat:** `bun add ../orm/haustle-notion-orm-<version>.tgz` sometimes hits a **DependencyLoop** error. If that happens, **copy** the `.tgz` into the consumer app directory and install locally:

```bash
cp "$orm_repo_path/haustle-notion-orm-<version>.tgz" /path/to/consumer/
cd /path/to/consumer && bun add ./haustle-notion-orm-<version>.tgz
```

After `bun add`, confirm `package.json` has a **single** `@haustle/notion-orm` dependency (no duplicate keys).

Re-running `bun add` after a new pack replaces the installed package with the new tarball.

### Full refresh: `orm-testing` (recommended)

Use this when you want to exercise **`notion init` → `notion add` → `notion sync`** end-to-end on the packed CLI, not only swap the dependency.

1. **Record IDs** from the existing `notion.config.ts` (or `.js`): copy `databases` and `agents` UUIDs you need to restore. For databases, `notion add` accepts dashed or undashed IDs; use the **data source** ID for the Coffee Shop–style DB in `orm-testing`.
2. **Remove config and generated types** (from consumer app root):

   ```bash
   rm -f notion.config.ts notion.config.js
   rm -rf notion
   ```

3. **Install the packed ORM** (see step 3) so `bunx notion` resolves to the tarball build.
4. **Init + add database(s):**

   ```bash
   bunx notion init --ts   # or --js; match the consumer project
   bunx notion add <data-source-id-or-url> --type database
   ```

   Repeat `notion add` for each database you recorded. There is no `notion add --type agent`; agent IDs are **refreshed by `notion sync`** once the Agents SDK is available.

5. **Agents SDK (if the app uses agents):**

   ```bash
   bunx notion setup-agents-sdk
   ```

   This may rewrite `package.json`. **Inspect and dedupe** dependency keys (e.g. keep a single `@notionhq/agents-client`, typically `file:../notion-agents-sdk` for sibling repos). Run `bun install` if the lockfile warned about duplicates.

6. **Full sync:**

   ```bash
   bunx notion sync
   ```

7. **Validate** (e.g. `bun run coffee-shop`, `bun test`).

Treat restored `notion.config.ts` and `notion/` as **regenerated**; do not assume byte-identical output vs. the pre-refresh files.

### 4) Regenerate generated types (when applicable)

If the consumer relies on CLI-generated `notion/` or `notion.config` outputs, run from each app:

```bash
bun notion sync
```

Skip this step if the validation is only about runtime package wiring and does not depend on refreshed codegen.

### 5) Validate behavior in each consuming app

Run project-defined scripts (e.g. `bun test`, `bun run coffee-shop`, `bun run demo`). Prefer what the repo documents; report exact commands executed.

When a script touches Notion databases, **infer or state explicitly**:

- **Add path:** which properties were written on `add()` (and icon/cover if used).
- **Read-back / round-trip:** which properties are asserted on the returned row after create (or after a follow-up query).
- **Query path:** which properties are exercised via `filter` (equals, contains, etc.) and whether each filter is validated against the same row created in the test.

If no automated tests exist, run an agreed smoke script or label validation as manual.

### Test inventory and quality (required in report)

For each consumer, summarize:

| Concept | What to report |
|--------|----------------|
| **Commands** | Exact `bun run …` / `bun test` lines run |
| **Outcome** | Per command: PASS / FAIL / SKIP (with reason) |
| **Automated test count** | e.g. `bun test`: N files, M tests; or “0 tests discovered” |
| **Smoke / integration** | Scripts that hit live Notion (label as integration/smoke) |
| **Property coverage** | Table: property (or column) → add asserted? → query/filter asserted? → notes |

**Quality bar:** Prefer reporting *how many* distinct behaviors were checked (e.g. “12 filter paths + 12 round-trip property asserts”) over a single “PASS” line. If the repo only prints “smoke passed”, still list which property types the script is known to cover (read the script or prior docs).

## Reporting Format

Always return a **structured** report. Use this template (fill every section; use `N/A` with reason if skipped):

```markdown
## ORM Pack Consumer Validation Results

### Pack pipeline
| Step | Result | Detail |
|------|--------|--------|
| `tsc` / compile | PASS/FAIL | |
| `npm pack` | PASS/FAIL | Tarball: `<filename>` |
| Tarball path used in consumer | OK/FAIL | e.g. `../orm/haustle-notion-orm-x.y.z.tgz` |

### Consumer: `<absolute path>`

#### Install & codegen
| Step | Result | Detail |
|------|--------|--------|
| `bun add …tgz` | PASS/FAIL | |
| `bun notion sync` | PASS/SKIP/FAIL | Why skipped if SKIP |

#### Tests / scripts executed
| Command | Result | Type (unit / integration / smoke) |
|---------|--------|-----------------------------------|
| … | PASS/FAIL/SKIP | … |

#### Test volume
- **Automated (`bun test` or equivalent):** `<N>` tests in `<M>` files, or “none found”
- **Integration/smoke commands:** list with PASS/FAIL

#### Database behavior (when applicable)
**Database(s) touched:** `<name or id>`

**Add / write:** list properties (or groups) written in the smoke test.

**Round-trip assertions:** properties verified on the created/read row (equality or semantic match).

**Query / filters:** each filter exercised → property → operator (e.g. equals, contains) → PASS/FAIL.

Example row (condense):

| Property | Written on add? | Asserted on row? | Filter tested? |
|----------|-----------------|------------------|----------------|
| shopName | yes | yes | title equals |
| hasWiFi | yes | yes | checkbox equals |
| … | … | … | … |

#### Summary
- **Passing checks (count):** e.g. “14 property round-trips + 14 filter queries”
- **Gaps / risks:** e.g. “no `files` or `relation` in this smoke”
- **Notes:** errors, env (`NOTION_KEY`), duplicate `package.json` keys, etc.

### Overall
- **Ready to merge / ship:** YES/NO (with caveats)
```

Short runs may collapse the property table to a bullet list, but **do not** omit: tarball name, commands run, pass/fail per command, and **either** a property table **or** an explicit “no DB smoke in this consumer”.

## Failure Handling

- If `bun run build` or `npm pack` fails, stop and report before touching consumers.
- If `bun add` fails with **DependencyLoop**, copy the `.tgz` into the consumer and `bun add ./haustle-notion-orm-<version>.tgz`.
- If `bun install` or `bun.lock` errors with **duplicate key** or **InvalidPackageKey**, open `package.json` and ensure each dependency name appears once; then delete `bun.lock` and run `bun install` again.
- If `notion` fails with `ERR_MODULE_NOT_FOUND` for extensionless paths under `build/src/`, rebuild ORM with `bun run build` and reinstall the new tarball.
- Include exact failing command and error details for each failure.

## Notes

- The tarball is an **untracked artifact** in the ORM repo root unless committed; add `*.tgz` to `.gitignore` if it should never be checked in.
- Removing **empty** directories after refactors does not create git commits; only **tracked file** deletions do.
