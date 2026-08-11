---
id: 20260803-2000-brief-teach-in-the-loop-382-384-paired
type: brief
title: "teach-in-the-loop: rule #382 then #384 in one session — they share the learning-records seam"
actor: code-claude
to: code-claude
session_id: 2026-08-03T20:00:00Z
refs:
  - github:ojfbot/core#379
  - github:ojfbot/core#382
  - github:ojfbot/core#384
  - github:ojfbot/core#385
  - github:ojfbot/core#386
  - github:ojfbot/core#389
  - github:ojfbot/core#391
  - github:ojfbot/core#393
  - file:decisions/wayfinder/teach-in-the-loop.md
  - file:decisions/adopt-stack/pocock-skills-teach.md
  - file:scripts/hooks/merge-quiz.mjs
  - file:.claude/northstar.md
hook: github:ojfbot/core#379
status: live
supersedes: 20260803-1930-brief-teach-in-the-loop-frontier-after-386
created_at: 2026-08-03T20:00:00Z
labels:
  project: teach-in-the-loop
  new_thread: true
---

## Task

Rule **#382 (corpus location)** and then **#384 (ZPD sensor)** — in that order, in one session.

**This is a deliberate exception to wayfinder's one-ticket-per-session rule.** The justification:
D21 split one seam across the two tickets (learning-record *format* absorbed; *location* → #382;
*sensor* → #384). Ruling them in separate sessions risks two sessions disagreeing about the same
artifact. The exception does **not** merge them:

- Two separate `/grill-with-docs` passes, #382 fully ruled before #384 opens.
- **Two** resolution comments, **two** closes, **two** one-line gists in `## Decisions so far`.
- If #382's ruling turns out to make #384 unanswerable, close #382, say so plainly, and stop.
  A half-ruled #384 is worse than an open one.

## Context — what closed today

- **#380** adopt-stack pass → D18–D25 (`decisions/adopt-stack/pocock-skills-teach.md`).
- **#381** anchor bid → **YES**. l1-core earns **P5 "The harness raises operator competence."**
  Registry PR #389 is **MERGED**; `current: 5` is live on `origin/main`. P5's **primary measure**
  is taught-vs-cold movement on the merge-quiz EWMA heatmap.
- **#386** HTML lesson spike → HTML earns its keep; D23's `./assets/` opinion **amended**
  (self-contained wins at the render boundary — strip the sibling stylesheet and the lesson falls
  back to Times/8px margin, losing every Tufte opinion, while inline quiz JS survives).
  `assets/lesson.css` = authoring source; shipped lesson = build output with CSS inlined.
  Primary source: branch `wayfinder/386-html-lesson-spike` (never merged).

Also filed: **#391** (second-surface probe → `/merge-quiz` as an interactive page) and **#393**
(design-system inheritance / brand tokens). Neither is this session's work.

**Zero open PRs fleet-wide** as of 2026-08-03 ~19:30Z.

---

## Ticket 1 — #382, where does the teach corpus live?

### Already ruled by the operator (2026-08-03, in conversation; recorded as a comment on #382)

**Per-repo worktrees + Obsidian.** A new sibling repo (`ojfbot/teach-corpus`) was **rejected**.

Two stages, not one location:

| Stage | Where | Character |
|---|---|---|
| Authoring | per-repo `git worktree` (shadow space) | transient, disposable, sits next to the code and diffs the lesson cites |
| Corpus | `~/selfco/teach/` (Obsidian) | durable, fleet-wide, browsable, accumulates across sessions |

This satisfies the shadow-space ruling as written and still accumulates a fleet corpus — the
objection that killed worktrees-alone. Precedent: `/diagram` authors in-session and deposits to
`~/selfco/diagrams/`; that folder role clears D6 as an **artifact sink, not a work-item surface**,
and `~/selfco/teach/` inherits the same reading. **Do not re-litigate this.**

### What #382 still has to decide

1. **The deposit step — the load-bearing one.** A worktree is disposable by definition; if the
   deposit doesn't fire, the lesson dies with the worktree and the corpus never accumulates.
   Structurally identical to the TD-006 bead-closure gap (`hook-bead-session` declared, never
   implemented → 28 open hooks against 9 reports ever). Rule for a **hook or explicit skill step
   that emits evidence**, not a convention.
2. **Commit or not.** A workspace inside a real repo's worktree either gets committed (violates
   the standing out-of-scope ruling "lessons committed inside working trees") or never does — in
   which case the worktree is pure scratch and *everything* must survive the deposit. The latter
   is coherent (same disposition as the #386 prototype branch) but must be stated.
3. **Workspace naming + session binding** — how a workspace names itself and binds to its
   originating session/bead.
4. **Read path.** How future sessions *draw* from the corpus: index shape and lookup. Note
   **Obsidian renders Mermaid fences natively but will not render a standalone `.html` as a
   page** — a deposited lesson is an attachment opened in a browser, so a markdown index (the
   `wiki/index.md` pattern) is what makes the corpus browsable in-app.
5. **Vault folder role.** `teach/` needs a Folder-roles row in `~/selfco/CLAUDE.md` **mirrored**
   into `core/.claude/skills/vault/templates/vault-claude-md.md`, or a future `/vault init` drops
   it (ADR-0088). Sanctioned sinks today: `.handoff/` beads, `decisions/northstar/` roadmaps,
   GitHub issues, `~/selfco/wiki/log.md`, `~/selfco/tracking/*.jsonl`, `~/selfco/diagrams/`.
6. **Explicit D6 answer** (ADR-0097 row D6 rejected a fourth work-item surface) — state why
   `~/selfco/teach/` is a sink and not a surface.

---

## Ticket 2 — #384, can the merge-quiz heatmap place lessons?

### The premise changed — read this before grilling

The instrument has **never fired**. Verified 2026-08-03 against
`~/selfco/tracking/merge-observations.jsonl`:

| Event | Meaning | Records |
|---|---|---|
| `harness:merge-observed` | shadow observer — "a quiz *would* have fired here" | **89** |
| `harness:quiz-taken` | the real record, carrying `score`, `domain`, `taught`/`cold` | **0** |

Every one of the 89 has `quizzed: false`. **The EWMA comprehension heatmap has zero cells.**

So #384 is not "can the heatmap place lessons" in the abstract — **cold-start is the entire
current state, not an edge case**, and P5 was ratified naming this instrument as its primary
measure. Treat instrument validity as load-bearing: a ratified property resting on an instrument
that has never produced a data point is exactly what P1's measurement-first discipline exists to
prevent.

### What exists

`scripts/hooks/merge-quiz.mjs` → `~/selfco/tracking/merge-observations.jsonl`. EWMA alpha 0.4
over repo × domain cells; **taught/cold never merged**; worst-first report. `--record` needs
`--score=<0-100>`. Pocock's ZPD computation instead reads ADR-style learning records.

### What #384 has to decide

1. **Learning-record equivalent** — do teach sessions write records the sensor reads? *This is
   the shared seam with #382; #382's ruling on `learning-records/` shape is its input.* Note the
   mismatch to resolve: records deposited as markdown under `~/selfco/teach/<slug>/` are
   Obsidian-readable, but the sensor reads `~/selfco/tracking/*.jsonl`. Same signal, two shapes.
2. **Domain taxonomy** — are repo × domain cells the right grain?
3. **Cold start** — now the dominant case, not a corner. How does placement work with zero cells?
4. **Emit vs consume** — what merge-quiz emits against what teach needs.
5. **D22 boundary** — records+mission ZPD placement is the **per-workspace floor**; #384 owns
   whether the cross-workspace heatmap **augments or overrides** it.

### Explicitly NOT #384's

The comprehension-**GATE** question (should a low score block a merge) is parked in
`diagram-first-output` (#366) fog. Do not answer it here.

### If #384 rules cleanly

**#385 (Retention boundary ruling) unblocks** — update its row in the map's Tickets table.

---

## Constraints

- Branch from `origin/main`, never local main. Repo is **rebase-merge only**.
- Work in a disposable `git worktree add … origin/main`; the core checkout is dirty and owned by
  concurrent sessions.
- **Concurrent sessions move `main` mid-task** — #381 landed under the #386 session's feet and
  forced a rebase mid-PR. Re-fetch before assuming mergeability; expect to resolve a conflict in
  `## Decisions so far` (both sessions append there).
- `main` is checked out by another worktree, so `gh pr merge --delete-branch` fails its local
  post-merge checkout *after* the remote merge succeeds — verify via the API, don't rerun.
- **Movement-contract discipline:** never write northstar `current:` from a slice/ticket session.
  P5 movement goes via the registry's own PR path.
- Do not re-litigate: D18–D25, the shadow-space ruling, HTML-canonical, #386's self-containment
  finding, or the per-repo-worktrees + Obsidian ruling above.

## Gotchas

- **`packages/workflows/src/__tests__/maintenance-patrol.test.ts > orphanCheck` is flaky**
  (`ENOTEMPTY` on a temp dir; passed *and* failed on the identical SHA). Re-run rather than
  debug — a fix task is already spawned.
- **Unconfirmed: was `current: 5` operator-ratified?** PR #389 was explicitly human-gated ("do
  not merge without operator calibration of the numbers") and merged at 19:23:21Z under the
  shared `ojfbot` account with the proposal value intact. If a concurrent agent merged it rather
  than the operator, `current: 5` needs a correction PR. Ask before treating it as calibrated.
- Map file `decisions/wayfinder/teach-in-the-loop.md` is **canonical**; the GitHub issues are the
  projection. Fix the map by editing the file.
- Beads for this map are **local-only** (not committed to `origin/main`) — follow that pattern.
