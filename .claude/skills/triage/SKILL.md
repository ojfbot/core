---
name: triage
description: >
  MANDATORY: Load this skill IMMEDIATELY when user asks to "triage", "triage
  these issues", "label this backlog", "prioritize the issues", "apply triage
  labels", "route these issues", "what's ready for agents". Severity/effort/
  domain rubric + state-machine routing (ready-for-agent / ready-for-human /
  needs-info / wontfix) with agent briefs. Output: label set + routes + ordered
  backlog. Optional --apply writes labels and posts briefs via gh.
---

You are a backlog triage operator: apply a consistent rubric to inbound issues — severity, effort, domain, type — route each through the triage state machine, and produce an ordered backlog plus agent-ready briefs. Reproducible across sessions: same rubric, same ordering function, no judgment leakage. Triage is for work that *arrived* (reports, requests, external PRs); issues originated via `/orchestrate` or `/plan-feature` enter only to be routed out of `needs-triage`.

**Tier:** 2 — Multi-step procedure
**Phase:** Planning / Backlog management

## Steps

### 1. Load issues

```bash
gh issue list --json number,title,body,labels,createdAt,updatedAt --limit 100
```

> **Load `knowledge/operations.md`** when parsing invocation flags — all modes, including the `--prs` external-PR surface (a PR is an issue with attached code).

### 2. Context checks — redundancy and prior rejection

> **Load `knowledge/out-of-scope-kb.md`** before classifying — the already-implemented search (by domain concept, not the reporter's wording) and the `decisions/out-of-scope/` prior-rejection check. Both are cheap; both route `wontfix` when they hit.

### 3. Classify each issue per the rubric

> **Load `knowledge/triage-rubric.md`** for the operating principles, full rubric, and tie-break rules. Proposal-table format is in `knowledge/operations.md`.

### 4. Verify the claim

> **Load `knowledge/routing-rubric.md`** — reproduce the bug / check out the PR before routing. Three outcomes: confirmed (with code path), failed, insufficient detail (→ needs-info). Deliberately shallow; deeper chase is `/investigate`.

### 5. Route each issue

Exactly one route: `ready-for-agent` / `ready-for-human` / `needs-info` / `wontfix`. Routing clears the `needs-triage` entry state. Criteria, the wontfix three-way split, and the needs-info Triage Notes template are in `knowledge/routing-rubric.md`.

### 6. Write agent briefs

> **Load `knowledge/agent-brief.md`** for every `ready-for-agent` (and `ready-for-human`) item — durable behavioral briefs: types and contracts, no file paths or line numbers, acceptance criteria, mandatory out-of-scope. The brief is the contract; the report is context.

### 7. Order the backlog

Compute `severity_weight / effort_weight` (weights and tie-breaks in `knowledge/triage-rubric.md`). Output the ordered backlog with scores and routes visible.

### 8. Surface anomalies

Scan the five anomaly patterns in `knowledge/triage-rubric.md` — including conflicting or stacked states.

### 9. Apply (only with --apply)

Default mode outputs proposals and stops. With `--apply`: write labels via `gh issue edit` (skip already-matching), post briefs / Triage Notes / closing comments, remove `needs-triage` from routed issues, close `wontfix` per the three-way split. **Every posted comment opens with the AI-disclaimer line** (`knowledge/operations.md`). Label scheme + missing-labels rule also there.

## Output format

> **Load `knowledge/operations.md`** before writing the final output — the exact output block, including the briefs section.

## Constraints

- **One label per axis, one route per issue.** Conflicts are anomalies, not hedges.
- **Never route an unverified claim to `ready-for-agent`** — and never without a stated one-line `check:` command (rationale in `knowledge/routing-rubric.md`).
- **Reasons must cite specifics** (bar and examples in `knowledge/operations.md`).
- **No new labels invented during triage.** Rubric gaps are anomalies; rubric changes need an ADR.
- **--apply only after the user reviews proposals.** Never bulk-relabel or bulk-post without confirmation.
- **gh CLI required** (no-gh fallback in `knowledge/operations.md`).

## Gotchas

- **Author urgency masquerading as severity is the failure that quietly corrupts the whole order.** "I want this soon" and a thread full of +1s read as p0, but the rubric scores *user impact* — data loss, broken core flow, customer-blocking. Severity drives the ordering function, so one inflated p0 sinks every genuine p1 below it. Reason from the exposure, not the author's tone.
- **The ordering function is `severity_weight / effort_weight` and it is not yours to override.** The temptation is to hand-promote an issue that "feels important" above its computed score. Don't — reproducibility across sessions is the skill's contract. If the order looks wrong, the fix is re-scoring severity or effort with a cited reason, never resorting the list by gut.
- **Refusing to pick one label per axis is the default-mode failure.** "p1 or p2," "s or m" feels honest but produces an unsortable backlog. One of each, always; genuine undecidability is an *anomaly* to surface, not a hedge.
- **`--apply` now posts comments as well as labels — confirm the table first, every time.** Bulk `gh` writes are irreversible-ish and noisy (notifications, audit log). Never run apply before the user has approved the proposal table *and* the brief texts; skip issues whose labels already match.
- **An already-implemented `wontfix` must never enter `decisions/out-of-scope/`.** That KB records *rejected* concepts; filing a built feature there poisons the dedup check into re-closing legitimate requests. Point at where the feature lives instead — the redundancy check runs before the KB check for exactly this reason.
- **Missing labels are a repo-config problem, not a triage problem — never auto-create them.** Output the `gh label create` commands and stop. Inventing a 7th severity or a new domain mid-triage is almost always recategorization avoidance.

---

$ARGUMENTS
