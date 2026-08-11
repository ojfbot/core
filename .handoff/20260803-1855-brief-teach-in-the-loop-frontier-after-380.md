---
id: 20260803-1855-brief-teach-in-the-loop-frontier-after-380
type: brief
title: "teach-in-the-loop: #380 closed (PR #388) — frontier open, #381 recommended next"
actor: code-claude
to: code-claude
session_id: 2026-08-03T18:55:00Z
refs:
  - github:ojfbot/core#379
  - github:ojfbot/core#380
  - github:ojfbot/core#381
  - github:ojfbot/core#382
  - github:ojfbot/core#383
  - github:ojfbot/core#384
  - github:ojfbot/core#386
  - github:ojfbot/core#388
  - file:decisions/wayfinder/teach-in-the-loop.md
  - file:decisions/adopt-stack/pocock-skills-teach.md
  - file:decisions/adopt-stack/pocock-skills-v1-1.md
hook: github:ojfbot/core#379
status: live
created_at: 2026-08-03T18:55:00Z
labels:
  project: teach-in-the-loop
  new_thread: true
---

## Context

Ticket #380 (adopt-stack pass on `mattpocock/skills` `productivity/teach`) CLOSED 2026-08-03 via
PR #388 (rebase-merge `31623ea`). Record: `decisions/adopt-stack/pocock-skills-teach.md`, pinned
upstream `2ab958093e83e0ec752e6c1c5932da465bf23e0c`, Gate 0 LIBRARY (0/6), D18–D25 extending
`pocock-skills-v1-1.md`. Operator verdicts: ABSORB mission interrogation (D18); RESOURCES vetting
with internal fleet artifacts first-class (D19); community delegation external-domains-only (D20);
evidence-gated learning records — format only, location→#382, sensor→#384 (D21); records+mission
ZPD placement as per-workspace FLOOR, #384 owns heatmap augment/override (D22); full HTML
lesson+assets shape, #386 verifies (D23); reference/glossary split with understanding-gate (D24);
REJECT NOTES.md — teaching prefs live in fleet memory, injected at workspace spawn (D25). Map
status is now `working`; trigger-points fog carries the D25 spawn-injection requirement.

## Next

Work mode, ONE ticket per session. Frontier: **#381** (l1-core operator-competence property bid —
recommended next: it settles the map's anchor; if "no", frontmatter falls back to
`ns:l2-ojfbot#P2`), **#386** (HTML lesson pattern spike, /prototype — D23 gives it its working
spec to verify), **#382** (corpus location — shadow-space ruling + D21/D25 are its inputs),
**#384** (ZPD sensor — D22 floor ruling is its input), **#383** (field-evidence research, ONE
deep-research cycle, findings to `decisions/research/`). #385 stays blocked by #384. Claim =
assignment before any work; resolution comment + close + one-line gist to `## Decisions so far`;
tend fog.

For #381: grilling ticket (/grill-with-docs). The question is whether l1-core earns a fifth
property (operator competence) with the teach loop as its instrument. Do NOT write northstar
`current:` from the session (movement-contract discipline); the resolution records the decision —
if "yes", the property lands via the registry's own PR path; if "no", correct the map frontmatter
anchor in the same PR as the map tend.

## Gotchas

- Branch from `origin/main`, never local main (still carries another session's unpushed bead
  commits). Repo is rebase-merge only.
- `main` is checked out by another session's worktree (`…/50e6dcf3…/scratchpad/core-main`), so
  `gh pr merge --delete-branch`'s local post-merge checkout FAILS after the remote merge succeeds
  — verify merge state via the API, don't rerun. (implementation-notes.md Deviations 2026-08-03.)
- Work in a disposable `git worktree add … origin/main`; the core checkout is dirty and owned by
  concurrent sessions.
- Charting rulings are settled — do not re-litigate D18–D25, the shadow-space ruling, or
  HTML-canonical.
