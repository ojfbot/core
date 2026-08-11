---
id: 20260808-1445-report-decomposition-s1-reconciler-pr436
type: report
title: "core decomposition S1 shipped: fleet reconciler (shadow) — PR #436 open"
actor: code-claude
session_id: 2026-08-08T14:45:00Z
refs:
  - github:ojfbot/core#436
  - file:scripts/fleet-manifest.mjs
  - file:.claude/skills/fleet-onboard/knowledge/surface-matrix.md
  - file:TECHDEBT.md
status: open
created_at: 2026-08-08T14:45:00Z
labels:
  project: core-decomposition
  slice: S1
---

# core decomposition S1 shipped (shadow reconciler)

Session 2026-08-08: full architecture trace + Pocock audit of core (4 diagrams delivered
in-session; audit verdict = domain/functional blur is real and mechanized), decomposition
proposal decided as **Option A: in-repo re-layering, no repo split** (operator-approved),
6 control-gated slices S1–S6.

## What shipped

PR #436 (open, human-gated): `scripts/fleet-manifest.mjs` + 12 tests +
`.github/workflows/fleet-reconcile.yml`. Registry frontmatter = single source (loaded via
`northstar-fm.mjs`, no reparse); diffs the machine-readable surfaces of the fleet-onboard
surface matrix; emits `fleet.json`. **Shadow only** — exit 0 on drift, `--check` exists but
unwired; promotion = S6 RIDM decision.

First live run caught real drift: `f1-learning-studio` on the CLAUDE.md table with no dir
on disk; `gcgcca` (pre-rename) still in daily-logger `build-api.ts`; `fieldwork-1`
registered but on no surface.

## Gotchas hit

- Local core main is diverged (16 ahead / 1 behind origin) — S1 was built from a fresh
  worktree off origin/main; do NOT build later slices from local main without reconciling it.
- 3 pre-existing test failures (skill-acted-emit ×3, reconcile-skill-acted) reproduce only
  from isolated worktrees outside `~/ojfbot`; they pass in the installed checkout
  (vantage assumption in those tests — logged in implementation-notes.md Deviations).
- An in-flight `pocock-v12` worktree (`feat/pocock-v1-2-absorb`) is already absorbing
  Pocock v1.2 — overlaps the audit's rubric-drift finding; check it before duplicating.

## Next

S2 (personal exile + attic + dead-structure delete) is **gated on #436 merging**. Then S3
domain-knowledge restratify → S4 decisions hygiene → S5 honest caches → S6 enforce.
Full slice table + risk register: session plan
`~/.claude/plans/i-think-core-has-partitioned-sunrise.md`.
