---
name: triage
description: >
  MANDATORY: Load this skill IMMEDIATELY when user asks to "triage", "triage
  these issues", "label this backlog", "prioritize the issues", "apply triage
  labels". Severity/effort/domain rubric. Output: label set + ordered backlog.
  Optional --apply writes labels via gh.
---

You are a backlog triage operator. Your job is to apply a consistent rubric to issues — severity, effort, domain, type — and produce an ordered backlog the user can act on. Reproducible outputs across sessions: same rubric, same ordering function, no per-issue judgment leakage.

**Tier:** 2 — Multi-step procedure
**Phase:** Planning / Backlog management

## Core principles

1. **Every issue gets exactly one of each label.** No "p1 or p2," no "small or medium." Pick one. Indecision is the enemy of a useful backlog.
2. **Severity reflects user impact, not author urgency.** "I want this soon" is not p0. Data loss, broken core flow, customer-blocking — those are p0/p1.
3. **Effort is calibrated, not aspirational.** xs is "≤1 hour, no surprises." If you'd plan an afternoon for it, it's not xs.
4. **Order = severity × (1 / effort).** p0/xs first, p3/xl last. Never deviates without explicit user override.
5. **No new labels unless the rubric is missing one.** A 7th severity is almost always wrong; the right move is to recategorize.

## Steps

### 1. Load issues

```bash
gh issue list --json number,title,body,labels,createdAt,updatedAt --limit 100
```

If `--repo=<name>` is supplied, scope to that repo. If `--filter=<query>` is supplied, append it (e.g., `--filter=is:open label:bug`).

### 2. Classify each issue per the rubric

> **Load `knowledge/triage-rubric.md`** for the full rubric — severity definitions, effort calibration, domain taxonomy, type taxonomy, and tie-break rules.

For each issue, output the proposed labels in a table:

| # | Title | Severity | Effort | Domain | Type | Reason |
|---|-------|----------|--------|--------|------|--------|
| 12 | Auth bypass on /api/v2/threads | p0 | s | auth | bug | data-exposure risk; affects all users |
| 17 | Add markdown preview to chat | p3 | m | ui | feature | nice-to-have; no blocker |

The reason column is one short clause — what made you pick that severity. Reasons are auditable; "p1 because it's bad" is not.

### 2b. Route each issue — ready-for-agent vs ready-for-human

After classification, assign each issue exactly one **route** (Pocock triage state machine,
upstream June 2026; ojfbot S15 verifiability-sorted dispatch):

- **`ready-for-agent`** — ALL of: (a) the acceptance criterion is machine-checkable (a
  runnable test/command exists or can be stated as a one-line `check:`), (b) the claim is
  verified (bug reproduced / behavior confirmed — never route an unverified claim to an
  unattended agent), (c) scope is bounded to one session. State the `check:` command in the
  route reason — it becomes the roadmap slice's `check:` field, which the day-runner's shadow
  stage executes at the slice boundary.
- **`ready-for-human`** — real work whose acceptance is judgment-shaped (design, taste,
  ambiguous scope, cross-repo architecture) or whose claim can't be machine-verified. Not a
  demotion; it's honest routing — the compiler enforces the same split (`agent_eligible`
  without `check:` is demoted to `human_only`).
- **`needs-info`** — can't classify or verify without answers. Name the missing fact.

Add a `Route` column to the proposal table. Anything routed `ready-for-agent` without a
stated check command is a rubric violation — surface it as an anomaly instead.

### 3. Order the backlog

Compute the priority score: `severity_weight / effort_weight`.

```
severity_weight: p0=8, p1=4, p2=2, p3=1
effort_weight:   xs=1, s=2, m=4, l=8, xl=16
```

Sort descending. Ties broken by: (a) older first (FIFO for same priority), (b) bug type before feature type.

Output the ordered backlog as a numbered list with priority scores visible.

### 4. Surface anomalies

Before ending, scan for issues that don't fit the rubric cleanly:
- Issues with no clear domain (likely too vague — recommend the user clarify)
- Issues that smell like xl but are described as s (estimation mismatch — recommend split)
- Issues older than 90 days at p2/p3 (likely stale — recommend close or upgrade)
- Multiple p0s (rare in healthy backlogs — confirm with user that all are truly p0)

### 5. Apply labels (only with --apply)

In default mode, output the proposed labels and stop. The user reviews.

With `--apply`, run `gh issue edit <num> --add-label <severity>,<effort>,<domain>,<type>` for each issue. Skip issues where the existing labels already match. Report which issues were updated.

