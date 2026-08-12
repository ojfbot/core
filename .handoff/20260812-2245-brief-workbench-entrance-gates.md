---
id: 20260812-2245-brief-workbench-entrance-gates
type: brief
title: "cca-prep workbench: close the entrance gates before any executable-lab build"
actor: code-claude
to: code-claude
session_id: 2026-08-12T22:45:00-05:00
refs:
  - github:ojfbot/core#453
  - github:ojfbot/core#454
  - github:ojfbot/core#455
  - github:ojfbot/core#456
  - github:ojfbot/core#457
  - github:ojfbot/core#459
  - github:ojfbot/core#460
  - github:ojfbot/core#372
  - file:decisions/wayfinder/cca-prep-workbench.md
  - bead:20260812-0300-brief-wayfinder-cca-prep-workbench
hook: github:ojfbot/core#453
status: live
created_at: 2026-08-12T22:45:00-05:00
labels:
  project: cca-prep
  initiative: workbench
---

## Context

The operator wants **executable code-writing / code-completion learning environments inside the
cca-prep drill UI** — pydantic-style typed-scaffold exercises, Jupyter-style guided cells, and a
tldraw-style sketch surface — so a lab means filling judgment gaps in a running scaffold instead
of facing a blank file.

That objective is already charted. `decisions/wayfinder/cca-prep-workbench.md` (merged, umbrella
#453) holds 8 typed tickets with native blocking edges. **Every one of the three surfaces the
operator named is downstream of an unresolved decision ticket** — none of them can be built yet:

| Surface named | Gated by |
|---|---|
| pydantic-style typed scaffolds | #455 home → #458 template provenance |
| Jupyter-style executable cells | #456 zero-dep ruling + #457 survey → #459 lab-surface selection |
| tldraw-style canvas | #460 consumption seam, itself blocked by **#372 (still OPEN, unassigned)** |

Wayfinder is plan-not-build: a work session resolves **exactly one** ticket and writes no
production code. So this brief is not "build the workbench" — it is "close the entrance gates,
one per session, until the frontier for the lab surface is empty."

**Read the map file first; it is canonical.** GitHub issues are its projection — where they
disagree, the file wins.

## Goal

Run the workbench frontier down in the order below, **one ticket per session**, until #459
(Lab-surface selection) is closed. At that point the executable-lab dimension is fully decided
and hands off to `/plan-feature` → `/orchestrate` (or `/gated-slice` if the chosen mechanism
carries an enforcement control). Do not start #459 before its two blockers close.

### Pre-flight — verify before claiming anything

1. `git -C ~/ojfbot/core pull` — the map merged 2026-08-12; make sure you have it.
2. Confirm map ↔ tracker agreement: every ticket's `Status` column in the map matches the
   issue's state. **#454 was auto-closed in error on 2026-08-12 and reopened** — if it reads
   CLOSED again with no `## Resolution` and no line in `## Decisions so far`, that is drift,
   not a decision. Reopen and say so.
3. Confirm #372's state. **If #372 is still open, #460 is not workable** — do not force it, do
   not re-chart canvas mechanism here (that belongs to the `diagram-first-output` map, #366).
4. Claim your one ticket by assigning yourself **before** any work. Claim = assignment.

### Session order

| # | Ticket | Type | Why this order |
|---|---|---|---|
| 1 | #457 Executable-lab surface survey | research (AFK) | Longest pole, needs no operator time, and #459 cannot close without it. Run it first and alone — the sequential-research rule forbids parallel cycles. |
| 2 | #455 Workbench home | grilling (HITL) | Unblocks #458 and #461. See the flag-back — do **not** treat this brief's phrasing as the answer. |
| 3 | #456 Zero-dependency rule | grilling (HITL) | The load-bearing one: every candidate mechanism (Jupyter/WASM, CodeMirror+eval, React canvas) collides with cca-prep's zero-dep rule. |
| 4 | #459 Lab-surface selection | grilling (HITL) | Only workable once #456 and #457 are closed. |

#458 and #461 unblock after #455 and can be taken whenever; they are not on the path to #459.

## Acceptance criteria

- [ ] Pre-flight ran; map ↔ tracker drift found is reported, not silently fixed past.
- [ ] **Exactly one** ticket claimed and resolved per session — never two.
- [ ] Resolution is written in three places: the issue's `## Resolution`, a one-line gist under
      the map's `## Decisions so far`, and the ticket's row in the `## Tickets` table.
- [ ] Map file updated on a branch with a PR (file is canonical; the issue is the projection).
- [ ] Blocked tickets that the resolution unblocks are named explicitly at close.
- [ ] **Zero production code written.** No engine changes, no template files, no lab scaffolds.
- [ ] Where `/grill-with-docs` staged an ADR, it is linked from the `## Decisions so far` line.
- [ ] Any fog that became statable is graduated into a new ticket; anything ruled beyond the
      Destination is moved to `## Out of scope` with who ruled it and when.

## References

- `file:decisions/wayfinder/cca-prep-workbench.md` — the map (canonical)
- `github:ojfbot/core#453` — umbrella · `#454`–`#461` — tickets
- `github:ojfbot/core#372` — Canvas playground spike (external gate on #460)
- `github:ojfbot/core#366` — `diagram-first-output` map; owns canvas **mechanism**, not this map
- `github:ojfbot/core#379` — `teach-in-the-loop`; owns lesson pedagogy + the HTML-lesson format.
  Its 2026-08-04 ruling that lesson quizzes are **zero-JavaScript** (side-panel snapshots never
  run scripts) is a hard constraint on any "executable cells in a teach lesson" option — carry
  it into #457, do not rediscover it.
- `bead:20260812-0300-brief-wayfinder-cca-prep-workbench` — the charting brief
- `file:research/20260812-1900-roadmap-v2-post-rfi.md` (in cca-prep) — Gate-0 sequencing
- `github:ojfbot/core#463` — per-repo wayfinder libraries; separate decision, do not fold in

## Flag back

- **The home ruling is the operator's.** This brief says "inside the cca-prep learning UI"
  because that is how the operator phrased the request — that is *not* #455 resolved. The live
  options remain cca-prep / newline-ai-course / fleet-level, and newline-ai-course already has a
  working JupyterLab (`jupyter-basics/sandbox.ipynb` + pinned `requirements.txt`) while cca-prep
  has zero Python. Put the options to the operator; do not infer the answer from the prompt.
- **Any revision of the zero-dependency rule** (#456). Note before grilling: the *stated* rule
  (CLAUDE.md: "Zero npm dependencies — Node 24 built-ins only") is wider than the *enforced* one
  (`scripts/ui-gate.sh` greps only `engine/` and `scripts/`), so a sidecar in a new directory
  passes the gate today. That gap is itself part of the decision.
- **Any build work scheduled before Gate 0** beyond #454's one-evening slice.
- **Do not work #460 while #372 is open**, and never re-decide canvas mechanism here.
- If a session finds itself wanting to close a second ticket, stop and flag instead.

## Constraints

- **Absorber guard.** Gate 0 (CCA-F) is **data-gated, not date-gated** — two consecutive valid
  timed mocks ≥ ~800, and there are zero valid mocks today. Operator direction is "all three
  passes ASAP". These four sessions compete with drill evenings, and the actual certification
  critical path right now is **authoring the M2 mock instrument** (cca-prep has one instrument,
  M1; the booking rule needs two distinct valid ones). If the operator has limited evenings,
  M2 outranks this map.
- cca-prep calibration decks, mock instruments, and the drill flow are untouchable. The drill
  engine's zero-dep core stays intact even if #456 revises the rule for a new surface.
- **core is public.** Map and ticket bodies stay archetypal — no named individuals or firms.
- **Both repos are rebase-only now** (merge commits and squash are disabled). Long-lived
  branches that repeatedly merge main will fail `--rebase` on the append-only deviations ledger;
  keep branches short, or expect to squash.
- **Never write `close:`, `closes`, `fixes`, or `resolves` adjacent to an issue reference in a
  PR body or commit message unless you mean it.** PR #462's body said "Frontier at close: #454"
  and GitHub auto-closed #454 on merge — in a charting session whose invariant is that it closes
  zero tickets.
- pnpm never npm. Branch + PR always. CI green before merge.
- Log plan-vs-territory gaps under `## Deviations` in the repo's `implementation-notes.md` and
  keep going.

## Time-box

One ticket per session, no exceptions. If a ticket cannot be resolved in its session, write what
was learned into the ticket body and leave it open and unclaimed — do not roll into the next.
