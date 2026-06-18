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

Read `TECHDEBT.md` and check if any lint findings map to open debt items:
- `@frame/no-untyped-schema-fields` → TD-002 (ExperienceSchema), TD-003 (SkillCategorySchema)
- `@frame/require-zod-validation-at-boundaries` → relates to TD-004 (input validation)
- `@frame/no-cross-package-relative-imports` → architectural boundary violations
- `@frame/require-test-for-new-exports` → test coverage gaps

### Step 4: Generate report

## Output Format

```markdown
## Lint Audit Report

**Project:** [repo name]
**Date:** [ISO timestamp]
**Rules:** @frame/eslint-plugin v2.0.0 (8 rules)

### Summary
| Severity | Count |
|----------|-------|
| Error    | N     |
| Warning  | N     |
| Clean    | N files |

### Findings by Rule

| Rule | Severity | Count | Files | TECHDEBT |
|------|----------|-------|-------|----------|
| @frame/no-console-in-production | warn | 3 | api/routes.ts, ... | — |
| @frame/no-untyped-schema-fields | warn | 2 | models/bio.ts | TD-002, TD-003 |

### Artifact Scanner
- Status: CLEAN | N violations
- [details if violations found]

### Recommendations
- [ACTION] N findings map to open TECHDEBT items — prioritize TD-XXX
- [FIX] N warnings can be auto-fixed with `pnpm lint:fix`
- [INFO] Overall quality score: X/10

### @frame/eslint-plugin Rules Reference
| Rule | What it catches | Why |
|------|-----------------|-----|
| no-source-maps-in-production | sourceMap:true in build configs | Claude Code source map leak prevention |
| no-api-keys-in-client | API keys in browser code | Security boundary enforcement |
| enforce-singleton-versions | Hardcoded MF shared versions | Module Federation runtime safety |
| no-cross-package-relative-imports | ../../packages/foo imports | Monorepo package boundary integrity |
| require-zod-validation-at-boundaries | req.body without Zod parse | API input validation |
| no-console-in-production | console.log in source files | Debug artifact cleanup |
| no-untyped-schema-fields | z.array(z.string()) on enrichable fields | Schema richness for agent analysis |
| require-test-for-new-exports | Exports without test files | Test coverage alongside implementation |
```

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
