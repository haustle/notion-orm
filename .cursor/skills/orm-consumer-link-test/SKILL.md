---
name: orm-consumer-link-test
description: Validates local integration of @haustle/notion-orm changes across consuming applications. Use when the user updates the orm package and needs to build, link, regenerate types, and verify behavior in one or more consuming apps.
---

# ORM Consumer Link Test

## Purpose

Ensure changes made in the ORM repo are correctly consumed and validated in external apps that depend on `@haustle/notion-orm`.

## When to Use

Use this skill when:
- The user changed code in the ORM package.
- The user asks to test package changes in a separate consuming app.
- The user mentions `bun link`, local package linking, or regeneration via `bun notion sync`.

## Required Inputs

- `orm_repo_path` (default: `/Users/haustle/repos/orm`)
- `consumer_app_paths` (one or more absolute paths)

If `consumer_app_paths` are missing, ask for them before running commands.

## Workflow

Copy this checklist and track progress:

```text
ORM consumer validation progress
- [ ] Build and link package from ORM repo
- [ ] Link package in each consuming app
- [ ] Regenerate generated types in each consuming app
- [ ] Run validation/tests in each consuming app
- [ ] Report per-app results and failures
```

### 1) Build package in ORM repo

From `orm_repo_path`, run:

```bash
bun run build
```

This step must complete successfully before validating consuming apps.

### 2) Link package in each consuming app

For each path in `consumer_app_paths`, run:

```bash
bun link @haustle/notion-orm
```

### 3) Regenerate types in each consuming app

Still inside each consuming app, run:

```bash
bun notion sync
```

### 4) Validate behavior in each consuming app

Run the app's relevant tests or verification commands. Prefer project-defined scripts (for example `bun test`, `bun run test`, or a targeted smoke check) and report what was executed.

If no automated tests exist, perform a manual smoke validation and clearly label it as manual.

## Reporting Format

Return results as:

```markdown
## ORM Consumer Validation Results

- ORM build: PASS/FAIL
- Consumer app: <path>
  - Link step: PASS/FAIL
  - Generate step: PASS/FAIL
  - Validation step: PASS/FAIL
  - Notes: <key output/errors>
```

## Failure Handling

- If ORM build fails, stop and report errors before attempting consumer validation.
- If any consumer step fails, continue with remaining consumer apps when possible, then provide a combined failure summary.
- Include exact failing command and concid error details for each failure.
