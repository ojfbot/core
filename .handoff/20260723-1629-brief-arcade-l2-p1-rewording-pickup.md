---
id: 20260723-1629-brief-arcade-l2-p1-rewording-pickup
type: brief
title: "Arcade — resolve wayfinder #274 (L2 P1 rewording, split P1/P3 decided, wording drafted)"
actor: code-claude
to: code-claude
session_id: 2026-07-23T21:29:06Z
refs: ["ojfbot/core#272", "ojfbot/core#274", "ojfbot/core#282", "ojfbot/core#283"]
hook: arcade
status: live
created_at: 2026-07-23T21:29:06Z
labels:
  project: core
---

## Context

The 2026-07-23 session ran the fleet survey → operating-surface alignment grill → artifacts. All
MERGED to core main: PR #282 (3 draft ADRs: `adr:operating-surface-tiered-composition`,
`adr:bonded-pair-division-of-labor`, `adr:headless-components-with-design-language-adapters`;
CONTEXT.md Operating Surface aggregates; 13 GLOSSARY terms) and PR #283 + this PR (wayfinder map
`decisions/wayfinder/operating-surface-bonded-pair.md`, umbrella #272).

Decisions locked: the surface is named **Arcade** (Benjamin *Arcades Project* register, #273
closed); **demo-track targeting retired** (TBC pitch / Track A/B / hero demo no longer goals —
`frame-os-context.md` framing is stale, doc surgery rides with #274); estate layer =
inventory-first shadow-first (#279 will stage its ADR); research ticket #276 closed — findings at
`decisions/research/2026-07-23-headless-component-contract-survey.md` (feeds #277/#278).

**#274 is claimed and mid-grill.** The fork is DECIDED by Yuri: **split properties** — P1 stays
fleet-shipping (venue-neutral, revised in place, odometer continuous at 55); NEW P3 tracks Arcade
integration from a low baseline. Draft wording (drafted, NOT confirmed — Yuri deferred to a fresh
session; confirm or adjust before committing):

- P1 name: "The fleet ships usable surfaces" · target: "Every active app is past scaffold and
  usable end-to-end in its own venue; usability evidenced by recorded sessions, not asserted." ·
  verification: "Recorded session per active app in its natural venue (Arcade, cockpit, browser,
  game client); registry lists the app as active." · current: 55 · ladders unchanged.
- P3 (new) name: "The Arcade fronts the fleet" · target: "Arcade launches, fronts, and talks to
  registered apps across Tiers A and B, respecting declared cardinality — ≥5 apps spanning both
  tiers in one session." · verification: "Recorded Arcade session fronting ≥5 apps across both
  tiers; registry declares role/tier/cardinality; instance switching shown on one multi-instance
  app." · current: 10 (credits shell's Tier-A switcher) · ladders_up_to: ns:l3-shared#P1.
- Body surgery: Vision paragraph + P1 section drop Frame OS/demo-track framing with a dated
  retirement note; add P3 section.

## Goal

Resolve #274: confirm/adjust the drafted wording with Yuri, edit
`decisions/northstar/l2-ojfbot.md` (revise P1 in place — keep the #P1 id, lint requires L1
`ladders_up_to` refs to resolve; add P3), PR + merge, close #274 with a resolution comment,
tend the map (decision line, table row, check whether any L1 should ladder to P3 later — do not
re-point L1s now). Then the frontier is #275 registry schema home, #277 fui-c refactor path (now
unblocked by #276), #279 estate charter, #281 tier B talk seam — one per session.

## Gotchas

- Core main is push-protected; work in a worktree off origin/main (main checkout may sit on
  another agent's branch — 23 concurrent agents; never switch its branch). Rebase-only merges.
- Answers never touch `status.jsonl` — the P1 revision is wording; movement lines come later via
  record-movement (rerun = dupe).
- ADR drafts stay Proposed/unnumbered until `/adr accept` (never reserve serials, ADR-0087).
- Session memory: `~/.claude/projects/-Users-yuri-ojfbot/memory/project_operating_surface_alignment.md`
  is current through this bead; update it when #274 closes.
