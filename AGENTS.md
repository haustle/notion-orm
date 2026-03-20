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
