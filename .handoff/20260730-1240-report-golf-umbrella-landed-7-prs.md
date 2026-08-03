---
id: 20260730-1240-report-golf-umbrella-landed-7-prs
type: report
title: "GOLF UMBRELLA landed: cluster-golf as 7 open human-gated PRs — rename, decomposition, registrations, design evidence; nothing merged"
actor: code-claude
session_id: golf-umbrella-northstar-landing-2026-07-30
refs: []
hook: "github:ojfbot/core#297"
status: closed
created_at: 2026-07-30T12:40:00-0500
labels:
  project: cluster-golf
---

## What shipped (all OPEN, all human-gated — merge order matters)

| # | PR | content |
|---|---|---|
| 1 | github:ojfbot/gcgcca#5 | capture-agent identity + l1-capture-agent northstar. Dir ALREADY renamed on disk: `~/ojfbot/gcgcca` → `~/ojfbot/capture-agent` (remote unchanged — Q1) |
| 2 | github:ojfbot/fairway#1 | NEW repo (private), fresh-import decomposition of mirrorworld/apps/fairway + l1-fairway + rm-l1-fairway (ADR in-repo) |
| 3 | github:ojfbot/core#297 | registrations + posture fields + code-proposed ladder-stress + fleet sweep. Lint 0 ERRORs (19/19, 13/13, 195 slices) |
| 4 | github:ojfbot/mirrorworld#11 | ⚠ PARENT-ADJACENT: P2/P5 retired, S5–S8/S17 deleted (→ rm-l1-fairway S1–S5), S9/S14 re-pointed. **Merge strictly after #1-fairway and core#297** |
| 5 | github:ojfbot/core#298 | offsite/confirmed/cluster-golf.md (+ 2 L1 captures), schema-log ITERATION-6-GOLF entry, itinerary Leg-3 rows (8a–8f) |
| 6 | github:ojfbot/daily-logger#259 | sweep-list rename (until merged, the nightly sweep silently misses capture-agent + fairway) |
| 7 | github:ojfbot/morning-cockpit#41 | fleet cards rename + fairway |

## Key facts a future session needs

- gcgcca was NEVER registered → fresh registration, no retirement entry anywhere.
- Cluster tier stays designed-not-built: no registry node, no cluster refs in ladders_up_to; intended refs in SYNTHESIS only. Members = repos uniformly (⚑); property-subset branch DEAD.
- Seeds (golf-press/golf-runner/golf-research/hardware) = itinerary rows only, NO registry entries; pull conditions UNRATIFIED.
- fairway builds only with sibling `../mirrorworld` checkout (file: deps; exports fix = producer-side follow-up, recorded in fairway's ADR).
- Deviation log: implementation-notes.md on core branch feat/golf-offsite-artifacts.
- Worktree `~/ojfbot/core-golf-landing` hosts the two core branches — remove after merges.
