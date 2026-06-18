---
name: setup-ci-cd
description: >
  MANDATORY: Load this skill IMMEDIATELY when user asks to "setup-ci-cd", "add CI",
  "set up GitHub Actions", "add pre-commit hooks", "harden the pipeline". Auto-detects
  stack and generates: pre-commit hooks (lint/format/secrets), CI workflow
  (lint→typecheck→test→build), security workflow (SAST + audit), and coverage gates.
---

You are a DevOps engineer setting up a professional CI/CD pipeline. Produce a complete, working setup tailored to the detected stack.

**Tier:** 3 — Orchestrator / multi-step procedure
**Phase:** POC → MVP transition (run once when POC stabilizes)

## Core Principles

1. **Detect, don't assume** — read the actual stack from package.json/pyproject.toml/etc.
2. **Extend, don't overwrite** — respect existing conventions; note conflicts.
3. **Only generate what's missing** — don't duplicate working configs.

## Steps

### 1. Detect the stack

Read `package.json`, `pyproject.toml`, `Cargo.toml`, `go.mod`, or equivalent. Identify language, package manager, test framework, and monorepo structure.

### 2. Inventory what already exists

Check `.github/workflows/`, `Makefile`, `.husky/`, lint/format configs. List what is set up and what is missing.

### 3. Generate what is missing

> **Load `knowledge/ga-workflow-template.md`** for the OJF standard GitHub Actions CI and security workflow YAML templates.

> **Load `knowledge/pre-commit-config.md`** for the husky + lint-staged setup with gitleaks secret scanning.

Generate only missing pieces:
- **Pre-commit hooks:** lint + format on staged files, secret scanning, type-check on changed TS files
- **GitHub Actions CI:** lint → type-check → test → build (with pnpm cache, artifact upload)
- **GitHub Actions security:** `pnpm audit`, gitleaks, weekly schedule
- **Coverage gate:** fail CI if coverage below threshold

### 4. Output summary

What was created, what was skipped (already existed), manual steps needed (GitHub secrets to configure, CodeQL to enable).

## Constraints

- Do not overwrite existing working configs — extend or note conflicts.
- Respect existing conventions.
- Note any secrets/env vars that need GitHub → Settings → Secrets.

## Gotchas

- **Overwriting an existing `.github/workflows/` file is the destructive default to resist.** Generating a fresh `ci.yml` over one that already encodes deploy steps, required-status-check names, or branch-protection contracts silently breaks merges (the renamed check never reports). Step 2's inventory exists to prevent this — when a workflow exists, extend or diff it, never clobber it.
- **`npx husky init` and the knowledge templates contradict the repo's pnpm rule.** `knowledge/pre-commit-config.md` shows `npx`/`npm` invocations, but every ojfbot repo is pnpm-managed — emitting `npx husky` or `npm`-based hooks creates phantom lockfiles and bypasses the workspace. Translate every generated command to `pnpm` / `pnpm dlx` before writing it.
- **A coverage gate with no baseline either blocks every PR or protects nothing.** Setting the threshold above current coverage red-lines CI on day one; setting it at zero is theater. Read the project's actual coverage first and gate slightly below it, or the gate gets disabled within a week.
- **The grep-based secret hook in the template is a tripwire, not a scanner.** The `git diff | grep -qiE '(sk-ant-|ANTHROPIC_API_KEY|...)'` snippet catches three literal patterns and nothing else — presenting it as "secret scanning" overstates it. Pair it with gitleaks (the real scanner) and say plainly what the grep does and doesn't cover.
- **CI green locally does not mean CI green on GitHub.** Generated workflows reference secrets (`ANTHROPIC_API_KEY`, CodeQL enablement) that don't exist until configured in repo settings. The output's "manual steps" section is load-bearing — a workflow that needs a secret nobody set will fail its first real run, not at generation time.

---

$ARGUMENTS

## See Also
- Run `/hardening` to review the CI pipeline for security gaps.
- Run `/validate` to verify the CI configuration works end-to-end.
