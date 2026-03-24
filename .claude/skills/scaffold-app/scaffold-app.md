---
name: scaffold-app
description: >
  MANDATORY: Load this skill IMMEDIATELY when user asks to "scaffold-app", "create
  a new app", "start a new project", "initialize a new repo". Scaffold a new
  application from a canonical template. Templates: langgraph-app | browser-extension
  | python-scraper. Creates all files on disk.
---

You are a senior engineer doing initial setup for a brand-new application. Generate a production-ready project skeleton — actual files on disk — without implementing business logic.

**Tier:** 2 — Multi-step procedure
**Phase:** Project inception (before any /plan-feature or /scaffold runs)

## Input

Parse `$ARGUMENTS` for:
- `--type=<template>` — required: `langgraph-app` | `browser-extension` | `python-scraper`
- `--name=<slug>` — required: kebab-case project name
- `--description=<text>` — optional: one-line purpose
- `--org=<github-org>` — optional (default: `ojfbot`)
- `--dir=<path>` — optional: parent directory (default: `../`)

If `--type` missing: output the three templates and their use cases, then stop.
If `--name` missing: stop and ask for a kebab-case name.

## Steps

### 1. Plan

> **Load `knowledge/template-guide.md`** for template selection guidance and common scaffolding pitfalls.

### 2. Read the template spec

Read `domain-knowledge/app-templates.md` to get the canonical file list, dependency versions, and configuration patterns for the chosen template.

### 3. State your plan

Before writing any files, output:
- Target directory (absolute path)
- Template type and what it includes
- Top-level package/module list
- Non-obvious choices

If target directory already exists and is non-empty: warn and stop.

### 4. Create the project skeleton

Write all files to disk per the template spec:
- TypeScript: strict-mode compatible
- Python: parseable by 3.11+
- Use exact dependency versions from `domain-knowledge/app-templates.md`
- Mark config values: `# TODO: set real value`
- No business logic — stubs and wiring only
- Add `// SCAFFOLD: <reason>` on non-obvious structural choices

### 5. Write CLAUDE.md

Accurate build/test/lint commands, architecture summary, key conventions, honest open items.

### 6. Initialize git

```bash
cd <project-dir>
git init -b main
git add .
git commit -m "chore: initial scaffold"
```

### 7. Register in fleet infrastructure

After the project skeleton is created, the new repo must be registered in fleet-wide systems. Output each registration as a concrete action with the exact file and line to edit:

1. **daily-logger sweep** — Add the repo name to the `REPOS` array in `daily-logger/src/collect-context.ts` with a comment describing the app's role. Without this, the daily article generator will not pick up any commits, PRs, or issues from the new repo.
2. **Shell production remote** (Frame OS sub-apps only) — Add `VITE_REMOTE_<NAME>=https://<slug>.jim.software` to `shell/.env.production` so the Module Federation host resolves the remote in production rather than falling back to localhost.
3. **Security scan workflow** — Copy the fleet-standard TruffleHog security scan workflow into `.github/workflows/security-scan.yml`. Use any existing fleet repo as the canonical source.
4. **`frame-ui-components` CI clone** (if the app consumes shared components) — Add the `git clone https://github.com/ojfbot/frame-ui-components` step before `pnpm install` in CI so the `file:../frame-ui-components` dep resolves.
5. **`@carbon/styles` peer dep** (if the app uses `frame-ui-components`) — Add `@carbon/styles` as an explicit dependency in the app's `package.json` (peer dep gap in `frame-ui-components` until patched upstream).

> **Why this step exists:** `seh-study` shipped 15 commits in one day and the daily-logger missed all of them because the repo was never added to the sweep. This checklist prevents that class of omission for every future app.

### 8. Output next-steps checklist

Include the fleet registration items from Step 7 that require changes in other repos (daily-logger, shell) as explicit checklist items, since the constraint below prevents this skill from writing those files directly.

## Constraints

- Do not implement business logic.
- Do not touch files outside the new project directory.
- Do not run package installs.
- If `domain-knowledge/app-templates.md` and `domain-knowledge/shared-stack.md` conflict: prefer app-templates.md.

---

$ARGUMENTS
