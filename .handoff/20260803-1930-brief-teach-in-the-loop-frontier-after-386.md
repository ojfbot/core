---
id: 20260803-1930-brief-teach-in-the-loop-frontier-after-386
type: brief
title: "teach-in-the-loop: #386 + #381 closed, P5 landed — frontier open, #384 recommended next"
actor: code-claude
to: code-claude
session_id: 2026-08-03T19:30:00Z
refs:
  - github:ojfbot/core#379
  - github:ojfbot/core#382
  - github:ojfbot/core#383
  - github:ojfbot/core#384
  - github:ojfbot/core#385
  - github:ojfbot/core#391
  - github:ojfbot/core#393
  - github:ojfbot/core#389
  - github:ojfbot/core#392
  - github:ojfbot/core#394
  - file:decisions/wayfinder/teach-in-the-loop.md
  - file:.claude/northstar.md
hook: github:ojfbot/core#379
status: superseded
superseded_by: 20260803-2000-brief-teach-in-the-loop-382-384-paired
created_at: 2026-08-03T19:30:00Z
labels:
  project: teach-in-the-loop
  new_thread: true
---

## Context

Two tickets closed 2026-08-03. **#381** (anchor bid) → **YES**: l1-core earns P5 "The harness
raises operator competence," teach loop as instrument; the registry amendment (PR #389) is
**MERGED** and `current: 5` is live on `origin/main`. **#386** (HTML lesson pattern spike) →
resolved via PR #392: HTML earns its keep, D23's `./assets/` opinion **amended** —
"self-contained" and "shared stylesheet in `./assets/`" conflict at the render boundary and
self-contained wins. Measured: strip the sibling stylesheet and the lesson falls back to Times
at an 8px body margin (0 rules loaded), losing every Tufte/printability opinion, while the
inline quiz JS keeps working. **Presentation is the fragile part, not interactivity.** Ruling:
`assets/lesson.css` stays the authoring source; the shipped lesson is build output with CSS
inlined. Primary source: branch `wayfinder/386-html-lesson-spike` (never merged),
`prototypes/386-html-lesson/VERDICT.md`.

Fog tended: second-surface probe **graduated** to **#391** (`/merge-quiz` as an interactive
page — the quiz mechanic is the portable piece; standup brief lost). New ticket **#393** filed
via PR #394 (design-system inheritance) after the operator asked for brand-language styling —
`frame-ui-components` ships inlinable `tokens.css` (44 CSS custom properties) but 11 **React**
components a zero-dependency lesson cannot use without reversing #386.

**Zero open PRs fleet-wide.** Nothing is waiting to merge anywhere.

## Next

Work mode, ONE ticket per session. Frontier (open + unblocked + unassigned): **#384**, **#382**,
**#383**, **#391**, **#393**. #385 stays blocked by #384.

**Recommended: #384 (ZPD sensor).** P5 is now a *ratified* northstar property whose **primary
measure** is taught-vs-cold movement on the merge-quiz EWMA heatmap — and whether that heatmap
can actually place lessons is exactly what #384 decides. A ratified property whose primary
instrument is unvalidated is the failure mode P1's measurement-first discipline exists to
prevent. #384 also unblocks #385. Its inputs: the D22 floor ruling (records+mission ZPD
placement is a per-workspace floor; #384 owns whether the cross-workspace heatmap augments or
overrides it), and today's instrument — `scripts/hooks/merge-quiz.mjs` →
`~/selfco/tracking/merge-observations.jsonl`, EWMA alpha 0.4, repo × domain cells, taught/cold
never merged.

Alternatives: **#382** — now a *shorter* session than it was, because the operator ruled its
largest sub-question in conversation on 2026-08-03 (recorded as a comment on the ticket):
**per-repo worktrees + Obsidian**, new sibling repo **rejected**. Two stages — author in a
per-repo `git worktree` (shadow space, next to the code the lesson cites), deposit to
`~/selfco/teach/` (durable fleet corpus), mirroring how `/diagram` deposits to
`~/selfco/diagrams/` and inheriting that folder role's D6 clearance as an artifact sink rather
than a work-item surface. **Still open in #382:** the deposit step (a worktree is disposable —
if deposit doesn't fire the corpus never accumulates; same shape as the TD-006 bead-closure
gap, so it wants a hook emitting evidence, not a convention), commit-or-not for the workspace,
the `learning-records/` shape at the #382↔#384 seam, the `teach/` vault folder role (must be
mirrored into `core/.claude/skills/vault/templates/vault-claude-md.md` per ADR-0088), and a
markdown index since Obsidian will not render standalone `.html` as a page.
Also: **#393** if continuing the styling thread while it is fresh (recommend it before #391 so
the probe lands on-brand); **#383** (research — ONE deep-research cycle, findings to
`decisions/research/`, never parallel).

## Gotchas

- **Verify `current: 5` was operator-ratified.** PR #389 was explicitly human-gated ("do not
  merge without operator calibration of the numbers") and merged at 19:23:21Z under the shared
  `ojfbot` account, with the proposal value intact. If that was a concurrent agent rather than
  the operator, `current: 5` needs a correction PR. Do not treat it as calibrated until
  confirmed.
- Branch from `origin/main`, never local main. Repo is rebase-merge only.
- `main` is checked out by another session's worktree, so `gh pr merge --delete-branch` fails
  its local post-merge checkout after the remote merge succeeds — verify via the API, don't rerun.
- Work in a disposable `git worktree add … origin/main`; the core checkout is dirty and owned by
  concurrent sessions. **Concurrent sessions move main mid-task** — #381 landed under this
  session's feet and forced a rebase. Re-fetch before assuming mergeability.
- `packages/workflows/src/__tests__/maintenance-patrol.test.ts > orphanCheck` is **flaky**
  (`ENOTEMPTY` on a temp dir; passed and failed on the identical SHA). Re-run rather than debug;
  a fix task is already spawned.
- Charting rulings are settled — do not re-litigate D18–D25, the shadow-space ruling,
  HTML-canonical, or #386's self-containment finding.
