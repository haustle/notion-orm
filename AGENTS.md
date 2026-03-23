# Typing Philosophy (Non-Negotiable)

- Derive types from canonical surrounding contracts whenever possible (Notion SDK types, existing config maps, and local type registries).
- Do not hardcode string unions for domain keys when a source-of-truth map/type already exists.
- For functions that would otherwise take more than one argument, prefer a single centralized typed parameter object (for example, an `Args` type/interface) over positional parameters.
- Prefer enforcement maps with `satisfies Record<...>` so adding a new property forces an explicit decision for every behavior surface.
- Never use `as` to bypass type mismatches in core logic. Fix the type relationship or add a narrow runtime guard.
- `null`/`undefined` are valid in strong typing when they are part of a discriminated union or schema contract.
- Avoid isolated `unknown` usage (e.g. `object: unknown`) when an existing local or upstream type can be bridged in.
- If `unknown` appears at an API boundary, narrow it immediately and convert to contract-linked types; do not propagate it through core logic.
- Be proactive about building bridges across the type system instead of introducing disconnected placeholder types.
- Registry patterns should be exhaustive and type-linked to source unions so new properties cause compile-time failures until handled.
- Avoid brittle string-based expectation maps for runtime validation; prefer exhaustive typed builder registries (`satisfies Record<...>`) plus local runtime guards near each transformer/builder.

# Object Key / Entry Iteration

- When iterating an object whose type is known (schema types, typed config maps, `satisfies Record<K, V>` registries), use `objectKeys` or `objectEntries` from `src/typeUtils.ts` instead of `Object.keys` / `Object.entries`. These return typed key arrays / discriminated entry tuples so downstream indexing and assignment stay type-safe without `as` casts.
- **Why not `Object.keys` / `Object.entries` for typed objects?** In TypeScript they are typed to return `string[]` and `[string, T][]`-style pairs. Any **strong key typing is erased**: you lose `keyof` specificity, so comparisons (`.includes`, `.every`), building sets/maps keyed by property names, and chained lookups no longer check against your schema keys. Use `objectKeys` / `objectEntries` whenever the value is a known record type and you care about key precision—not only for loops, but also for membership checks and assertions over keys.
- `Object.keys` / `Object.entries` are acceptable when the object is untyped at the call site (e.g. raw API responses, `unknown` after a runtime guard, diagnostic/display-only code) or when only `.length` is checked.
- Never cast the result of `Object.keys` with `as Array<keyof T>` inline. If you need typed keys, use `objectKeys` -- it centralizes the unsound cast in one place with documentation about the trade-off.
- When iterating `Partial<T>` with `objectEntries`, guard for `undefined` values before passing them to functions that do not accept `undefined`.
- Prefer `for...of objectKeys(x)` over `for...in x` when the object is schema-typed, since `for...in` always yields `string` and walks the prototype chain.

**Package consumers:** import the same helpers from `@haustle/notion-orm` (`objectKeys`, `objectEntries`, and type `ObjectEntry`).

# Zod Usage (Trust Boundaries)

- Use Zod whenever data enters from an untrusted boundary (CLI args, env vars, request payloads/headers, webhooks, websocket messages, forms, `localStorage`, filesystem JSON).
- For inputs you trust but do not control (third-party APIs or cross-team services), validate at the ingestion boundary to fail fast and localize debugging.
- For inputs you trust and control end-to-end, prefer static typing first; add runtime Zod validation only when drift risk or runtime safety needs justify it.
- Validate as close to the boundary as possible, then pass typed data deeper into the system.
- Prefer `safeParse` for user/input-facing flows where we should return actionable errors instead of throwing.
- Prefer `parse` for startup/build/internal scripts where fast failure is desirable.
- At public boundaries, map Zod errors into clear, stable error messages (avoid raw stack dumps).
- Keep schemas colocated with boundary code, and derive TypeScript types via `z.infer` from those schemas.
- Avoid duplicate "manual shape checks" once a Zod schema exists; the schema is the runtime source of truth.
