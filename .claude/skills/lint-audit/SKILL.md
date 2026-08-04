---
name: lint-audit
description: >
  MANDATORY: Load this skill IMMEDIATELY when user asks to "lint audit", "lint check",
  "run linter", "quality scan", "check code quality", "lint report", "what lint issues
  do we have". Runs ESLint with @frame/eslint-plugin custom rules and the post-build
  artifact scanner, cross-references findings with TECHDEBT.md, and produces a structured
  quality report. Tier 2.
---

You are a code quality auditor. Your job is to run automated lint checks and produce a structured report that connects findings to architectural debt and actionable fixes.

**Tier:** 2 — Multi-step procedure
**Phase:** Quality gate / continuous

## Core Principles

1. **Automated first** — run real tools, don't guess at violations.
2. **Connect to context** — link findings to TECHDEBT.md items when applicable.
3. **Actionable output** — every finding gets a severity, location, and fix recommendation.
4. **No auto-fixes** — report findings only, let the developer decide.

## Workflow

### Step 1: Run ESLint

Run `pnpm lint` (or `pnpm exec eslint . --format json` for structured output) at the project root.

Parse the output to extract:
- Rule ID (e.g., `@frame/no-console-in-production`)
- File path and line number
- Severity (error vs. warning)
- Message

### Step 2: Run artifact scanner

If a `dist/` directory exists, run the post-build artifact scanner:
```bash
pnpm dlx tsx scripts/artifact-scanner.ts
```

If no `dist/` exists, note: "No build output to scan — run `pnpm build` first."

### Step 3: Cross-reference with TECHDEBT.md

Read `TECHDEBT.md` and check if any lint findings map to open debt items.

> **Load `knowledge/techdebt-mapping.md`** before cross-referencing — the documented rule → TD-XXX mappings (never invent a link outside them).

### Step 4: Generate report

## Output Format

> **Load `knowledge/report-format.md`** before generating the report — the full Lint Audit Report template, including the pinned @frame/eslint-plugin rules reference table.

## Constraints

- Always run the real linter — never fabricate findings.
- If ESLint isn't configured in the project, say so and suggest installation steps.
- Don't auto-fix — show findings and let the developer choose.
- If the project has no TECHDEBT.md, skip the cross-reference step.

## Gotchas

- **Never fabricate a finding from the rules table.** The biggest failure mode is reading the `@frame/eslint-plugin` rules reference and reporting violations you *expect* exist rather than running the linter. Every finding must come from actual `eslint --format json` output with a real file:line. If ESLint didn't run, you have no findings — say so.
- **A missing linter is not a clean repo.** If `@frame/eslint-plugin` (or any ESLint config) isn't installed, the correct output is "no lint configured, here's how to add it" — not an empty report that reads as "passed." A skipped scan and a clean scan look identical in a summary table unless you label it.
- **No `dist/` means the artifact scan is unrun, not green.** The post-build scanner catches source-map and key leaks that ESLint can't see. If there's no build output, the source-map/API-key leak surface is simply unchecked — state "run `pnpm build` first," don't imply the artifact layer is clean.
- **Warning vs error is the developer's blocking line — don't relabel it.** Inflating a `warn`-severity rule to "must fix" or burying an `error` as a suggestion misrepresents what CI will actually block on. Report ESLint's own severity verbatim; the cross-reference to TECHDEBT is context, not a severity override.
- **A TECHDEBT cross-reference is a real mapping, not a guess.** Only link a finding to TD-XXX when the rule genuinely corresponds to that item (per the documented mapping). Inventing plausible-looking debt links pollutes the tracker and erodes trust in the report.

---

$ARGUMENTS
