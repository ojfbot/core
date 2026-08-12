---
id: 20260803-2130-report-skill-hardening-wave-1-shipped
type: report
title: "skill-hardening Wave 1 shipped: PR #404 open, all four TPMs met"
actor: code-claude
session_id: 2026-08-03T21:30:00Z
refs:
  - github:ojfbot/core#399
  - github:ojfbot/core#404
  - 20260803-2015-brief-skill-hardening-wave-1
  - file:docs/skill-audit/2026-08-03-extended-audit.md
  - file:decisions/skill-hardening-roadmap.md
hook: github:ojfbot/core#399
status: closed
created_at: 2026-08-03T21:30:00Z
labels:
  project: skill-hardening
  wave: 1
---

## What shipped

PR #404 (branch `feat/skill-hardening-wave-1` off `85e6d51`), two commits: 1a `cc6a86c`
(dead/weak pointers, 12 skills), 1b `b68a74a` (sprawl disclosure, 25 skills). Numbers posted
on #399. Issue left open per never-auto-close.

TPMs, all met: dead pointers 5→0 · D4 pass 61.8%→97.1% (2 fails ≤ 3) · sprawl 30→15 ·
deterministic Aligned 39→58 · body words 69,464→53,138 · zero D1–D7 regressions, untouched
skills bit-identical.

## Decisions a reviewer must ratify (flagged in PR body)

- `pr-review/knowledge/framework-checks.md` = copy of /validate's file (smell-baseline
  precedent) rather than delete-the-pointer.
- Gate-skill contract grazes: gated-slice SEH vocabulary table + deliverable-tracking moved;
  grill-with-docs core-principles block moved (gates preserved inline elsewhere). One-edit
  reverts each.

## Discoveries

- **Gotchas-heavy gate skills have a sprawl floor** the 800w threshold doesn't model:
  grill-with-docs 1456, gated-slice 1243, tdd 969 bottom out at Gotchas+Constraints+gates.
  Hit the ≤15 TPM by disclosing deepen (1332→770) and diagram-intake (1005→709) instead —
  logged in implementation-notes.md ## Deviations.
- `claude-md-rollout` and `day-run` have nothing reference-shaped to move — the 2 allowed
  D4 fails are these, honestly skipped rather than stub-gamed.
- The audit's D6_soft regex trips on pointer wording ("beat count") — one reword needed
  during verification.

## Wave 2/3 hand-off

D5 fails (init, day-run, frame-dev) + fleet-onboard D2 catalog category → noted on #400.
resume/opm missing Gotchas stays Wave 3. RIDM: D8-into-verdict promotion awaits a J8
re-check on the disclosed skills.
