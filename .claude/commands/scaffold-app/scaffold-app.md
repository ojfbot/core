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

### 7. Output next-steps checklist

## Constraints

- Do not implement business logic.
- Do not touch files outside the new project directory.
- Do not run package installs.
- If `domain-knowledge/app-templates.md` and `domain-knowledge/shared-stack.md` conflict: prefer app-templates.md.

---

$ARGUMENTS
