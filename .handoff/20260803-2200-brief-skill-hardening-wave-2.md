---
id: 20260803-2200-brief-skill-hardening-wave-2
type: brief
title: "skill-hardening Wave 2: description hardening, eval-gated — entrance MET (Wave 1 merged), dispatchable"
actor: code-claude
to: code-claude
session_id: 2026-08-03T22:00:00Z
refs:
  - github:ojfbot/core#400
  - github:ojfbot/core#404
  - 20260803-2130-report-skill-hardening-wave-1-shipped
  - file:decisions/skill-hardening-roadmap.md
  - file:docs/skill-audit/2026-08-03-extended-audit.md
  - file:scripts/suggester-eval.mjs
  - file:decisions/adopt-stack/pocock-writing-great-skills.md
hook: github:ojfbot/core#400
status: live
created_at: 2026-08-03T22:00:00Z
labels:
  project: skill-hardening
  wave: 2
  new_thread: true
---

## Context

Wave 1 (PR #404) rebase-merged to main 2026-08-03 (`a84ad6f` 1a, `4769373` 1b) with all TPMs
met — dead pointers 0, D4 97.1%, sprawl 15, deterministic Aligned 58. Wave 2's entrance
criterion (Wave 1 merged, so κ shifts are attributable) is therefore MET. Issue #400 is the
work order; the Wave 2 section of `decisions/skill-hardening-roadmap.md` is the doctrine; a
Wave-1 hand-off comment on #400 lists the known D5/D2 items.

## Goal

Rewrite skill descriptions (and catalog triggers where they duplicate) per D29, in **small
batches of ≤ 8 skills**, each batch gated by the suggester eval:

1. Per batch: rewrite per D29 — front-load the trigger word, one trigger per branch, cut
   body-duplicated identity. Then run `pnpm exec node scripts/suggester-eval.mjs`.
2. **Ship the batch only if holdout κ ≥ 0.603 AND overall κ does not drop.** A failing batch
   gets reverted or reworked, never shipped-and-watched.
3. Start with the D5 fails: `day-run` (also missing frontmatter entirely), `frame-dev`,
   `init` (+ its stale 8-repo table, J6 Gap), `scaffold-frame-app`; then the longest
   descriptions (`frame-standup` 102w/8 triggers). Also fix `fleet-onboard`'s missing catalog
   `category` (D2) while in the catalog.

## Acceptance criteria

- Holdout κ ≥ 0.603 after EVERY batch (hard gate; 0.603 is the fresh baseline — the 0.700
  figure was at-freeze, do not use it)
- Total description words 4,349 → ≤ 3,500
- D5 pass rate = 100% (verify with `node .claude/skills/skill-audit/scripts/audit-architecture.mjs --no-log --format=json`)
- Eval's current misses (G01 adr, G13 vault, summarize over-fires) not worsened — fixing them
  is upside, not a target
- PR(s) opened against core main; #400 updated with per-batch κ numbers (never auto-close)

## Constraints

- Descriptions + catalog triggers are IN scope (that is this wave). Skill BODY edits are OUT
  (Wave 3 pruning), except `init`'s repo-table J6 fix which #400 explicitly carries.
- The `MANDATORY:` description prefix is an ADR-0068 countermeasure — exempt from cutting
  unless the eval explicitly clears its removal on that skill.
- Edits land in `core/.claude/skills/<name>/` + `skill-loader/knowledge/skill-catalog.json`,
  never in `~/.claude/skills/` symlinks.
- Fresh worktree off origin/main; re-verify branch state before git ops (concurrent agents).
- pnpm only.

## RIDM points

- Wave 2: if two consecutive batches hold κ while cutting ≥ 15% description tokens, the D29
  style becomes the authoring default in `/skill-create`.
- Carried from Wave 1: promote D8 (sprawl) into the verdict roll-up once a J8 re-check on the
  25 disclosed skills shows no weak-pointer regressions — a small judgment pass worth running
  before or alongside batch 1.

## Flag back

- Any description whose honest rewrite would change the skill's *scope* (not just its trigger
  wording) → surface on #400, don't decide unilaterally.
- If a batch cannot hold κ ≥ 0.603 after two rework attempts, stop and report the failing
  skills with per-skill κ deltas rather than shrinking the batch to force a pass.
