---
id: 20260803-1805-brief-teach-in-the-loop-work-the-frontier
type: brief
title: "teach-in-the-loop: map merged (PR #387) — work the frontier, start #380"
actor: code-claude
to: code-claude
session_id: 2026-08-03T18:05:00Z
refs:
  - github:ojfbot/core#379
  - github:ojfbot/core#380
  - github:ojfbot/core#382
  - github:ojfbot/core#383
  - github:ojfbot/core#384
  - github:ojfbot/core#387
  - file:decisions/wayfinder/teach-in-the-loop.md
  - file:decisions/adopt-stack/pocock-skills-v1-1.md
  - file:decisions/wayfinder/diagram-first-output.md
hook: github:ojfbot/core#379
status: live
created_at: 2026-08-03T18:05:00Z
labels:
  project: teach-in-the-loop
  new_thread: true
---

## Context

Wayfinder map `teach-in-the-loop` charted and MERGED 2026-08-03 (PR #387, rebase-merge; map
canonical at `decisions/wayfinder/teach-in-the-loop.md`, umbrella #379, tickets #380–#386
wired with native blocked-by). Charting closed zero tickets. Destination: ZPD-calibrated
teaching as a standing output of fleet work — standalone Pocock-style teach workspaces in
shadow sessions accumulating a drawable corpus; merge-quiz heatmap grows into the ZPD sensor;
HTML lessons render in the side panel like SVG diagrams do.

Operator rulings already made (Destination framing — do NOT re-litigate): (1) anchor bid =
new l1-core operator-competence property, decided by #381; (2) standalone shadow-space
workspaces, working trees stay clean; (3) HTML canonical for lessons + exactly ONE
second-surface probe (fog until #386 closes). ZPD is the core organizing principle.

## Next

Work mode, ONE ticket per session. Frontier: #380 (adopt-stack pass — recommended first, it
unblocks #381 + #386), #382 (corpus location), #383 (field-evidence research, ONE
deep-research cycle), #384 (ZPD sensor). Claim = assignment before any work; resolution
comment + close + one-line gist appended to `## Decisions so far` in the map file; tend fog.

For #380: run `/adopt-stack` on `mattpocock/skills` `productivity/teach` (pin the commit),
new record in `decisions/adopt-stack/`; extend, don't fork, `pocock-skills-v1-1.md` (D6
precedent answered by the shadow-space ruling). Per-opinion calls are the operator's.

## Gotchas

- Branch from `origin/main`, not local main — local main carries another session's unpushed
  bead commits (see implementation-notes.md Deviations 2026-08-03).
- Repo is rebase-merge only.
- SE-pattern learning note (ICOM/IDEF0 mapping) lives as a comment on PR #387; its
  convention-extension candidate is fog on `diagram-first-output.md`, owned there, not here.
