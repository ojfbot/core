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

> **Load `knowledge/fleet-registration.md`** before emitting Step 7/8 output — the full 8-item registration checklist (daily-logger sweep/SYSTEM_PROMPT/KNOWN_REPOS, shell remote, security scan, CI clone, `@carbon/styles`, selfco vault entity) and the incident history behind it.

### 8. Output next-steps checklist

Include the fleet registration items from Step 7 that require changes in other repos (daily-logger, shell) as explicit checklist items, since the constraint below prevents this skill from writing those files directly.

## Constraints

- Do not implement business logic.
- Do not touch files outside the new project directory.
- Do not run package installs.
- If `domain-knowledge/app-templates.md` and `domain-knowledge/shared-stack.md` conflict: prefer app-templates.md.

## Gotchas

- **Step 7 is the whole point — skipping it is how `seh-study` shipped 15 invisible commits.** The skeleton on disk is the easy 80%; the fleet registrations (daily-logger sweep / SYSTEM_PROMPT / KNOWN_REPOS, shell remote, vault entity) are the part agents drop because they live in *other* repos. The skill can't write those files (constraint below), so they MUST surface as explicit checklist items in Step 8 — a registration you only "mention" never happens.
- **The vault entity is a registration, not a nicety.** Forgetting `~/selfco/wiki/entities/<slug>.md` (Step 7.8) is the knowledge-space twin of the daily-logger omission — `lofi-beaver`/`morning-cockpit`/`workstation-yuri` went weeks invisible to `/vault query`. Either author the three vault touches (entity + index line + log entry) or emit "run `/vault sync` after first commit" as a checklist item; don't silently skip it.
- **Don't invent dependency versions.** Step 2 exists because the canonical versions live in `app-templates.md`, not in your training data — a plausible-but-wrong version pins a lockfile to something that doesn't resolve or drifts the new repo off the fleet baseline. Read the spec; copy exact versions.
- **A non-empty target directory is a stop, not a merge.** Writing a skeleton on top of existing files silently clobbers or interleaves them. Step 3 says warn and stop — honor it rather than "scaffolding around" what's already there.
- **Use pnpm in every generated file — `npm` leaks in via muscle memory.** Generated CLAUDE.md commands, CI workflows, and READMEs must use `pnpm`; a stray `npm install` in a scaffolded script creates a phantom `package-lock.json` and breaks the workspace's hoisted resolution on first run.

---

$ARGUMENTS
