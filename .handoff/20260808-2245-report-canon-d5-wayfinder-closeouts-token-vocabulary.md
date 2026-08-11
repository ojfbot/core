---
id: 20260808-2245-report-canon-d5-wayfinder-closeouts-token-vocabulary
type: report
title: "Canon D5 generator, wayfinder closeouts, TD-007 row 15, token vocabulary — shipped (PR #445)"
actor: code-claude
to: operator
session_id: 2026-08-08T22:45:00Z
responding_to: 20260808-2150-brief-canon-wayfinder-closeouts-and-token-vocabulary
refs:
  - github:ojfbot/core#445
  - file:scripts/lib/fleet-map-d5.mjs
  - file:scripts/fleet-map-d5.mjs
  - file:domain-knowledge/apps/chat-token-vocabulary.md
  - file:decisions/wayfinder/cockpit-northstar-conversation.md
  - file:decisions/wayfinder/diagram-first-output.md
status: closed
created_at: 2026-08-08T22:45:00Z
labels:
  - canon
  - wayfinder
  - td-007
---

# Report — canon D5 generator, wayfinder closeouts, TD-007, token vocabulary

## What landed

All four brief items, one PR, one branch `feat/canon-d5-wayfinder-closeouts-token-vocab`.

### Updated

- **Wayfinder — `cockpit-northstar-conversation`:** prototype evidence recorded in Notes for #338
  (canvas needs ≥560px workable / ≥700px comfortable; the 372px rail takes inspector + threaded
  chat) and #340 (keyed `{global | repo}` threads, per-thread share toggle, focus-change pins the
  thread and repoints the inspector). Two **proposed, unratified** rulings added to Decisions (D7
  thread keying, D8 canvas placement); both tickets moved to `answered — awaiting ratification` and
  the Frontier line now states that an answered ticket does **not** clear its blocking edge — #339
  stays blocked behind #338 until D8 is ratified.
- **Wayfinder — `diagram-first-output`:** evidence recorded for #368/#372 — the hand-rolled ~200-line
  zero-dependency SVG viewer carried 66 nodes across two modes, so *viewing* needs no library;
  nothing in it creates, moves, or persists a shape, so it is **not** evidence about editing. D3/D4
  proposed: re-scope #368/#372 to editable canvases only, and ship the fleet's first canvas as a
  viewer over the Mermaid canon.
- **Canon — D5 is now generated.** `scripts/lib/fleet-map-d5.mjs` + CLI `scripts/fleet-map-d5.mjs`:
  registry → mermaid → dark-native fence (`config: theme: dark`), appended to
  `~/selfco/diagrams/fleet-map.md` per the standing file's append discipline. Current output: 20
  registry entries / 18 L1 / 7 clusters / 10 nodes / 0 unclustered. Golden-file test +6 behaviour
  tests in `scripts/lib/__tests__/fleet-map-d5.test.mjs`. D6–D8 stay authored.
- **TD-007 — surface matrix row 15.** The cockpit fleet-structure pane registered as
  **REGISTRY-GENERATED** with the "verify it is still generated" action, plus a new reconcile step 3
  that checks generated surfaces for an acquired hand list (drift a name-diff cannot see). Matrix
  preamble now leads with mechanism; `14-surface` → `15-surface` in the skill.
- **Token vocabulary registered.** `domain-knowledge/chat-token-vocabulary.md`: the five phase-1
  tokens with a capability class each (read-only / UI-state / gated-write), four invariants, a
  GLOSSARY entry, and a CLAUDE.md pointer. Core verbs as tokens are recorded as **not registered —
  a new operator decision**, with the reason (shared-state mutation, the `check:`/`autonomy_fit`
  hazard) so a later session cannot read the absence as an oversight.

## Measured / tested

- `pnpm vitest run` — 533 passed, 70 skipped, 0 failed (7 new).
- `node scripts/northstar-lint.mjs` — 0 errors, same 3 pre-existing warnings as the main baseline.
- `node scripts/fleet-map-d5.mjs --json` — 0 warnings against the live registry.

## Awaiting the operator

1. **Ratify or reject D7/D8** on `cockpit-northstar-conversation`, and pick #338's disposition:
   close (surface answer was what was needed; cadence folds into #335) or re-scope to "does the
   ladder cadence survive a chat rail" and keep #339 blocked behind it. The prototype answered the
   surface half only — it did not run the three cadence variants the ticket asked for.
2. **Ratify or reject D3/D4** on `diagram-first-output` (re-scope #368/#372 to editability).
3. Tracker issues were **not** touched — map edits only, per the brief. Issue bodies still show the
   old statuses.

## Deviations logged (3)

Presentation clusters kept inside the generator rather than a data file (would have become surface
#16); a registry data fix for trailing `#` comments that corrupted `buddy-check`'s parsed slug and
tier, with the generator now warning rather than sanitizing; cross-repo ADR citations qualified
after finding core's ADR-0005/0012 are different documents from the cockpit's. Full text in
`implementation-notes.md`.

## Out of scope (untouched, per brief)

Switchboard S9 adoption; RFQ-004 cluster-tier schema (#341 stays blocked); any write into
`decisions/northstar/` beyond the comment-formatting fix in the registry README.
