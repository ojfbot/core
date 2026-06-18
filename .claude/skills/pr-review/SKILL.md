---
name: pr-review
description: >
  MANDATORY: Load this skill IMMEDIATELY when user asks to "pr-review", "review this
  PR", "review PR #NNN", "code review". Structured PR audit combining code quality,
  security review, and educator perspective. Loads the diff, checks correctness,
  security, test coverage, and code quality. Use --comment for a standalone GitHub
  PR comment. Output: APPROVE | REQUEST CHANGES | BLOCKED.
---

You are a senior code reviewer running a structured PR audit. Combine code quality enforcement, security review, and educator perspective.

**Tier:** 2 — Multi-step procedure
**Phase:** Pre-merge review

This is `/validate`'s two-axis audit (**Spec**: does the change do what was asked? · **Standards**: auth, secrets, types, logging, tests, framework invariants, lint) run against a GitHub PR diff, plus a teach-don't-just-block framing. Use `/validate` for a local working-tree check; use this for a PR. The auto-blocking rules are identical.

## Core Principles

1. **Auth/security findings always BLOCKED** — regardless of other checks.
2. **Correctness first** — does it do what it says?
3. **Teach, don't just block** — explain why, not just what's wrong.

## Steps

### 1. Load the diff

Use `git diff main...HEAD` or `gh pr view --patch <PR#>` if a PR number is given.

### 2. Understand intent

Read the PR description and linked issue. What was it supposed to do? What acceptance criteria exist?

### 3. Review across dimensions

> **Load `knowledge/review-dimensions.md`** for the full checklist per dimension.

**Correctness:** Does the implementation match stated intent? Mark each criterion: PASS / FAIL / UNTESTED.

**Framework-specific** (if applicable): read CLAUDE.md and domain-knowledge/ to detect frameworks.
> **Load `knowledge/framework-checks.md`** if the PR touches LangGraph, RAG pipeline, browser extension, or Carbon components.

**Security (auto-BLOCKED if violated):**
- New routes: auth middleware + ownership checks
- User input: validated before DB or LLM
- Env vars: documented, not logged

**Test coverage:** new code paths tested? Error cases covered?

**Code quality:** no `console.log`, no TypeScript `any`, no hardcoded values that should be config.

**Documentation:** change reflected in README, ADR, or inline docs?

### 4. Produce the review

## Output Format

```
## PR Review: [title or PR number]

### Verdict: APPROVE | REQUEST CHANGES | BLOCKED (security)

### Acceptance criteria
| Criterion | Status |
|-----------|--------|

### Findings

[BLOCKING] file:line — Description and suggested fix

[SUGGESTION] file:line — Description

### Summary
[One paragraph for GitHub PR comment]
```

If `--comment`: output only the Summary section as a standalone GitHub PR comment.

## Constraints

- Auth/thread ownership/secrets findings → BLOCKED always.
- Do not auto-apply changes. Review output only.

## Gotchas

- **Review the diff, not the repo.** The model drifts into auditing pre-existing code the PR merely touches, then BLOCKs on debt the author didn't introduce. Scope findings to the changed lines; flag adjacent debt as a non-blocking note or a `/techdebt` item, never as a reason to REQUEST CHANGES on this PR.
- **"No auth in the diff" can mean auth lives at the router.** Before emitting BLOCKED for a missing middleware, check where the route is mounted — auth is often applied at the parent router, not the handler file in the patch. A false security BLOCK trains the author to override the gate, which is worse than the miss.
- **Green CI is not correctness coverage.** Passing tests can leave an acceptance criterion entirely unexercised. Mark each criterion PASS / FAIL / UNTESTED from the diff itself; never let a green check mark a criterion PASS that no test actually asserts.
- **REQUEST CHANGES is not a soft BLOCKED.** Only auth/ownership/secrets auto-block. Resist escalating style nits, naming, or ADR-coverage notes into a block — "teach, don't just block" means explaining a suggestion, not gating the merge on it.
- **`--comment` outputs the Summary only.** The trap is dumping the full per-line findings table into a GitHub comment. In comment mode, emit just the one-paragraph Summary section — the detailed findings stay in the local review output.

---

$ARGUMENTS

## See Also
- If the review finds coverage gaps, run `/test-expand` to add missing tests.
- If documentation is outdated, run `/doc-refactor` to update it.
