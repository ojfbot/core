---
type: brief
date: 2026-08-11
author: claude-code (session 21f1d7ae)
topic: "cca-prep — dedicated cert-prep engine repo (spec, /plan-feature output)"
status: open
supersedes-context: .handoff/20260811-1810-brief-cca-developer-professional-prep-tools.md (that brief's research steps fold into this repo's pipeline)
---

# Spec: `cca-prep` — a certification-prep engine that outlives its own question banks

## Problem statement

Static question banks decay on contact with this operator: the 81-question CCA-F bank was
effectively memorized within a day (30/30 mock via recognition), so any fixed deck measures
recall of the deck, not exam readiness. The durable asset is not content but a **generation
engine**: produce fresh, hard, decorrelated questions on demand; validate them independently;
retire items the telemetry says are exhausted; and adapt targeting to the operator's live weak
spots. The engine must span all three remaining certification levels (Architect–Foundations in
flight, Developer–Foundations, Architect–Professional), and honor the ojfbot core thesis — the
fleet as an operator-elevating teaching device — by feeding two loops beyond the exam:
`[project]`-tagged study insights become fleet work items, and distilled knowledge lands in the
selfco vault. Secondary goal, explicitly requested: **portfolio-grade** — clean enough to
document publicly via blogengine.

Ambiguities made explicit: (a) Developer/Professional exam guides may not be downloadable
pre-registration — the pipeline must run in "provisional blueprint" mode with unverified banks
clearly marked; (b) "adapting to my learning" is bounded here to task-statement-level targeting
and item retirement, not learner modeling beyond what the telemetry supports.

## Confirmed decisions (operator, 2026-08-11)

1. **Boundary (REVISED by operator 2026-08-11, second pass):** *everything functional and
   shareable lives in the repo* — engine, banks/decks, pipeline, skill, research digests,
   derived blueprint summaries, and open-source Anthropic curriculum material (per its own repo
   license). Only **personal telemetry** stays out: SQLite results, progress snapshots, and
   study notes remain in the selfco vault (unchanged writers). One guardrail for the portfolio
   (public) ambition: verbatim official exam-guide PDFs may sit in the repo **only while it is
   private**; the pre-publication checklist replaces them with `scripts/fetch-guides.sh`
   (canonical Skilljar URLs) + derived digests, because public-download ≠ redistribution
   license. Vault sources/synthesis pages continue as the cross-project knowledge layer.
2. **Scaffold:** scaffold-app *conventions* (repo hygiene, CI, fleet registration) **without
   Carbon**. UI is the existing zero-dependency vanilla stack restyled in the **GroupThink
   design language** (Lois-red accent, Inter + JetBrains Mono, weight-900 headlines,
   hover-nudge microinteractions — see memory `project_landing_groupthink_brief`); Morning
   Cockpit is the reference for local-first dashboard feel. Yes, this combination is possible
   and is the plan: template hygiene, bespoke skin, no React/Carbon runtime.
3. **Trigger:** skill-first (`/cca-prep`), with an explicit gated roadmap to a scheduled
   routine (below). Framed as a portfolio project; each stage is blogengine material.

## Proposed solution

**Repo `cca-prep`** (fleet-registered via /fleet-onboard; CI from shared github-actions @v1):

- **engine** — the drill server, migrated from `~/selfco/teach/cca-foundations-prep/app/`:
  multi-exam deck registry (`decks/<exam>/<deck>.json`), per-exam progress isolation in
  SQLite (gitignored), snapshot writer still targeting the vault
  (`~/selfco/teach/cca-prep/progress/<exam>.json`), notes mirror unchanged. Runtime stays
  Node 24 built-ins only (`node:http`, `node:sqlite`) — no build step, no node_modules.
- **pipeline** — deterministic scripts + agent briefs:
  - *generator briefs*: parameterized prompts for fresh-context authoring agents (exam, deck
    size, hard mode, weak-task bias, multi-response quota, decorrelation rule: never read
    existing decks);
  - *giveaway linter*: schema validity, longest-option-correct rate, answer-position
    distribution, option-count rules;
  - *blind-solve QA*: independent solver agent answers the candidate deck without the key;
    items below agreement threshold or flagged ambiguous are rejected back to authoring;
  - *item analysis*: from the answers log — items with high p-value after ≥N exposures are
    flagged `retired` and leave the drill pool (regeneration candidates).
- **profile** — the student-profile engine (elevated to first-class module, operator request
  2026-08-11): builds a longitudinal profile from the telemetry — per-task mastery over time,
  a **prediction ledger** (every predicted gap is a scoreable forecast, reconciled against
  observed misses per the fleet's Murphy-decomposition doctrine; seeded by
  `learning-records/0001-ccar-f-baseline.md`, which already scored 7 predictions and found the
  pattern *artifact-grounded predictions hold, doctrine-grounded ones over-predict mastery*),
  a **misconception taxonomy** from picked-distractor telemetry (which *wrong option* fools,
  not just which item), and a ZPD summary that becomes the bias input to `adapt`/`generate`.
  Profile artifacts are personal telemetry → written to the vault side of the boundary.
