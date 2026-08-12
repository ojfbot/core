---
id: 20260812-0300-brief-wayfinder-cca-prep-workbench
type: brief
title: "Spawn /wayfinder: cca-prep workbench dimension — templates, notebook, canvas"
actor: code-claude
to: code-claude
session_id: 2026-08-12T03:00:00-05:00
refs:
  - github:ojfbot/cca-prep#13
  - bead:20260811-1900-spec-cca-prep-repo
  - bead:20260811-2035-report-cca-prep-s1-shipped
  - file:../cca-prep/research/domains/finance-ir.md
  - file:../cca-prep/research/20260812-1400-handoff-source-intake-multi-exam.md
hook: github:ojfbot/cca-prep#13
status: live
labels:
  project: cca-prep
  initiative: workbench
---

## Context

`~/ojfbot/cca-prep` is a live multi-exam cert-drill engine (231 CCAR-F questions, port 8631,
zero npm dependencies — Node 24 built-ins, vanilla-JS client; CLAUDE.md hard rules include the
zero-dep runtime, per-exam scope walls, telemetry boundary, hashed privacy name gate). The
operator sits CCAR-F ~Aug 21–22 (Gate 0 of `~/selfco/wiki/synthesis/certification-ladder-fde.md`),
then CCDV-F and CCAR-P through October, all subordinate to landing an FDE job. The standing
worked-example domain is finance/IR (`research/domains/finance-ir.md` — archetypal repo-side,
specifics vault-side).

**The operator's ruling that spawns this map (2026-08-12, verbatim intent):** "no one writes
'cold' anymore and I worry I'd freeze without opinionated templates for Python and
TypeScript/Node apps (web-app UI or Express servers) — build something like Jupyter notebooks
and tldraw canvases into the cca-prep app." The pedagogy is sound: the exams test
configuration/architecture judgment, not blank-page recall, and FDE work is
template-plus-judgment. The existing "Lab 1" study item (structured extraction,
tasks 4.2–4.5) is currently framed as cold code writing — that framing is rejected.

## Goal

Run `/wayfinder` to chart the **workbench dimension** of cca-prep as a decision map at
`cca-prep/decisions/wayfinder/` with typed tickets and blocking edges. Plans, never builds —
this is fog-charting, one ticket per session afterward. The map covers, at minimum:

1. **Opinionated template packs** — Python and TS/Node starters in the two shapes the operator
   names (web-app UI, Express server), pre-wired with the exam-relevant idioms (tool_use JSON
   schema, validation-retry, stop_reason loop, structured MCP errors, Batches submit/poll).
   Key fact the map must weigh: **the fleet already has this** — core's `/scaffold-app`
   templates + `domain-knowledge/app-templates.md`. Reuse/symlink/derive vs repo-local copies
   is a decision ticket, not a foregone conclusion.
2. **Notebook-style executable scratch surface** — guided cells for lab exercises (prompt →
   code → run → observe), so a lab is filling in the judgment gaps of a working scaffold,
   never a blank file. Candidate mechanisms to research honestly: JupyterLite (static-served
   WASM — no server dependency, but heavyweight and Python-first), a minimal CodeMirror+
   sandboxed-eval cell strip, "run this template via node/uv in a terminal beside the app"
   (zero new deps, least magic), or plain HTML lesson pages with copy-run blocks (the
   `~/selfco/teach` lesson pattern that already exists).
3. **Canvas surface** — tldraw-class sketching for architecture-judgment practice (CCAR-P's
   item style) and FDE discovery diagrams (control-graph vs knowledge-graph sketches per the
   finance domain pack). Candidates: tldraw (React — collides with the zero-dep rule),
   Excalidraw embed, plain SVG scribble layer, or a **sidecar app** (separate port/process,
   drill engine untouched).

## The fog (why /wayfinder and not /plan-feature)

- **The zero-dependency rule is now genuinely contested.** The S1 spec priced this at
  p(revise)=0.15 "only at risk if UI ambitions outgrow vanilla JS" — this is that moment.
  Options that keep the rule (sidecar apps, JupyterLite as static assets, link-outs) vs
  options that revise it (React islands) deserve a real decision ticket with the operator,
  not a silent default.
- **Boundary question:** does executable-lab tooling belong inside cca-prep (study tool),
  in `~/ojfbot/newline-ai-course/labs/` (where labs already live), or as a fleet-level
  capability (core templates + a thin launcher in cca-prep)? Three plausible homes.
- **Smallest de-freezing slice:** what ships in ONE evening that makes Lab 1 template-anchored
  before the Aug 21–22 sit, vs what waits for post-Gate-0? (Candidate: a template pack + a
  runbook page, no notebook engine at all.)
- **Telemetry/artifact boundary:** lab outputs and sketches — vault-side, gitignored, or
  portfolio material? The canvas sketches especially (they may be FDE portfolio pieces).

## Constraints (non-negotiable, carried from the ladder and repo)

- **Absorber guard (ladder correction 3):** charting ≤1 session; no build slice may eat
  pre-sit study evenings; Texas R&R keeps weekend build slots. Sequence build tickets
  post-Gate-0 unless a slice is provably ≤1 evening AND de-freezes Lab 1 before the sit.
- Calibration decks, mock instruments, and the drill flow are untouchable from this
  initiative. The drill engine's zero-dep core stays intact even if a sidecar revises the
  rule for a new surface.
- Repo may go public: no personal names (hashed gate enforces), no licensed material,
  privacy walls as per publication-checklist.
- Finance-IR domain pack is the default skin for lab content (usage rules in the pack apply).
- pnpm never npm, branch+PR always, CI green before merge.

## Acceptance criteria (for the wayfinder session itself)

1. A file-canonical map at `cca-prep/decisions/wayfinder/workbench.md` (or skill-canonical
   name) with typed tickets (research / grilling / prototype / task), native blocking edges,
   and github:ojfbot/cca-prep#13 as the tracker hook.
2. The zero-dep revision question is an explicit grilling ticket routed to the operator.
3. A "smallest de-freezing slice" ticket exists and is sequenced relative to Gate 0
   (Aug 21–22) with the absorber guard stated.
4. Template-pack provenance ticket weighs fleet reuse (`scaffold-app`/`app-templates.md`)
   before proposing anything repo-local.
5. Map hands off to `/gated-slice` or `/plan-feature` per the core flow boundary rule
   (what/whether → wayfinder; how-to-ship-safely → gated-slice).

## Flag back (do not decide unilaterally)

- Any revision of the zero-dependency rule.
- Any build work scheduled before Gate 0 beyond the one-evening de-freezing slice.
- Where the workbench lives (cca-prep vs newline-ai-course vs fleet-level) if the map
  doesn't produce a clear winner — that's an operator call.

## Spawn command

In a fresh session at `~/ojfbot/cca-prep`:

```
/wayfinder chart the workbench dimension — read core/.handoff/20260812-0300-brief-wayfinder-cca-prep-workbench.md first; tracker hook github:ojfbot/cca-prep#13
```
