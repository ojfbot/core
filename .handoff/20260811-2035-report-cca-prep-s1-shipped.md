---
id: 20260811-2035-report-cca-prep-s1-shipped
type: report
title: "cca-prep S1 shipped — multi-exam engine migrated, fleet-wired, /cca-prep status live"
actor: code-claude
responding_to: 20260811-1900-spec-cca-prep-repo
session_id: 2026-08-11T19:45:00-05:00
refs:
  - github:ojfbot/cca-prep#1
  - github:ojfbot/core#451
  - github:ojfbot/daily-logger#270
  - github:ojfbot/morning-cockpit#47
  - bead:20260811-1900-spec-cca-prep-repo
  - file:../cca-prep/implementation-notes.md
hook: github:ojfbot/cca-prep#1
status: live
labels:
  project: cca-prep
  slice: S1
---

## What got done

- **`~/ojfbot/cca-prep` exists** (private repo, github.com/ojfbot/cca-prep), merged via PR #1
  (bootstrap main + branch discipline honored). Zero npm dependencies; Node 24 built-ins.
- **Engine migrated** from `~/selfco/teach/cca-foundations-prep/app/` into a multi-exam deck
  registry: `decks/registry.json` + per-exam `exam.json`; **ccar-f active (141 q — bank +
  hard1 + hard2, copied verbatim)**, **ccdv-f / ccar-p blueprint stubs** seeded from the vault
  exam-guide source pages. Scope walls enforced in `engine/registry.mjs` (bare-filename deck
  refs, per-exam id dedup, `stretch` surface never merged into calibration).
- **Structural isolation**: per-exam SQLite (`engine/data/<exam>.db`); exam-scoped API
  (`/api/<exam>/…`); vault writers per exam → `~/selfco/teach/cca-prep/progress/<exam>.json` +
  `<exam>-study-notes.md` (dir intentionally not pre-created — see What surprised). Port 8631.
- **12/12 tests** incl. the AC1 deck-isolation gate (HTTP seam), registry walls, status smoke.
  CI: node tests + boundary-check (AC6) + no-React/Carbon ui-gate (AC7 wiring) + shared
  security-scan/skill-audit @v1. Browser-verified: drill answer graded ccar-f, stub view
  tab-filters correctly, zero console errors; UI visually unchanged.
- **Fleet-wired (AC9)**: northstar `l1-cca-prep` registered + ecosystem row + both
  frame-standup lists + skill-catalog v1.24 (core#451); daily-logger 3 surfaces incl. the
  set+map pair (#270); cockpit fleet card (#47); `install-agents.sh cca-prep` run and baseline
  committed. All merged green.
- **`/cca-prep` skill live** (mode `status`, legacy-snapshot fallback) — canonical in
  cca-prep, resolved via `~/.claude/skills/cca-prep` symlink; verified end-to-end against the
  real legacy snapshot.
- `publication-checklist.md` blocks any public flip (PDF swap **and git-history purge**).

## What's open

- **Cutover NOT executed** (by design): the old drill server on 8630 remains authoritative for
  CCAR-F drilling. Runbook in cca-prep README — stop old, copy `progress.db` →
  `engine/data/ccar-f.db`, start new. Gate (deck-isolation test green) is satisfied; execute
  whenever the operator wants, ideally between study sessions.
- Spec ACs deferred to later slices: generation pipeline (AC2), item retirement (AC3), adapt
  (AC4), triage-notes (AC5), research denylist enforcement (AC8), profile engine (AC10).
- `install-agents.sh` cannot manage out-of-core skills — `/cca-prep` symlink is hand-made;
  convention gap worth an ADR if a second out-of-core skill appears.

## What surprised

- Creating the new vault snapshot pre-cutover would have **shadowed live telemetry**:
  `/cca-prep status` prefers `cca-prep/progress/ccar-f.json` over the legacy snapshot, so a
  single verification answer would mask the operator's real 187-answer state. Verification ran
  against scratch dirs instead; the real snapshot first appears at cutover. (Logged in
  cca-prep `implementation-notes.md` deviations.)
- ojfbot repos other than cca-prep allow **rebase-merge only** — merge/squash both rejected.

## Recommended next session

**Slice 2 = the generation pipeline, not the GroupThink skin.** Reasoning: the operator sits
~Sep 8 and has consumed the hard decks (77% first-attempt, misses mapped); mocks need
decorrelated material, which only generator briefs + giveaway linter + blind-solve QA can
produce. It unlocks AC2/AC3, and the batch-3 seed list already exists in the spec's handoff
state. The skin has zero study value and can land any time before the blogengine article —
bundle it with S2's tail or the article beat. Start from the spec's pipeline section and the
`adapt` weak-task bias contract.
