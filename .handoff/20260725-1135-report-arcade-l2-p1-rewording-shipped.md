---
id: 20260725-1135-report-arcade-l2-p1-rewording-shipped
type: report
title: "Arcade — #274 L2 P1 rewording shipped (retroactive close; brief outlived the work)"
actor: code-claude
responding_to: 20260723-1629-brief-arcade-l2-p1-rewording-pickup
session_id: 2026-07-25T11:35:26-05:00
refs:
  - github:ojfbot/core#272
  - github:ojfbot/core#274
  - github:ojfbot/core#285
  - bead:20260723-1629-brief-arcade-l2-p1-rewording-pickup
hook: arcade
status: closed
created_at: 2026-07-25T11:35:26-05:00
labels:
  project: core
  retroactive: true
---

## What got done

**Nothing this session — #274 was already shipped when this bead's brief was picked up.** This
report exists to retire the hook, not to claim work. Everything below was delivered by the
2026-07-23 session and is verified against git and the tracker, not against beads.

- **PR ojfbot/core#285** — "wayfinder: resolve #274 — reword L2 P1 venue-neutral, add P3 Arcade",
  rebase-merged to `main` 2026-07-23T22:27Z as `42645678a51401b5105bb362aa144bfe357794f5`.
  Confirmed an ancestor of `origin/main`.
- **`decisions/northstar/l2-ojfbot.md`** — P1 revised in place as **"The fleet ships usable
  surfaces"**, `current: 55` unchanged, verification now "a recorded session per active app in its
  natural venue"; the ≥3-MF-remotes / cross-domain hero-demo clause is gone. New **P3 "The Arcade
  fronts the fleet"**, `current: 10` (credits shell's Tier-A switcher), `ladders_up_to:
  ns:l3-shared#P1`. Vision + P1 body carry the dated `Revised 2026-07-23 (wayfinder #274)` note;
  "Frame OS" now names the Tier-A cluster only.
- **#274 CLOSED** 2026-07-23T22:27Z, with a resolution comment posted 2026-07-23T22:28Z recording
  the question-by-question wording confirmation.
- **Map tended** — `decisions/wayfinder/operating-surface-bonded-pair.md` has #274 as `closed` in
  the ticket table, a Closed-tickets entry, and a Destination paragraph citing both `#P1` and `#P3`.
- L1 northstars deliberately **not** re-pointed to P3.

The brief's drafted wording was adopted essentially as written; the split-properties fork Yuri
decided (revise P1 in place, add P3 from a low baseline) shipped intact.

## What's open

Nothing on #274. The frontier under **#272** is unchanged: **#275** (registry schema home), **#277**
(fui-c headless refactor path, unblocked by #276), **#279** (estate charter), **#281** (tier B talk
seam) — one per session.

## What surprised

**The brief outlived the work by twelve hours and read as pending.** A cold pickup on 2026-07-25
took this bead at face value and was about to redo a merged change; only checking `origin/main` and
the issue state caught it.

That is not an isolated slip. `decisions/loops/loops.md` declares a loop `hook-bead-session` whose
`purpose:` is *"Session-close bead emission — writes the session's report bead + events"* — but
`scripts/hooks/bead-session.sh` is a **PostToolUse** hook (registered in `.claude/settings.json`
under the `Skill` and `Bash` matchers) that records skill invocations and Dolt task/PR beads. It
never touches `.handoff/` and has no session-end path. **Nothing writes the session's report bead.**

It stayed invisible because each guard has a structural gap: `loops-lint.mjs` only checks that
`trigger_ref` exists on disk (it does, so lint is green — presence is not purpose conformance);
`loops-liveness.mjs` skips `cadence: event` loops by design; and the entry declares
`verifier: "none"`. Its `evidence_ref: dolt:bead_events` points at a stream believed empty (not
verified here — Dolt was not running and was not started).

Downstream, `orient.py:119-121` computes open hooks as live briefs minus the ids some report names
in `responding_to`. With no reports written, every brief is a permanently open hook. Fleet-wide:
**28 open hooks, 9 report beads total, 3 beads ever reaching `status: closed`, and 21 of 65 beads
(32%) non-conformant** and therefore invisible to `orient.py`.

Filed as **TD-006** in `TECHDEBT.md`; scheduled as **`rm:rm-l2-ojfbot#S32`** (make the closure loop
real and measurable) and **`rm:rm-l2-ojfbot#S33`** (backfill the ledger).

## Recommended next session

Take one frontier ticket under #272 — **#277** is the natural pick now that #276's precedent survey
has unblocked it. Independently, S32 is queued and self-contained if the ledger gap is the higher
priority; S33 depends on it.
