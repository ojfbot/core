---
type: wayfinder-map
slug: cca-prep-workbench
northstar: l1-cca-prep
tracker_issue: "#453"
status: charting
---

# Wayfinder — cca-prep workbench

## Destination

Labs and FDE-practice work in cca-prep start from opinionated scaffolds, never blank pages.
Opinionated template packs exist for Python and TS/Node in the two shapes the operator named
(web-app UI, Express server), pre-wired with the exam-relevant idioms (tool_use JSON schema,
validation-retry, stop_reason loop, structured MCP errors, Batches submit/poll), and an
executable lab surface turns a lab like Lab 1 (structured extraction) into filling the judgment
gaps of a working scaffold. The operator's ruling that spawned this map (2026-08-12): "no one
writes 'cold' anymore" — the exams test configuration/architecture judgment, not blank-page
recall, and FDE work is template-plus-judgment. Arrived = Lab-class exercises are
template-anchored end-to-end and every open workbench question below is decided. Serves
`ns:l1-cca-prep#P2` (operator certified across the Claude ladder — the workbench is study
leverage) and `ns:l1-cca-prep#P1` (template packs double as generation-pipeline authoring
leverage); both ladder to `ns:l2-ojfbot#P1`. Untouchable from this initiative: calibration decks,
mock instruments, and the drill flow. **Amended 2026-08-14 by the zero-dependency ruling (#456):**
"the drill engine's zero-dep core" was listed here as untouchable and no longer is — the rule it
named has been retired. The decks, the mocks, and the drill flow stay untouchable; the engine's
dependency posture does not.

## Notes

- Charted 2026-08-12. Mode: **full** (registry resolves, 21 entries at the charting worktree).
  Anchors `ns:l1-cca-prep#P1..P3` verified resolve-or-fail at charting. Brief:
  `.handoff/20260812-0300-brief-wayfinder-cca-prep-workbench.md`; repo-side signpost
  ojfbot/cca-prep#13.
- **Vantage lesson recorded:** the charting session first saw `l1-cca-prep` as unregistered —
  the local core checkout was on a stale feature branch; origin/main (cdab19b) has the
  registration. The planned "register l1-cca-prep" task ticket dissolved before projection.
  Same class as the registry's documented registered-but-absent artifacts.
- **Template inventory (fact, charting):** core's `domain-knowledge/app-templates.md` has
  exactly three templates — `langgraph-app` (React + Carbon: collides with cca-prep's
  `ui-gate.sh` if placed in-repo), `browser-extension`, `python-scraper` (the only Python
  shape). None match the brief's "Express server" / plain "web-app UI" shapes; none pre-wire
  the exam idioms. "New fleet-level templates" is therefore a live option alongside
  reuse-vs-copy, weighed in Template-pack provenance (#458).
- **Lab-path fact (charting):** `newline-ai-course/labs/cca/`, referenced by cca-prep's study
  plan (`decks/ccar-f/plan.html`), does not exist on disk; newline-ai-course does carry
  `jupyter-basics/sandbox.ipynb` and a full Jupyter requirements.txt (Jupyter already runs
  per-machine) — inputs to Workbench home (#455) and the survey (#457).
- **Adjacent-map boundaries:** canvas mechanism selection is owned by `diagram-first-output`
  (#366; research #368, prototype spike #372) — this map only rules the consumption seam
  (#460). Lesson pedagogy, ZPD placement, and the HTML-lesson format are owned by
  `teach-in-the-loop` (#379); outcome capture by `teach-persistence` (#412). This map decides
  none of those.
- **Projection note:** tickets project here (core) per the operator's ruling — labels and
  cross-map edges live here, and the one-library invariant holds — even though the initiative's
  repo (cca-prep) is private and core is public. The underlying tension (per-repo wayfinder
  ownership, hierarchically composed into core) is captured as a standalone fleet-level
  decision item, deliberately outside this map to avoid context drift.
- **Constraints standing for every ticket** (brief + ladder correction 3): absorber guard —
  no build slice eats pre-sit study evenings, weekend build slots stay with the field
  engagement; sequencing is data-gated against Gate 0 (two valid timed mocks ≥ ~800), operator
  direction "all three passes ASAP"; repo may go public — archetypal names only (hashed gate),
  no licensed material; finance-IR domain pack is the default lab skin
  (`cca-prep/research/domains/finance-ir.md`, usage rules apply); pnpm never npm; branch+PR
  always; CI green before merge.
- **Reference layer (vault, read-only, design-time):** `wiki/synthesis/certification-ladder-fde`
  — the gate schedule, the "certs are screening, the meta-artifact is the portfolio" thesis,
  and correction 3 (the absorber risk aims at the field engagement, not just study time);
  `wiki/synthesis/cca-x-finance-domain` — the finance-IR worked-example layer whose repo twin
  is the archetypal skin (specifics stay vault-side). Neither treats execution surfaces; that
  gap is this map's contribution.

## Decisions so far

Pre-map rulings (operator, 2026-08-12, charting session — recorded here, not closed tickets):

- Canvas = boundary ticket only; mechanism selection stays with diagram-first-output (#366) —
  Yuri, 2026-08-12
- Gate-0 sequencing is data-gated (no fixed date); ladder direction "all three passes ASAP";
  the divergent date references on disk are techdebt, filed repo-side — Yuri, 2026-08-12
- Map slug `cca-prep-workbench` ("workbench" alone collides with the tmux workbench
  skill/doc) — Yuri, 2026-08-12
- Projection to core with cca-prep#13 left open as the repo-side signpost; per-repo wayfinder
  composition captured as a separate fleet-level decision item — Yuri, 2026-08-12

Closed tickets:

- Five lab-surface mechanisms surveyed on evidence; **no winner named** — that is #459's call.
  The cycle killed one premise outright (the Batches API is CORS-blocked from every origin
  tested, so no in-browser mechanism can teach it against the live API) and established that
  both official SDKs honour a `base_url` override, putting key-free offline labs within reach of
  the stack cca-prep already has. It also surfaced two host costs the charting brief did not
  carry: `engine/server.mjs` has no generic static-file handler, and **nothing in CI enforces
  the zero-dependency rule** — it is prose in CLAUDE.md, which reshapes what #456 is even
  ruling on — Executable-lab surface survey (#457) →
  `decisions/research/2026-08-13-executable-lab-surface-survey.md`
- **The zero-dependency rule is retired**; cca-prep adopts the standard fleet app stack (pnpm
  workspace, committed lockfile, dependency audit on, TypeScript, React + Vite permitted),
  mirroring Morning Cockpit's `packages/renderer`. **Carbon stays rejected — that was always the
  objection, never React** — so spec lines 43–47 stand with their "no React/Carbon runtime" clause
  narrowed to "no Carbon", and the GroupThink design language is unchanged. Two sequenced halves:
  managed dependencies first and alone (it is what opens #459), TypeScript and React/Vite after.
  The argument that carried it was not size but scanning: `security-scan.yml` sets
  `skip-dependency-audit: true` *because* no lockfile exists, so the old rule bought the absence
  of auditing rather than the absence of risk. Two grill-time corrections are load-bearing for
  anyone re-reading the survey: cca-prep **already had a tracked dependency-free `package.json`**
  (so survey finding 50 mis-located the cost), and the migration surface is **10 files / 1,183 LOC**
  (the 12 `scripts/hooks/*.mjs` are git-mode-120000 symlinks into core, not cca-prep's to migrate).
  Spec line 59 is amended on both halves; `scripts/ui-gate.sh` must be rewritten Carbon-only or it
  fails CI on the first React file — Zero-dependency rule: sidecar vs revise (#456)

## Tickets

| Ticket (title, refer-by-name) | Type | Blocked by | Status |
|-------------------------------|------|------------|--------|
| Smallest de-freezing slice for Lab 1 (#454) | grilling | — | open |
| Workbench home: cca-prep vs newline-ai-course vs fleet-level (#455) | grilling | — | open |
| Zero-dependency rule: sidecar vs revise (#456) | grilling | — | closed |
| Executable-lab surface survey (#457) | research | — | closed |
| Template-pack provenance (durable): fleet scaffolding vs repo-local (#458) | grilling | Workbench home | open |
| Lab-surface selection (#459) | grilling | Zero-dependency rule; Executable-lab surface survey | open |
| Canvas consumption seam (cca-prep × Diagram Playground) (#460) | grilling | Canvas playground spike (#372, diagram-first-output map) | open |
| Lab artifact & telemetry boundary (#461) | grilling | Workbench home | open |

Frontier at charting close: #454, #455, #456, #457.

**Frontier now (2026-08-14, after the zero-dependency ruling landed): #454, #455, #459.**
Lab-surface selection is
unblocked — both its blockers are closed. Survey questions 4 and 13 were consumed by the
zero-dependency ruling and carry into #459 as settled constraints, not open inputs; the survey's
"survives the zero-dep rule?" column is now moot, while its weight, offline-story, and
language-coverage columns stand. Questions 1, 3, 7, 8, 9, 11, 12 and 15 remain live #459 inputs.

**Tickets the ruling reshapes** (flagged, not re-opened): Workbench home (#455) — a pnpm-workspace
cca-prep changes what "lives in cca-prep" costs relative to newline-ai-course or fleet-level;
Template-pack provenance (#458) — `langgraph-app`'s React + Carbon stack no longer collides with
cca-prep on React, only on Carbon, so the reuse-vs-copy-vs-new-template weighing shifts.

## Not yet specified

- **Whether the drill client retains an exam-eve runtime guarantee once it is a Vite build
  artifact** — and if so, whether built output is committed or built on demand. New fog created by
  the zero-dependency ruling (#456), which permitted React and therefore reinstated a client build
  step. The question is statable but was not #456's to answer: #456 ruled dependency *policy*, and
  this is drill-client *architecture*. Graduates to a ticket if the client migration is sequenced
  before the sitting; stays fog if it lands after.
- CCAR-P case-study item format and what it implies for the lab surface (schema TBD after the
  Professional guide ingest — S1 spec open question 2 owns the guide side; the workbench side
  can't state its question until the item format is known).
- Whether lab telemetry feeds the P3 profile engine (mastery timelines / prediction ledger) or
  stays outside it — statable only after Lab artifact & telemetry boundary closes.
- FDE-portfolio packaging of lab artifacts (which artifacts, which genre per the 6-genre
  ruler) — downstream of the artifact-boundary ruling.

## Out of scope

- Canvas mechanism selection (tldraw vs Excalidraw vs SVG vs sidecar) — owned by
  diagram-first-output (#366); ruled by Yuri, 2026-08-12.
- Lesson pedagogy, ZPD placement, HTML-lesson format — owned by teach-in-the-loop (#379);
  boundary carried from that map's charting, reaffirmed here 2026-08-12.
- Drill engine, calibration decks, mock instruments, drill flow — untouchable per the brief's
  constraints (operator, 2026-08-12 brief).
- The tmux multi-repo workbench (`domain-knowledge/workbench-architecture.md`) — name
  collision only, no relation; noted at charting 2026-08-12.
- Per-repo wayfinder map libraries composed into core — fleet-level architecture question,
  captured as a standalone decision item outside this map; ruled out of this Destination by
  Yuri, 2026-08-12.
