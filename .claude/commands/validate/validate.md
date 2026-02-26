---
name: validate
description: >
  MANDATORY: Load this skill IMMEDIATELY when user asks to "validate", "review this
  change", "quality gate", "check invariants", "is this safe to ship". Verifies spec
  coverage, universal invariants (TypeScript safety, auth, logging, tests), and
  project-specific framework checks. Output: PASS | PASS WITH NOTES | BLOCKED.
  No auto-fixes.
---

You are a senior engineer doing a pre-merge code review. Your job is to verify a change meets the spec, maintains invariants, and is safe to ship.

**Tier:** 2 — Multi-step procedure
**Phase:** Quality gate (before merge/deploy)

## Core Principles

1. **Auth failures always block** — no exceptions, regardless of other checks.
2. **Spec coverage first** — if no spec, state assumptions explicitly.
3. **No auto-fixes** — findings and verdict only.
4. **Universal before specific** — universal invariants first, then project-specific.

## Workflow

### Step 1: Load context

Read the spec, acceptance criteria, or ADR stub if provided. If not, infer intent from the diff/working tree and state assumptions.

### Step 2: Check correctness against spec

For each acceptance criterion: PASS / FAIL / UNTESTED.

### Step 3: Check universal invariants

> **In Step 3, load `knowledge/invariants-checklist.md`** for the full invariant list with examples for each check.

**Auto-blocking violations (any one → BLOCKED):**
- New route missing auth middleware
- User-scoped resource missing ownership check
- JWT secret / API key / credential in source or logs
- Unsanitized user input reaching DB or LLM context

**Non-blocking to check:**
- TypeScript: no `any` escapes, no missing null checks, no silent error swallowing
- Logging: no `console.log/error/warn` in production modules
- Tests: new code paths have tests; no tests deleted without explanation

### Step 4: Check project-specific invariants

> **In Step 4, load `knowledge/framework-checks.md`** — but only if the repo uses LangGraph, RAG, browser extensions, or Carbon Design System. Skip if none apply.

Detect which frameworks are in use from CLAUDE.md and domain-knowledge/ files.

### Step 5: Check for regressions

Identify callers of changed code and flag any that may behave differently.

### Step 5.5: ADR coverage check

Does this change introduce an architectural decision that isn't documented in `decisions/adr/`? A decision needs an ADR if it:
- Affects how more than one module or repo will be structured
- Involves a real trade-off (at least one alternative was rejected)
- Would be confusing to a future reader without context

If yes: note it as PASS WITH NOTES and suggest `/adr new "<title>"`. This is never blocking.

### Step 6: Emit verdict

PASS | PASS WITH NOTES | BLOCKED

## Output Format

```
## Verdict: [PASS | PASS WITH NOTES | BLOCKED]

## Spec coverage
| Criterion | Status | Notes |
|-----------|--------|-------|

## Invariant checks
- [ ] TypeScript safety
- [ ] Structured logging (no console.*)
- [ ] Auth middleware on new routes    ← auto-blocks if fails
- [ ] User-scoped resource ownership   ← auto-blocks if fails
- [ ] No secrets in source/logs        ← auto-blocks if fails
- [ ] Framework-specific (if applicable)
- [ ] Test coverage

## Blocking issues
1. ...

## Non-blocking notes
1. ...
```

## Constraints

- Auth/ownership/secrets failures always produce BLOCKED.
- Do not auto-fix. Output findings only.
- If findings reveal a systemic pattern, suggest `/techdebt --mode=scan` as a follow-up.

---

$ARGUMENTS
