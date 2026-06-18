---
type: brief
actor: code-claude
date: 2026-06-18
title: OPAV-S1 pickup — verify skill-action capture closes the usage/litter signal gap, then advance C3
refs:
  - decisions/adr/draft-skill-action-instrumentation.md
  - .handoff/20260614-shipped-opav-s1-c0-c2-shadow-spine-landed-both-prs-merged.md
  - .handoff/20260613-1959-brief-pickup-opav-slice-1-skill-action-instrumentation-v.md
  - decisions/adr/0096-skill-architecture-taxonomy.md
status: open
hooks:
  - "DO NOT REBUILD: skill-action instrumentation C0–C2 (SHADOW) already merged to main 2026-06-14 (ADR-0095, PRs #157/#158). This pickup VERIFIES + advances to C3, it does not re-architect."
  - "SYNC FIRST: the session that raised this was on stale branch adr/suggestion-identity-and-denominator (pre-June-14). Start from a clean checkout of origin/main."
  - "DEFERRED-DATA (from the C0–C2 ship bead): C3 needs accumulated SHADOW telemetry + a gold set; C4 needs 30 gold + 30 days. Do NOT emit an action-rate number before then."
---

## Why you're here

A skill-architecture session (see ADR-0096 / `[[skill-architecture-improvement-plan]]` in the
selfco vault) tried to measure **which skills are actually used** — for correlations, patterns,
and **litter detection (a skill unused over time is a removal candidate)**. It found the usage
signal was nearly silent and concluded a "real fix" was needed. Then the `.handoff/` beads
revealed the fix **already shipped** (OPAV S1 skill-action-instrumentation, C0–C2 SHADOW, main,
2026-06-14). So this is a **verify-and-advance** job, not a build.

Your mandate (decided by the operator 2026-06-18): **verify the shipped instrumentation actually
closes the usage/litter-signal gap, then advance C3.**

## What's already on main (don't rebuild)

- `4c7d384` deliverable-tracking event spine + gate-event consumer (ADR-0094 deliverable-tracking-spine)
- `4db42aa` **skill-action instrumentation C0–C2 (SHADOW)** (ADR-0095 skill-action-instrumentation)
- New telemetry streams observed locally: `~/.claude/session-telemetry.jsonl`, `~/.claude/history.jsonl`
  (alongside the older `skill-telemetry.jsonl`, `suggestion-telemetry.jsonl`, `tool-telemetry.jsonl`).

## The evidence that motivated the concern (verify these still hold on main)

Run from a clean `origin/main` checkout. On the STALE branch, the picture was:
- `skill-telemetry.jsonl` (the "which skill ran" stream) **last written 2026-05-11** — frozen 5+ weeks.
  Its hook `log-skill.sh` is `PostToolUse(Skill)` wired **only in `core/.claude/settings.json`** (project
  scope), NOT in `~/.claude/settings.json` (user scope). So it only fires for Skill-tool calls inside
  instrumented repos.
- `suggestion-telemetry.jsonl` (1,568 lines) and `tool-telemetry.jsonl` (44,686 lines) were **fresh** —
  their hooks (`suggest-skill`, `log-tool-use`) are user-scope. We had both ends of the funnel
  (suggested → tools-fired) but the MIDDLE (skill actually ran) was dark.
- Joining `skill-telemetry` against the 58-skill catalog showed **51/58 "never invoked"** — almost all
  FALSE NEGATIVES (`vault`, `grill-with-docs`, `bead` are in heavy use). **Absence-of-signal currently
  means broken capture, not disuse.**

## Verification checklist (does the shipped C0–C2 close it?)

1. **Path-independence.** The capture must be **act-derived**, not Skill-tool-hook-dependent. Confirm it
   catches the three execution paths the old hook missed:
   - **follow-inline** — a skill executed by reading `.claude/skills/<name>/SKILL.md` and following it,
     with NO Skill-tool call (this is the ADR-0092 availability-aware-suggestion pattern; it's the
     dominant path and the old hook's blind spot). The signal is likely a `Read` of the SKILL.md /
     `knowledge/` files in `tool-telemetry`.
   - **Skill-tool invocation** (PostToolUse Skill).
   - **script execution** (`scripts/` of a skill).
2. **Use-vs-maintenance false positive (the quality crux).** A `Read` of a `SKILL.md` during a
   skill-AUTHORING/AUDIT session (e.g. this whole ADR-0096 session read + edited 58 SKILL.md files) is
   NOT a skill invocation. Confirm the reconciler distinguishes *using* a skill from *editing/auditing*
   it — else every skill-maintenance session inflates usage counts. Check how ADR-0095 handles this; if
   it doesn't, that's a real C3 finding.
3. **Scope.** Confirm capture is user-scope (fires across all repos + the chat/desktop surfaces +
   subagents), not project-scope like the dead `log-skill.sh`.
4. **Reconcile vs the old stream.** Decide whether `skill-telemetry.jsonl` is now superseded by the new
   spine/`session-telemetry` events, or should be back-filled / retired. `skill-metrics.mjs` and
   `suggest-skill` still read the old stream — make sure the consumers point at the live source.

## C3 — advance (only after capture is verified trustworthy)

- **Litter / absence surface.** Join the full 58-skill catalog ⨝ live usage telemetry → the **zero-use
  tail + last-seen recency**, as a `/skill-metrics` mode or a `/skill-audit` join. This is the
  operator's actual goal. **Do not ship this before capture is trusted — on bad capture it condemns 51
  live skills.** Log what's excluded (no silent caps).
- **Correlation/pattern mining** beyond `skill-metrics`'s hardcoded sequencing pairs.
- **Gold set** for the action-rate metric (per the deferred-data hook — needs accumulation; don't fake it).

## Boundaries

- Shadow-stage only (ADR-0086): observe + record, never gate. Litter REMOVAL stays a human/PR decision.
- Don't touch the ADR-0096 skill-architecture work (the other session owns it; it's mid-rebase).
- `/validate` before any PR; this is instrumentation that other loops will trust, so correctness of the
  reconciler's attribution logic is the thing to get right.
