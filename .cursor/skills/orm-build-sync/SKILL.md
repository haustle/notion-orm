---
name: orm-build-sync
description: Builds @haustle/notion-orm from source, links it into testing-orm, and runs notion sync to refresh generated Notion artifacts. Use when the user wants to ship ORM changes into the local testing-orm sandbox, says build and sync, link and notion sync, or mentions orm-build-sync.
---

# ORM build + testing-orm sync

## When to use

- After changing emitters, CLI, or package exports in this repo and you want `testing-orm` to pick them up.
- When the user asks to build ORM and run `notion sync` in `testing-orm`.

## Paths

Assume these unless the user specifies otherwise:

| Role        | Path |
|-------------|------|
| ORM package | `/Users/tyrus/repos/orm` |
| Sandbox app | `/Users/tyrus/repos/testing-orm` |

## Workflow

Run in order; stop if a step fails.

### 1) Build and register the package

```bash
cd /Users/tyrus/repos/orm && bun run build && bun link
```

`bun run build` compiles the package into `build/`. Run `bun link` immediately after so `@haustle/notion-orm` is registered for local linking.

### 2) Link into testing-orm

```bash
cd /Users/tyrus/repos/testing-orm && bun link @haustle/notion-orm
```

### 3) Regenerate generated Notion files

```bash
cd /Users/tyrus/repos/testing-orm && bunx notion sync
```

Use `bunx notion sync` so the CLI resolves from the linked install. If `bun notion sync` works in that project, it is an acceptable alternative.

## One-shot chain

```bash
cd /Users/tyrus/repos/orm && bun run build && bun link && cd /Users/tyrus/repos/testing-orm && bun link @haustle/notion-orm && bunx notion sync
```

## Checklist

```text
- [ ] ORM: bun run build (PASS)
- [ ] ORM: bun link (PASS)
- [ ] testing-orm: bun link @haustle/notion-orm (PASS)
- [ ] testing-orm: bunx notion sync (PASS)
```

## Notes

- `testing-orm` needs a valid Notion config / env for sync to talk to the API; failures are often config or network, not the link step.
- For validating behavior beyond codegen, see the [orm-consumer-link-test](../orm-consumer-link-test/SKILL.md) skill.
