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

> **Load `knowledge/core-principles.md`** before classifying anything — the five operating principles.

## Steps

### 1. Load issues

```bash
gh issue list --json number,title,body,labels,createdAt,updatedAt --limit 100
```

> **Load `knowledge/modes-and-flags.md`** when parsing invocation flags — flag handling and all modes.

### 2. Classify each issue per the rubric

> **Load `knowledge/triage-rubric.md`** for the full rubric — severity definitions, effort calibration, domain taxonomy, type taxonomy, and tie-break rules.

For each issue, output the proposed labels in a table:

> **Load `knowledge/proposal-table.md`** before writing the table — column format, worked examples, and the reason-column bar.

### 2b. Route each issue — ready-for-agent vs ready-for-human

> **Load `knowledge/routing-rubric.md`** before assigning routes — the `ready-for-agent` / `ready-for-human` / `needs-info` criteria and the Route-column rule.

### 3. Order the backlog

Compute the priority score: `severity_weight / effort_weight`.

> **Load `knowledge/ordering-weights.md`** before scoring — the weight values and tie-break order.

Output the ordered backlog as a numbered list with priority scores visible.

### 4. Surface anomalies

Before ending, scan for issues that don't fit the rubric cleanly:

> **Load `knowledge/anomaly-scan.md`** before this scan — the four anomaly patterns to check.

### 5. Apply labels (only with --apply)

In default mode, output the proposed labels and stop. The user reviews.

With `--apply`, run `gh issue edit <num> --add-label <severity>,<effort>,<domain>,<type>` for each issue. Skip issues where the existing labels already match. Report which issues were updated.

> **Load `knowledge/label-setup.md`** before applying — the required label scheme and the missing-labels rule.

## Modes

> **Load `knowledge/modes-and-flags.md`** when any flag is passed — all modes and their behavior.

## Output format

> **Load `knowledge/output-format.md`** before writing the final output — the exact output block format.

## Constraints

- **One label per axis per issue.** No multi-labels for severity.
- **One route per issue; `ready-for-agent` requires a stated machine check** (rationale in `knowledge/routing-rubric.md`).
- **Reasons must cite specifics** (bar and examples in `knowledge/proposal-table.md`).
- **No new labels invented during triage.** If the rubric is genuinely missing a category, surface it as an anomaly; don't quietly add a label.
- **--apply only after user reviews proposals.** Never bulk-relabel without confirmation.
- **gh CLI required** (no-gh fallback in `knowledge/label-setup.md`).

## Composition

> **Load `knowledge/composition.md`** when sequencing triage with other skills — upstream/downstream pairings and cross-references.

## Gotchas

- **Author urgency masquerading as severity is the failure that quietly corrupts the whole order.** "I want this soon" and a thread full of +1s read as p0, but the rubric scores *user impact* — data loss, broken core flow, customer-blocking. Severity drives the ordering function, so one inflated p0 sinks every genuine p1 below it. Reason from the exposure, not the author's tone.
- **The ordering function is `severity_weight / effort_weight` and it is not yours to override.** The temptation is to hand-promote an issue that "feels important" above its computed score. Don't — reproducibility across sessions is the skill's contract. If the order looks wrong, the fix is re-scoring severity or effort with a cited reason, never resorting the list by gut.
- **Refusing to pick one label per axis is the default-mode failure.** "p1 or p2," "s or m" feels honest but produces an unsortable backlog. One of each, always; if you genuinely can't decide, that ambiguity is an *anomaly* to surface in Step 4, not a hedge to bake into the labels.
- **`--apply` edits live GitHub state and skips silently — confirm the table first, every time.** Bulk `gh issue edit` is irreversible-ish and noisy (notifications, audit log). Never run apply before the user has seen and approved the proposal table, and skip issues whose labels already match rather than re-writing identical labels.
- **Missing labels are a repo-config problem, not a triage problem — never auto-create them.** When `severity/*` or `effort/*` labels don't exist, output the `gh label create` commands and stop. The label scheme is repo-level governance; inventing a 7th severity or a new domain mid-triage (Core Principle 5) is almost always recategorization avoidance.

---

$ARGUMENTS
