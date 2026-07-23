# ADR-0102: OJF-OPL — a git-native Object-Process Methodology profile as the fleet's inspectability layer

slug: opm-inspectability-layer
serial: 0102
rev:
Date: 2026-07-22
Status: Accepted
domain: observation
type: architecture
OKR:
Commands affected: /opm (new), /vault sync, /frame-standup, /recon
Repos affected: core, daily-logger, morning-cockpit, selfco
gate:
baseline:
traces:
  supersedes:
  amends:
  relates-to: [control-gated-slices, two-track-skill-telemetry, skill-action-instrumentation, ubiquitous-language-layer, lint-shadow-to-gate]
  parent:
  part-of-series:

---

## Context

The fleet's inner workings — which processes exist, what each consumes and produces, which are
human-gated and which are automated, what states artifacts move through — are documented only in
prose (CLAUDE.md files, architecture briefs, "Honest gaps" sections). Prose drifts silently: only
humans can check it, and nothing fails when it goes stale. Dashboards (morning-cockpit) and the
vault re-derive the same system facts independently, each with its own partial vocabulary.

Object-Process Methodology (Dov Dori; ISO/PAS 19450) models any system with a minimal ontology —
stateful **objects** and **processes** that create/consume/change them — in one diagram kind (OPD)
paired with a controlled-English twin, **OPL**, where every model fact is exactly one English
sentence. Research findings (selfco: `wiki/sources/opm-deep-research.md`): (1) LLMs generate and
parse OPL with plain in-context learning (Neuro-Conceptual AI, arXiv:2502.09658); (2) no
open-source textual OPM tooling exists, so a local profile conflicts with nothing; (3) OPM's
agent/instrument distinction formally captures the human-in-the-loop vs automation boundary that
OPAV gates and handoff-emission approval each re-derive ad hoc; (4) the MBSE literature warns that
modeling benefits are usually perceived rather than measured — adoption must be small and
falsifiable.

## Decision

Define **OJF-OPL**, a minimal profile of ISO 19450 OPL (sentence templates specified in
`domain-knowledge/opm-modeling.md`), and adopt the convention that a repo MAY carry an
`opm/system.opl` model of itself — one fact per line, LLM-authored, human-reviewed — with a
deterministic Mermaid rendering committed alongside as `opm/system.md`. A new `/opm` skill
(modes: `model` · `render` · `lint` · `query`) owns authoring, rendering, conformance-linting
(shadow/observe-only, per ADR `control-gated-slices`), and model-grounded Q&A. Consumers read the
committed artifacts; nothing executes the models.

## Consequences

### Gains
- One machine-checkable vocabulary for "how this repo works": greppable, diffable, reviewable in PRs.
- Drift becomes detectable: `/opm lint` cross-checks sentences' `[src: <path>]` anchors and named
  skills/scripts against the working tree; stale model lines surface instead of rotting.
- Human/automation boundary is explicit per process (agent vs instrument links) — a tuning surface:
  changing a `handles` line to a `requires` line *is* an autonomy decision, visible in a diff.
- Dashboards and the vault can consume the same artifact (morning-cockpit System Map pane draft ADR;
  `/vault sync` can quote OPL lines into repo entity pages).
- OPL is the notation LLMs handle best among modeling languages — skills can author and query
  models without new parsers beyond a ~line-level template grammar.

### Costs
- A new artifact class to keep honest; until the linter has teeth (post-shadow), models can lie.
- The profile is deliberately sub-ISO (no parametrics, no full state semantics) — quantitative
  constraints (budgets, SLOs) stay out of scope and live where they live today.
- One more convention for contributors to learn (mitigated: the model *is* readable English).

### Neutral
- Rendering targets Mermaid (GitHub/Obsidian native). JSON Canvas views can be derived later for
  the vault without changing the source format.
- OPCloud/OPCAT interchange is explicitly a non-goal.
- Relation to existing layers (added at review, 2026-07-22): the ojfbot↔OPM Rosetta table extends
  the ubiquitous-language layer (`adr:ubiquitous-language-layer`) — OPL names must agree with
  CONTEXT.md/GLOSSARY.md vocabulary, never fork it; and the lint's shadow→gate maturation follows
  the `adr:lint-shadow-to-gate` pattern (observe-only until RIDM promotion). Both now traced.

## Alternatives considered

| Alternative | Why rejected |
|-------------|--------------|
| SysML (v1/v2) | 9+ diagram types, XML/API interchange, measured LLM generation weakness (~62% F1); ecosystem weight far exceeds fleet needs |
| BPMN | Control-flow only; artifacts (beads, articles) are first-class stateful objects here, not data annotations |
| C4/Mermaid freehand (status quo) | Structure only — no consume/yield/require semantics, nothing lintable; this is the drift we have |
| OPCloud (hosted OPM) | Closed, un-gittable, un-scriptable; bets on a tool instead of the paper-stable notation |
| Do nothing | "Honest gaps" sections prove the prose layer already fails silently |

## Rollout (gated, per adr:control-gated-slices)

1. **S1 (this branch):** profile doc + `/opm` skill + core's own `opm/system.opl` seed model.
2. **S2 pilot:** daily-logger models its 4-phase pipeline (its ADR-0039 draft); `/opm lint` runs in
   CI observe-only; success TPM = ≥1 real drift caught or model judged accurate across 4 weeks.
   The pilot is registered per the improvement-loop contract (`adr:pocock-lifecycle-absorption`,
   accepted on an in-flight branch at time of writing): ledger = lint `--json` findings; check =
   `/opm lint`; schedule = the ADR-0039 observe-only CI step; slice = a roadmap entry carrying the
   4-week verdict date, closing keep/kill/revise either way.
3. **S3 surface:** morning-cockpit System Map pane (its ADR-0015 draft) renders committed models.
4. **RIDM promotion:** only after S2 data — lint may gate merges; `/vault sync` folds OPL into
   entity pages. Kill criterion: if S2 shows the model needs manual re-derivation every session,
   stop at documentation-only.

## Provenance

| Field | Value |
| --- | --- |
| Zero-point | 2026-07-22 deep-research session (remote) |
| Implementation start | 2026-07-22 (S1) |
| Implementation end | 2026-07-22 (merged to main) |
