# ORM Architecture Map

This document explains how `@haustle/notion-orm` is structured today, how data flows through it, and which boundaries matter when refactoring.

## What the package is

`@haustle/notion-orm` is a hybrid package with two jobs:

1. Ship the reusable runtime and CLI:
  - `DatabaseClient`
  - `AgentClient`
  - shared schema/types/helpers
  - the `notion` CLI
2. Generate project-local code into a consumer's `./notion/` directory:
  - typed database modules
  - typed agent modules
  - a generated `NotionORM` class that wires those modules together

The key mental model is:

```txt
published package runtime + CLI
            +
consumer-local generated notion/
            =
typed Notion app experience
```

## Top-level package surfaces

### `@haustle/notion-orm`

The root package entry is the main consumer-facing surface for shared runtime values and types.

Important exports:

- `DatabaseClient`
- `AgentClient`
- `NotionORMBase`
- default export `NotionORM` (stub class with empty registries)
- branded Notion id helpers
- schema and query types
- `objectKeys` / `objectEntries`

`src/index.ts` also exports a stub `NotionORM` class with empty `databases` and `agents` maps. That class is not the fully wired app ORM. The real app-facing `NotionORM` is generated into a consumer's local `./notion/index.ts`.

### `@haustle/notion-orm/base`

This is the lower-level contract used by generated code. The generated `./notion/index.ts` extends `NotionORMBase` from here.

Use this entrypoint when working on the generated runtime contract itself.

### `notion` CLI

The CLI drives code generation and config bootstrapping:

- `notion init`
- `notion add`
- `notion sync`
- `notion setup-agents-sdk`

## Directory map

```txt
src/
  ast/                    codegen pipeline and emitters
  cli/                    command routing and CLI-only helpers
  client/
    agent/                AgentClient runtime
    database/             DatabaseClient runtime, query/create pipelines
  config/                 config discovery, validation, auth loading
  runtime-constants.ts    runtime strings/constants shared across layers
  typeUtils.ts            typed object key/entry helpers
  base.ts                 stable base surface for generated code
  index.ts                root package surface

tests/
  runtime/                DatabaseClient, query, response, config runtime tests
  codegen/                emitter and generation tests
  cli/                    command routing and helper tests
  types/                  compile-time API contract tests

website/
  package docs and playground site
```

## Layering model

The simplest accurate dependency story is:

```txt
config/types + config/findConfigFile + runtime-constants
                  |
                  v
        runtime clients and config loader
                  |
                  v
              CLI orchestration
                  |
                  v
          ast/ code generation pipeline
                  |
                  v
       consumer-local generated ./notion/
```

More concretely:

- `src/runtime-constants.ts` is the neutral home for runtime strings and version constants.
- `src/config/types.ts` and `src/config/findConfigFile.ts` are shared config primitives.
- `src/client/**` is the runtime package behavior.
- `src/cli/**` is process/terminal orchestration.
- `src/ast/**` is code generation.

Runtime code should not need to look like it depends on AST internals just to get shared strings.

## End-to-end database flow

### 1. Codegen builds database metadata

`notion sync` eventually calls `createDatabaseTypes()` in `src/ast/database/generate-databases-cli.ts`.

That flow:

1. Loads config from `src/config/loadConfig.ts`
2. Calls the Notion API for each configured data source
3. Converts Notion property metadata into generated TypeScript modules
4. Writes:
  - `notion/databases/<DatabaseName>.ts|js`
  - `notion/databases/index.ts|js`
  - `notion/databases/metadata.json`

### 2. Generated modules construct `DatabaseClient`

Each generated database module creates:

- a narrow `columns` object
- inferred schema/query/create types
- a factory that returns `new DatabaseClient(...)`

That `columns` object is the canonical bridge between generated static knowledge and runtime behavior.

### 3. `DatabaseClient` runs typed operations

`src/client/database/DatabaseClient.ts` is the main runtime coordinator.

Important flows:

- `create` / `update`:
  - map local schema values to Notion property payloads
  - call `pages.create` or `pages.update`
- `findMany` / `findFirst` / `findUnique`:
  - build Notion query params
  - fetch results from Notion
  - normalize page properties into simpler ORM row shapes
  - validate schema drift
  - apply `select` / `omit` projection
- `delete`:
  - soft delete via `in_trash: true`

## Query pipeline map

The query pipeline under `src/client/database/query/` has four main responsibilities:

1. `build-query-params.ts`
  - converts ORM query args into Notion API params
2. `filter/`
  - transforms typed filter input into Notion filter payloads
3. `normalize-page-result.ts` and `response/`
  - converts raw Notion property values into simpler row values
4. `projection.ts`
  - applies `select` / `omit`

