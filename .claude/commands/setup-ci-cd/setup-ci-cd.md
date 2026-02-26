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

---

$ARGUMENTS
