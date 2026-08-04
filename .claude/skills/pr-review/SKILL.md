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

> **Load `knowledge/scope-vs-validate.md`** when unsure whether to run `/validate` or `/pr-review` — the shared two-axis audit contract and the boundary.

## Core Principles

1. **Auth/security findings always BLOCKED** — regardless of other checks.
2. **Correctness first** — does it do what it says?
3. **Teach, don't just block** — explain why, not just what's wrong.

## Steps

### 1. Pin the fixed point and load the diff

The fixed point is whatever the user names (a PR number, branch, tag, SHA); default `main`. Before anything else:

- Resolve it: `git rev-parse <fixed-point>` — an unknown ref **fails the review here**, with the error, not inside a sub-agent.
- Diff three-dot from the merge-base: `git diff <fixed-point>...HEAD` (or `gh pr diff <PR#>`), plus the commit list `git log <fixed-point>..HEAD --oneline`.
  > **Load `knowledge/diff-mechanics.md`** before reviewing a historical or already-merged range.
- An **empty diff fails fast** — report "nothing to review against <fixed-point>" and stop. A review of nothing must never emit a verdict.

### 2. Identify the spec source

> **Load `knowledge/spec-sources.md`** before hunting for the spec — the source order to search.

If there is none, the **Spec axis reports "no spec available"** — it does not improvise a spec from the diff.

### 3. Run the two axes as parallel sub-agents

Send a single message with two Agent calls — the axes stay in separate contexts so neither pollutes the other.

> **Load `knowledge/subagent-briefs.md`** before spawning the axes — the full Standards and Spec briefs, the smell-baseline paste-in-full contract, and the no-Agent-tool degraded mode.

### 4. Aggregate — verbatim, never reranked

## Output Format

> **Load `knowledge/aggregation-and-output.md`** before assembling the final report — the verbatim-aggregation rules and the exact output block (incl. `--comment` mode).

## Constraints

- Auth/thread ownership/secrets findings → BLOCKED always.
- Do not auto-apply changes. Review output only.

## Gotchas

- **Review the diff, not the repo.** The model drifts into auditing pre-existing code the PR merely touches, then BLOCKs on debt the author didn't introduce. Scope findings to the changed lines; flag adjacent debt as a non-blocking note or a `/techdebt` item, never as a reason to REQUEST CHANGES on this PR.
- **"No auth in the diff" can mean auth lives at the router.** Before emitting BLOCKED for a missing middleware, check where the route is mounted — auth is often applied at the parent router, not the handler file in the patch. A false security BLOCK trains the author to override the gate, which is worse than the miss.
- **Green CI is not correctness coverage.** Passing tests can leave an acceptance criterion entirely unexercised. Mark each criterion PASS / FAIL / UNTESTED from the diff itself; never let a green check mark a criterion PASS that no test actually asserts.
- **REQUEST CHANGES is not a soft BLOCKED.** Only auth/ownership/secrets auto-block. Resist escalating style nits, naming, or ADR-coverage notes into a block — "teach, don't just block" means explaining a suggestion, not gating the merge on it.
- **`--comment` outputs the Summary only.** The trap is dumping the full per-line findings table into a GitHub comment. In comment mode, emit just the one-paragraph Summary section — the detailed findings stay in the local review output.
- **A bad ref or empty diff is a fail-fast, not a degraded review.** Discovering mid-review that the fixed point didn't resolve — or reviewing an empty diff and emitting APPROVE — wastes two sub-agents and produces a verdict about nothing. `git rev-parse` the ref and require a non-empty diff before spawning anything.
- **Never merge the two axes into one ranked list.** The separation exists because a loud Standards pass masks a quiet Spec miss (and vice versa). Report them verbatim under their own headings; per-axis worst findings, no cross-axis winner.
- **Baseline smells never block and repo standards suppress them.** "Possible Feature Envy" is a labelled judgement call, not a violation — and if `coding-standards.md` endorses the pattern, the smell isn't reported at all. Escalating a smell into REQUEST CHANGES is the reranking trap in miniature.

---

$ARGUMENTS

## See Also
- `knowledge/smell-baseline.md` — the Fowler smell baseline (shared with `/validate`; paste in full into the Standards sub-agent prompt).

> **Load `knowledge/postflight-routing.md`** after delivering the verdict — where to route coverage, docs, and recurring-smell findings.
