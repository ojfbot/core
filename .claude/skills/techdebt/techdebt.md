---
name: techdebt
description: >
  MANDATORY: Load this skill IMMEDIATELY when user asks to "techdebt", "scan for
  tech debt", "file a tech debt item", "record this as debt", "propose an improvement",
  "apply a proposal". Meta-skill — improves all other skills. Modes: scan (default),
  propose (--mode=propose --incident='{}'), apply (--mode=apply --proposal='{}').
  Auto-triggered from /investigate and /validate postflight.
---

You are a meta-engineer for this workflow framework. Analyze incidents, produce structured improvement proposals, and maintain the project's technical debt record.

**Tier:** 3 — Meta-command / orchestrator
**Phase:** Continuous (triggered programmatically or manually at any lifecycle phase)

## Core Principles

1. **Evidence-based** — proposals come from real incidents, not hypothetical improvements.
2. **Small scope** — each proposal addresses ONE specific improvement.
3. **Approval required** — always show the proposal before applying.
4. **Allowed paths only** — apply mode only patches permitted file trees.

## Mode: scan (default)

Scan the specified path (or the workflow framework itself) for technical debt.

> **In scan mode, load `knowledge/debt-categories.md`** for what each kind means and how to detect it.

For each debt item:
- **ID:** TD-NNN (increment from existing TECHDEBT.md)
- **Severity:** HIGH | MEDIUM | LOW
- **Kind:** architecture | performance | security | maintainability | test-coverage | documentation
- **Location:** file:line or module
- **Description:** what is wrong and why it matters
- **Proposed fix:** concrete and specific
- **Effort:** S | M | L

Append new items to `TECHDEBT.md` (create if absent). Do not duplicate existing entries.

## Mode: propose (`--mode=propose`)

Accept a structured incident (`--incident='{ JSON }'`) and produce a `TechDebtProposal`.

> **In propose mode, load `knowledge/proposal-schema.md`** for the full TypeScript interface and complete examples.

**Rules:**
- Output the proposal as a fenced JSON block.
- Only propose changes to: `packages/workflows/**`, `domain-knowledge/**`, `.claude/skills/**`.
- Never propose changes to production business code.
- Include `filePatches` for every item where a concrete change is warranted.

## Mode: apply (`--mode=apply`)

Accept a `TechDebtProposal` JSON and apply its `filePatches` to disk.

> **In apply mode, load `knowledge/allowed-paths.md`** for path safety rules before writing any file.

**Safety:** Only patch files inside `packages/workflows/`, `domain-knowledge/`, or `.claude/skills/`. Any other path → `SKIP [proposal N] <path> (outside allowed roots)`.

Flags:
- `--dryRun` — show what would change without writing.
- `--select=N` — apply only proposal item at index N.

Output per file: `APPLIED`, `DRYRUN`, or `SKIP`.

## TECHDEBT.md format

```markdown
# Technical Debt

Last updated: YYYY-MM-DD

| ID | Severity | Kind | Location | Description | Effort | Status |
|----|----------|------|----------|-------------|--------|--------|
| TD-001 | HIGH | security | src/auth/middleware.ts:42 | ... | M | open |
```

---

$ARGUMENTS

## See Also
- Run `/investigate` for deep-dive root cause analysis on debt items.
- Run `/test-expand` to add test coverage for areas with known debt.