Schema drift validation lives in `schema-drift-validation.ts`. It warns when generated local expectations and live Notion responses diverge.

## Create/update pipeline map

The create path under `src/client/database/create/` turns ORM input values into Notion property payloads.

Core modules:

- `map-to-notion-properties.ts`
- `property-value.ts`
- `build-create-page-parameters.ts`

This is the write-side mirror of the query/response pipeline.

## Agent flow

Agent support is parallel to database support:

- codegen lives in `src/ast/agents/`
- runtime client lives in `src/client/agent/AgentClient.ts`
- setup/install support lives in `src/agents-sdk-resolver.ts` and `src/cli/agents-sdk-setup.ts`

Agent codegen emits:

- `notion/agents/<AgentName>.ts|js`
- `notion/agents/index.ts|js`
- `notion/agents/metadata.json`

## Config flow

Config has three distinct concerns:

1. `src/config/findConfigFile.ts`
  - find `notion.config.*`
2. `src/config/loadConfig.ts`
  - load and validate config with Zod
  - cache the resolved config per process
3. `src/config/helpers.ts`
  - CLI-facing validation and `notion init`

This separation matters because discovery and shape validation are core boundaries, while CLI printing/exiting is not.

## Codegen flow

The full `notion sync` flow is:

1. validate config
2. remove existing generated `./notion/`
3. generate databases and agents in parallel
4. re-read metadata from disk
5. emit the root `notion/index.ts|js` and `index.d.ts`

The root generated index is emitted by `src/ast/shared/emit/orm-index-emitter.ts`.

That file builds the generated `NotionORM` class that:

- extends `NotionORMBase`
- resolves auth once
- assigns `this.databases`
- assigns `this.agents`

## Type system map

The strongest type source-of-truth is the generated `columns` metadata.

Important type hubs:

- `src/client/database/types/schema.ts`
- `src/client/database/types/query-filter.ts`
- `src/client/database/types/projection.ts`
- `src/client/database/types/crud.ts`

Project typing rules from `AGENTS.md` show up in a few key patterns:

- derive unions from canonical maps
- prefer `satisfies Record<...>`
- use `objectKeys` / `objectEntries` for typed iteration
- validate untrusted boundaries with Zod

## Test map

The tests already separate the package into useful seams:

- `tests/runtime/`
  - runtime database behavior
  - query normalization
  - config loading
- `tests/codegen/`
  - emitter behavior
  - generated output structure
- `tests/cli/`
  - command routing
  - helper behavior
- `tests/types/`
  - compile-time contract tests

This is useful when making structural changes: prefer refactors that preserve these seams instead of smearing concerns together.

## Structural cleanup done in this pass

This refactor intentionally stayed non-breaking and boundary-focused.

### 1. Runtime constants moved out of `src/ast/`

`src/runtime-constants.ts` now owns runtime-only constants. `src/ast/shared/constants.ts` keeps a compatibility alias for codegen callers, but runtime modules can import from a neutral path.

This makes the layering more honest:

- runtime code no longer looks like it depends on AST internals just for strings and version constants
- future splits between runtime and codegen are easier

### 2. Config discovery and config types were split out

Added:

- `src/config/types.ts`
- `src/config/findConfigFile.ts`

This breaks the old `config/helpers` <-> `config/loadConfig` cycle and makes shared config primitives easier to reason about.

### 3. CLI sync progress renderer was extracted

`SyncProgressRenderer` now lives in `src/cli/sync-progress-renderer.ts`, which makes `src/cli/index.ts` more obviously about command flow instead of terminal rendering internals.

### 4. Query response typing was tightened

`build-query-response.ts`, `normalize-page-result.ts`, and the resolver registry now constrain normalized row values with `DatabasePropertyValue` instead of `unknown`, which better matches the rest of the runtime type model.

The malformed-fixture test helpers still intentionally use `unknown` at a few edges when asserting bad payloads. That looseness is confined to test scaffolding for invalid cases, not the production query pipeline contract.

## Good next structural moves

These are the next high-value changes if you want to keep making the package more canonical without breaking the public surface.

1. Split `orm-index-emitter.ts` into smaller runtime/declaration pieces
2. Split config-file AST editing out of `src/cli/helpers.ts`
3. Add direct tests for `AgentClient` and agent codegen
4. Consider one small shared helper for repeated "normalize page results and validate first row" loops
5. Revisit the package export surface so `./base` is the only canonical low-level subpath

## Refactor heuristics for this repo

When simplifying this package, the best wins tend to be:

- move shared primitives to neutral modules
- split orchestration from pure transforms
- keep exhaustive typed registries
- derive types from generated `columns`
- avoid stringly duplicate sources of truth

The worst trade is "less code" that weakens the schema/type contract. In this repo, dumb and simple should still be strongly typed.