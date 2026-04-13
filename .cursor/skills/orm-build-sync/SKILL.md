---
name: orm-build-sync
description: Builds @haustle/notion-orm from source, links it into orm-testing, and runs notion sync to refresh generated Notion artifacts. Use when the user wants to ship ORM changes into the local orm-testing sandbox, says build and sync, link and notion sync, or mentions orm-build-sync.
---

# ORM build + orm-testing sync

## When to use

- After changing emitters, CLI, or package exports in this repo and you want `orm-testing` to pick them up.
- When the user asks to build ORM and run `notion sync` in `orm-testing`.

## Paths

Assume these unless the user specifies otherwise:

| Role        | Path |
|-------------|------|
| ORM package | `/Users/tyrus/repos/orm` |
| Sandbox app | `/Users/tyrus/repos/orm-testing` |

## Workflow

Run in order; stop if a step fails.

### 1) Build and register the package

```bash
cd /Users/tyrus/repos/orm && bun run build
```

`bun run build` runs `tsc` into `build/` and `bun link` so `@haustle/notion-orm` is registered for local linking.

### 2) Link into orm-testing

```bash
cd /Users/tyrus/repos/orm-testing && bun link @haustle/notion-orm
```

### 3) Regenerate generated Notion files

```bash
cd /Users/tyrus/repos/orm-testing && bunx notion sync
```

Use `bunx notion sync` so the CLI resolves from the linked install. If `bun notion sync` works in that project, it is an acceptable alternative.

## One-shot chain

```bash
cd /Users/tyrus/repos/orm && bun run build && cd /Users/tyrus/repos/orm-testing && bun link @haustle/notion-orm && bunx notion sync
```

## Checklist

```text
- [ ] ORM: bun run build (PASS)
- [ ] orm-testing: bun link @haustle/notion-orm (PASS)
- [ ] orm-testing: bunx notion sync (PASS)
```

## Notes

- `orm-testing` needs a valid Notion config / env for sync to talk to the API; failures are often config or network, not the link step.
- For validating behavior beyond codegen, see the [orm-consumer-link-test](../orm-consumer-link-test/SKILL.md) skill.
