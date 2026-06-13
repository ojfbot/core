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

## The two axes

Every change is judged on exactly two axes. Keep them separate in your head and in the output:

- **Spec** — does the change faithfully do what was asked? Acceptance criteria met, intent honored, no scope creep, no missing cases. (Steps 1–2, 5.)
- **Standards** — does the change respect the rules the codebase lives by? Auth/ownership, no secrets, TypeScript safety, structured logging, tests, framework invariants, lint rules, ADR coverage. (Steps 3–5.5.)

A change can pass one axis and fail the other. Report both. `/validate` is the full bidirectional gate; `/pr-review` is this same audit run on a GitHub PR diff (+ educator framing); `/spec-review` is the **Spec** axis only, run pre-implementation against a plan rather than code.

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

### Step 4.5: Automated lint check

If the project has `@frame/eslint-plugin` installed (check for `eslint.config.js` at root):

1. Run `pnpm exec eslint --format json <changed-files>` on all files in the diff or working tree changes.
2. Cross-reference findings against the invariant checks above.
3. Any `error`-severity finding from `@frame/*` rules is **auto-blocking** (same as auth failures).
4. Any `warn`-severity finding is noted as PASS WITH NOTES.
5. If findings map to TECHDEBT.md items, note the connection (e.g., `@frame/no-untyped-schema-fields` → TD-002/TD-003).

If `@frame/eslint-plugin` is not installed, skip this step and note: "No automated lint — consider installing @frame/eslint-plugin."

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
Spec axis: [PASS | NOTES | FAIL]   ·   Standards axis: [PASS | NOTES | BLOCKED]

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

## Deliverable-tracking emission (scope-appropriate efforts only)

If this validation is a **gate in a gated-slice effort** (multi-slice/gate; see TD-006 scope gate),
emit the transition onto the tracking spine — **emit-not-magic**: a semantic gate pass has no Claude
Code tool event, so you emit it explicitly. The reconciler hook only audits; it never writes.

- **On starting validation:** `node scripts/gate-event.mjs <program> <slice> <gate> validating`
- **On verdict PASS:** `node scripts/gate-event.mjs <program> <slice> <gate> passed --evidence=<ref>`
- **On verdict BLOCKED/fail:** `node scripts/gate-event.mjs <program> <slice> <gate> failed`

The **honesty contract** is enforced at emit: a `passed` with no resolvable `--evidence` (the validation
report, test output, or PR — `path:…`/`pr:…`/`tpm:…`/`test:…`) is **rejected, nothing written**. The
canvas is a projection of the ledger; never hand-edit a gate-status block. Skip this entirely for
single-PR work (the scope gate). See `adr:deliverable-tracking-spine`.

## Constraints

- Auth/ownership/secrets failures always produce BLOCKED.
- Do not auto-fix. Output findings only.
- If findings reveal a systemic pattern, suggest `/techdebt --mode=scan` as a follow-up.

---

$ARGUMENTS

## See Also
- If coverage gaps are found, run `/test-expand` to add missing tests.
- If security concerns are flagged, run `/hardening` for a deeper review.
