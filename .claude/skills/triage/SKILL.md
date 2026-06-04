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
- **Reasons must cite specifics.** "p0 because data loss" with a sentence pointing at the actual exposure. Not "p0 because critical."
- **No new labels invented during triage.** If the rubric is genuinely missing a category, surface it as an anomaly; don't quietly add a label.
- **--apply only after user reviews proposals.** Never bulk-relabel without confirmation.
- **gh CLI required.** If `gh` isn't installed/authenticated, output the proposals as a markdown table and tell the user how to apply manually.

## Composition

- Follows `/roadmap` (which prioritizes work directionally) — this skill applies that priority to actual issues.
- Follows `/orchestrate` — orchestration produces issues; triage labels them.
- Pairs with `/plan-feature` for high-priority items (turn a triaged issue into an actionable spec).
- Pairs with `/sweep` weekly maintenance (closing stale items).

---

$ARGUMENTS

## See Also

- `knowledge/triage-rubric.md` — severity p0–p3, effort xs–xl, domain taxonomy, type taxonomy, tie-break rules
- `../roadmap/roadmap.md` — directional prioritization (this skill applies it to issues)
- `../plan-feature/plan-feature.md` — turn a triaged p0/p1 issue into a spec
- `../orchestrate/orchestrate.md` — decompose accepted plans into ordered work
- GitHub label commands: see § "Required GitHub label setup" above
