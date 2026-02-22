You are a senior engineer doing the initial setup for a brand-new application. Your job is to generate a production-ready project skeleton — creating the actual files on disk — without implementing business logic.

**Tier:** 2 — Multi-step procedure
**Phase:** Project inception (before any `/plan-feature` or `/scaffold` runs)

## Input

Parse $ARGUMENTS for:
- `--type=<template>` — required: `langgraph-app` | `browser-extension` | `python-scraper`
- `--name=<slug>` — required: kebab-case project name (e.g. `my-app`)
- `--description=<text>` — optional: one-line project purpose
- `--org=<github-org>` — optional: GitHub org for package names (default: `ojfbot`)
- `--dir=<path>` — optional: parent directory to create the project in (default: parent of current repo, i.e. `../`)

If `--type` is missing, output the three available templates and their use cases, then stop and ask the user to re-run with `--type=` specified.

If `--name` is missing, stop and ask for a kebab-case project name.

## Steps

### 1. Read the template spec

Read `domain-knowledge/app-templates.md` to get the canonical file list, exact dependency versions, configuration patterns, and conventions for the chosen template type.

### 2. State your plan

Before writing any files, output a brief summary:
- Target directory (absolute path)
- Template type and what it includes
- Top-level package/module list
- Any non-obvious choices you're making

If the target directory already exists and is non-empty, warn the user and stop — do not overwrite an existing project.

### 3. Create the project skeleton

Write all files to disk in the order listed in the template spec. Rules:

- Every TypeScript file must be strict-mode compatible (no implicit `any`, no missing null checks).
- Every Python file must be parseable by Python 3.11+ with no syntax errors.
- Use the exact dependency versions from `domain-knowledge/app-templates.md`.
- Mark values that need real configuration with `# TODO: set real value` (Python) or `// TODO: set real value` (TypeScript/JSON).
- Do not implement business logic — stubs, type definitions, and wiring only.
- Add `// SCAFFOLD: <reason>` comments on any non-obvious structural choice.

### 4. Create the CLAUDE.md

Write a `CLAUDE.md` appropriate to the scaffolded project. Include:
- Build, test, and lint commands specific to this template
- Architecture summary: package/module list and what each does
- Key conventions: auth pattern, logging, naming, test runner
- What still needs to be implemented (honest open items)

### 5. Initialize git

```bash
cd <project-dir>
git init -b main
git add .
git commit -m "chore: initial scaffold"
```

### 6. Output a next-steps checklist

End your response with this section:

```
## Next steps

### Before first run
- [ ] Copy .env.example → .env and fill in all TODO values
- [ ] <install command for this template type>
- [ ] Verify build/parse passes with zero changes

### First feature
- [ ] Run /plan-feature <feature-name> to write the spec
- [ ] Run /scaffold <feature-name> to generate stubs within this project
- [ ] Open GitHub issues for each acceptance criterion

### Before any commit
- [ ] Run /validate to check invariants
- [ ] Run /hardening for security and resilience gaps

### Before first deploy
- [ ] Run /setup-ci-cd to wire up GitHub Actions
- [ ] Run /push-all for the first release commit
```

Adapt the checklist to the template type — e.g. browser-extension should include "Load unpacked extension in chrome://extensions" as an early step.

## Constraints

- Do not implement business logic. Stubs, config, wiring only.
- Do not touch any files outside the new project directory.
- Do not run `pnpm install`, `npm install`, or `pip install` — leave that to the user.
- If the template spec in `domain-knowledge/app-templates.md` and the patterns in `domain-knowledge/shared-stack.md` conflict, prefer the template spec (it is more specific).

---

$ARGUMENTS