- **research** — methodology corpus (item-writing standards, synthetic-data QA practice,
  official docs digests) with a hard **no-braindump guardrail**: a denylist + a CLAUDE.md rule;
  the NDA and program policy make exam-dump material both prohibited and worthless.
- **skill `/cca-prep`** (lives in this repo, registered in core's catalog): modes
  `status` (readiness dashboard from snapshots) · `generate <exam> [--hard]` ·
  `qa <deck>` · `adapt` (emit weak-task generation brief from telemetry) ·
  `triage-notes` ([project] notes → beads/issues in the named repos) ·
  `research <topic>` · `ingest-guide <exam>` (vault-ingests a new official guide).
- **Vault interface:** all wiki writes go through /vault conventions; `triage-notes` writes
  beads, never edits other repos' code.

**Roadmap to routine (control-gated, RIDM-promoted):**
- **S1 (now):** skill modes manual; operator invokes per study session.
- **S2:** `adapt` output feeds `generate` automatically within one skill invocation
  (telemetry-adaptive generation). Gate to S3: ≥3 S2 cycles whose QA'd decks needed no manual
  question repairs.
- **S3 (shadow):** nightly scheduled routine runs `status` + freshness check and only *files a
  report bead* (never generates). Gate to S4: 2 weeks of shadow reports with zero false
  "stale" flags.
- **S4 (operational):** routine may auto-generate + QA a replacement deck and open a PR
  (never auto-merge). Each stage promotion is a blogengine article beat.

## Acceptance criteria

1. `node engine/server.mjs` serves ≥2 registered exams; answering a CCAR-F drill question
   changes no row in the CCD-F progress store (verified by row counts before/after).
2. `/cca-prep generate ccar-f --hard` yields a deck that passes the giveaway linter and a
   blind-solve QA run; a deliberately corrupted fixture deck (longest-option-correct on every
   item) fails the linter with a nonzero exit.
3. With a seeded fixture DB (item seen 3×, all correct), the item is flagged `retired` and no
   longer appears in 50 consecutive drill draws.
4. `/cca-prep adapt` names the operator's 3 weakest task statements, matching a hand computation
   from the same snapshot fixture.
5. `/cca-prep triage-notes` converts a `[project]`-tagged note into a bead file in the target
   repo's `.handoff/` quoting the note verbatim; non-tagged notes are untouched.
6. The repo contains no personal telemetry (no SQLite files, no progress snapshots, no
   study-notes) — boundary test script verifies; vault writes are limited to the snapshot/notes
   writers' target files. A `publication-checklist.md` exists and its PDF-swap item
   (verbatim guides → fetch script) blocks any public flip while unchecked.
7. UI serves Inter/JetBrains Mono from repo-local font files, uses the red-accent token set,
   and imports no Carbon/React (grep gate in CI).
8. `research` mode refuses a denylisted braindump domain with an explanatory message (fixture
   test), and the denylist is documented in CLAUDE.md.
9. Fleet registration: `/fleet-onboard reconcile` reports no missing surfaces for cca-prep.
10. Profile engine: given the answers fixture (with `picked` arrays) and a predictions fixture,
    the profile builder emits (a) a per-task mastery timeline, (b) a prediction-ledger table
    with per-prediction verdicts matching hand computation, and (c) a top-3 misconception list
    naming specific distractor texts — all written to the vault-side profile artifact.

## Test matrix

| Scenario | Input/state | Expected | Type |
|---|---|---|---|
| Deck isolation | answer posted to exam A | exam B rows unchanged | integration |
| Giveaway linter catches tells | corrupted fixture deck | nonzero exit, named violations | unit |
| Blind-solve QA gate | candidate deck + solver disagreement fixture | items rejected list | integration |
| Item retirement | 3× correct fixture | excluded from 50 draws | unit |
| Adapt brief | snapshot fixture | 3 weakest tasks named | unit |
| Note triage | notes fixture with 2 tagged / 1 untagged | 2 beads created, 1 skipped | integration |
| Repo boundary | full test run | no writes outside allowed vault paths | integration |
| Denylist | braindump URL arg | refusal + message | unit |

## Testing decisions (seams)

Two seams, both existing shapes: (1) the **HTTP API** of the engine (answer/state/note/mock —
already the app's public boundary); (2) the **pipeline script CLIs** (lint/QA/analyze run as
`node pipeline/<x>.mjs <fixture>` with exit codes). Skill modes are thin orchestrations over
these two seams and are exercised through them, not separately.

## Decisions, ordered by likelihood of revision

| p(revise) | Decision | Why it might change |
|-----------|----------|---------------------|
| 0.60 | QA thresholds (blind-solve agreement bar, retirement p-value ≥0.9 after ≥3 exposures) | Pure tuning knobs; first real data will move them |
| 0.60 | GroupThink-skin implementation details (tokens, type scale, microinteractions) | Aesthetics iterate on sight; the *direction* is fixed, the values aren't |
| 0.40 | Skill mode surface (names, arg shapes) | Modes tend to merge/split after a week of real use |
| 0.40 | Deck/data model (multi-exam registry + `retired` flag semantics) | Professional exam may have a different item format (case studies) that strains the schema |
| 0.20 | S1→S4 routine gating criteria | Doctrine-shaped and operator-approved, but gate numbers are guesses |
| 0.15 | Zero-dependency runtime | Only at risk if the UI ambitions outgrow vanilla JS |
| 0.10 | Vault knowledge boundary (snapshots/notes in selfco, engine in repo) | Explicitly confirmed today; breaking it breaks other sessions' readers |

> **Forecast score note (same-day):** the 0.10 boundary call WAS partially revised within hours
> (operator moved research assets/guides into the repo; only personal telemetry stays
> vault-side). Reliability datum for the Murphy decomposition: an overconfident low forecast on
> an operator-facing decision — exactly the class the ordering rule says to put on top, which
> is where it was, and review caught it. The telemetry-writer half of the decision survived.

## Open questions

1. Developer/Professional exam-guide availability pre-registration — if locked, ship
   provisional decks marked `unverified: true` and re-QA after the guide is obtained?
2. Mock scoring for Professional if its format isn't 60-MCQ (case-study items) — schema TBD
   after guide ingest.
3. Blogengine cadence: per-stage articles (S1 ship, S2 adaptive loop, S3 shadow, S4 routine)
   or one retrospective? (writing-pipeline decision, not blocking.)
4. Name lock: `cca-prep` (operator's term) vs `cert-prep` (generic). Proceeding with
   `cca-prep` unless renamed at scaffold time.
5. ~~Prerequisite chain~~ **RESOLVED (2026-08-11, official guides):** CCAR-P states "no
   mandatory prerequisites" — bookable directly. All three guides are in the vault
   (`raw/assets/cca-f-…`, `cca-professional-…`, `ccd-foundations-exam-guide-v1.pdf`) with
   source pages. Ladder facts: CCAR-P $175 / 63 items / 7 judgment-heavy domains / prompt
   caching IN scope (inverted vs -F); CCDV-F $125 / 53 items / Applications & Integration
   33.1% / streaming+caching in scope / LangGraph explicitly named — likely the operator's
   easiest sit. **Engine consequence: per-exam scope walls** — never mix cross-level material
   into an exam's calibration decks; cross-level "stretch" decks are a separate labeled surface.

## Current state at handoff (2026-08-11 end of day)

- Live app (`~/selfco/teach/cca-foundations-prep/app/`, port 8630): **141 questions** — 81 base
  v2 + batch-1 and batch-2 hard decks (H1–H60, weakness-biased, giveaway-linted); unseen-first
  sampler; notes capture → SQLite + `progress/study-notes.md`; **picked-distractor capture**
  live (misconception-level telemetry); `bank-stretch.json` merge pre-wired but not yet authored.
- Telemetry: 157+ answers; tutor-deck 91%, contaminated mock 30/30 (invalid), hard-deck
  first-attempt **77%** (23/30) — misses on tasks 1.4, 1.6, 2.1, 2.5, 3.4, 4.2, 4.3.
- `learning-records/0001-ccar-f-baseline.md` — the profile seed: scored 7-prediction ledger
  (meta-finding: artifact-grounded predictions held; doctrine-grounded over-predicted mastery).
- Batch-3 seed list (from the batch-2 author): structured mid-process handoff contents,
  prompt-chain authoring for known-steps pipelines, Bash-vs-built-in boundary, and the
  "looks-simple-but-hides-architectural-scope" reverse trap.
- Operator's -F plan: clear batch 2 first-attempt, Lab 1 (extraction pipeline: 4.2/4.3/4.4/4.5),
  mocks on decorrelated material, sit ~Sep 8; then CCDV-F and/or CCAR-P per ladder notes.

## ADR stub

**Title:** cca-prep: generation-over-content certification engine with vault knowledge boundary
**Status:** Proposed
**Context:** Static banks are exhausted by the operator within days; prep must span three exams;
fleet thesis requires study artifacts to feed operator elevation (project triage + vault
knowledge). Licensed exam material must stay out of git-published repos.
**Decision:** A dedicated zero-dependency engine repo generates, QA-gates, and retires questions
per exam; the selfco vault remains the sole knowledge/progress surface (snapshots, notes,
sources); automation matures S1→S4 behind control gates with PR-gated action at the top stage.
**Consequences:** (+) decks stay fresh and measurable; (+) the engine generalizes to any
credential; (+) portfolio-ready separation of engine (public-safe) from licensed content
(vault-private); (−) two-root product (repo + vault) requires the boundary test to hold;
(−) agent-authored decks carry authoring cost per regeneration cycle.
Save with: `/adr new "cca-prep generation-over-content certification engine"`

## Next command

`/scaffold` in a fresh session at `~/ojfbot` — seed from this spec: create the repo, migrate the
engine from the vault app (git history not needed — copy + attribution note), wire fleet
registration, then `/cca-prep status` as the first vertical slice.