Required GitHub label setup (the skill warns if these labels don't exist):
- Severity: `severity/p0`, `severity/p1`, `severity/p2`, `severity/p3`
- Effort: `effort/xs`, `effort/s`, `effort/m`, `effort/l`, `effort/xl`
- Domain: `domain/auth`, `domain/agent-graph`, `domain/ui`, `domain/infra`, `domain/docs`, `domain/ops`
- Type: `type/bug`, `type/feature`, `type/refactor`, `type/architecture`, `type/docs`, `type/chore`

If labels are missing, output the `gh label create` commands needed, but do not run them automatically — label scheme is repo-level config.

## Modes

- **Default** — classify and order; output proposals, no writes.
- `--repo=<name>` — scope to a specific repo (default: current working repo).
- `--limit=<n>` — cap issues processed (default 100).
- `--filter=<query>` — append a `gh` filter (`is:open label:bug`, etc.).
- `--apply` — write labels via `gh issue edit`. Requires user confirmation of the proposal table first.
- `--reorder` — output the ordered backlog as a checklist suitable for pasting into a project board or weekly plan, omitting the rubric breakdown.

## Output format

```
## Issue triage — <repo> — <count> issues

## Rubric proposals
| # | Title | Severity | Effort | Domain | Type | Reason |
| ... |

## Ordered backlog
1. [score=8.0] #12 Auth bypass on /api/v2/threads (p0/s/auth/bug)
2. [score=4.0] #34 Loading state stuck on cv-builder export (p1/s/ui/bug)
3. [score=1.0] #17 Add markdown preview to chat (p3/m/ui/feature)
...

## Anomalies (require attention)
- #45 has no clear domain — body describes both UI and persistence
- #19 marked p1/s but body suggests xl scope — recommend split
- #8 is 187 days old at p3 — recommend close or upgrade

## Suggested next
- Apply labels: re-invoke with --apply
- Or: address top-3 by priority score; re-triage weekly
```

## Constraints

- **One label per axis per issue.** No multi-labels for severity.
- **One route per issue; `ready-for-agent` requires a stated machine check.** The route is what
  an orchestrator/day-runner consumes — severity ranking alone doesn't tell it what is safely
  delegable. (Full upstream refresh — out-of-scope KB, agent-brief emission — is the F7
  adopt-stack pass, tracked separately.)
- **Reasons must cite specifics.** "p0 because data loss" with a sentence pointing at the actual exposure. Not "p0 because critical."
- **No new labels invented during triage.** If the rubric is genuinely missing a category, surface it as an anomaly; don't quietly add a label.
- **--apply only after user reviews proposals.** Never bulk-relabel without confirmation.
- **gh CLI required.** If `gh` isn't installed/authenticated, output the proposals as a markdown table and tell the user how to apply manually.

## Composition

- Follows `/roadmap` (which prioritizes work directionally) — this skill applies that priority to actual issues.
- Follows `/orchestrate` — orchestration produces issues; triage labels them.
- Pairs with `/plan-feature` for high-priority items (turn a triaged issue into an actionable spec).
- Pairs with `/sweep` weekly maintenance (closing stale items).

## Gotchas

- **Author urgency masquerading as severity is the failure that quietly corrupts the whole order.** "I want this soon" and a thread full of +1s read as p0, but the rubric scores *user impact* — data loss, broken core flow, customer-blocking. Severity drives the ordering function, so one inflated p0 sinks every genuine p1 below it. Reason from the exposure, not the author's tone.
- **The ordering function is `severity_weight / effort_weight` and it is not yours to override.** The temptation is to hand-promote an issue that "feels important" above its computed score. Don't — reproducibility across sessions is the skill's contract. If the order looks wrong, the fix is re-scoring severity or effort with a cited reason, never resorting the list by gut.
- **Refusing to pick one label per axis is the default-mode failure.** "p1 or p2," "s or m" feels honest but produces an unsortable backlog. One of each, always; if you genuinely can't decide, that ambiguity is an *anomaly* to surface in Step 4, not a hedge to bake into the labels.
- **`--apply` edits live GitHub state and skips silently — confirm the table first, every time.** Bulk `gh issue edit` is irreversible-ish and noisy (notifications, audit log). Never run apply before the user has seen and approved the proposal table, and skip issues whose labels already match rather than re-writing identical labels.
- **Missing labels are a repo-config problem, not a triage problem — never auto-create them.** When `severity/*` or `effort/*` labels don't exist, output the `gh label create` commands and stop. The label scheme is repo-level governance; inventing a 7th severity or a new domain mid-triage (Core Principle 5) is almost always recategorization avoidance.

---

$ARGUMENTS

## See Also

- `knowledge/triage-rubric.md` — severity p0–p3, effort xs–xl, domain taxonomy, type taxonomy, tie-break rules
- `../roadmap/roadmap.md` — directional prioritization (this skill applies it to issues)
- `../plan-feature/plan-feature.md` — turn a triaged p0/p1 issue into a spec
- `../orchestrate/orchestrate.md` — decompose accepted plans into ordered work
- GitHub label commands: see § "Required GitHub label setup" above
