# ADR: Roadmap under northstar — file-canonical delivery decomposition with a compiled dispatch projection
slug: roadmap-under-northstar
serial: draft
rev:
Date: 2026-07-02
Status: Proposed
domain: workflow-engine
type: convention
OKR: 2026-Q3 / O-legibility / KR-delivery-pipeline
Commands affected: /day-run (new), /frame-standup (Step 4.6 roadmap load + Step 7b compile), /gated-slice (method feeds roadmap authoring), /adr (relationship)
Repos affected: core (decisions/northstar/roadmap-schema.md + roadmap-template.md + registry, scripts/roadmap-lint.mjs, scripts/roadmap-compile.mjs, scripts/lib/northstar-fm); any app with a roadmap (<app>/.claude/roadmap.md); morning-cockpit (Delivery pane reads it)
gate:
baseline:
traces:
  supersedes:
  amends:
  relates-to: [three-tier-northstar, stable-identity-and-facet-tags, control-gated-slices, dispatch-queue-and-day-runner, progressive-autonomy-gates]
  parent:
  part-of-series:

---

## Context

The three-tier northstar (adr:three-tier-northstar) gave every app a compass — properties with an
honest `current` % and a target — but deliberately said nothing about *how* a gap closes. Between
the compass and the day there was nothing durable: `/gated-slice` produces a plan as chat output,
`/frame-standup` ranks a day, `/orchestrate` executes prompts — none of them leave an artifact that
decomposes a property gap into a sequence of deliveries another session (or a runner, or the
cockpit) can read. Symptomatically, `status.jsonl` — designed a week before this ADR — had never
received a single movement line: there was no artifact whose lifecycle would produce one.

TeamBot (the reference architecture this pattern is grafted from) proved the missing shape: a day
decomposed into session-sized briefs, each leaving a PR at a slice boundary, integration gated on
self-report plus verification. What TeamBot kept in daily prompt files, ojfbot needs as a durable,
lintable artifact with ADR-0087 identity, because the fleet is many apps and the consumers are
programs (compiler, runner, cockpit) as well as humans.

## Decision

Introduce the **roadmap**, a file-canonical markdown artifact, one per northstar
(`<app>/.claude/roadmap.md` beside the L1; `core/decisions/northstar/roadmap-<slug>.md` for
L2/L3), registered in the `roadmaps:` list of the northstar registry. Canonical schema:
`decisions/northstar/roadmap-schema.md` (v1).

- **Shape.** A roadmap declares ordered **phases**, each grouping **slices**. A slice is exactly
  one agentic session's work: stable id (`rm:<slug>#S<n>`, ADR-0087 identity applied to a third
  artifact class), `advances: ns:<slug>#P<n>` (resolve-or-fail + must point into the roadmap's own
  northstar), flattened expected movement (`moves_from`/`moves_to`), a named `deliverable`, prose
  `entrance`/`success` gates, a merge-gate tier (`autonomy: gate-0|1|2`,
  adr:progressive-autonomy-gates), and a delivery lifecycle
  (`queued → ready → dispatched → delivered → merged`, or `dropped`).
- **Files are canonical; beads are a projection.** `roadmap-compile.mjs` deterministically and
  idempotently posts `ready` slices (deps `merged`) onto the unassigned queue as
  `queue=available` beads via the sanctioned `bead-emit.mjs queue-post` verb, keyed by
  `labels.roadmap_ref`. Humans edit files; the compiler reconciles; nobody hand-edits projected
  beads. The cockpit's Available lane and Claim verb consume them unchanged.
- **`queued → ready` is human judgment.** Entrance criteria are prose; a person (typically during
  `/frame-standup`) flips readiness. The compiler never adjudicates prose.
- **Movement is proposed by the session, recorded at merge.** The slice's PR carries a
  `Movement proposal:` line; `record-movement.mjs` appends `status.jsonl` only from a MERGED PR
  and refuses anything else. A session never writes `status.jsonl`. (OPAV / provenance discipline
  applied to the vision layer.)
- **Lint ships shadow-only** (`roadmap-lint.mjs`, ADR-0089 discipline): resolve-or-fail refs,
  enum/range validity, duplicate ids as ERRORs; `moves_from` drift vs the property's live
  `current` (ready/dispatched slices only) and not-merged dependencies as WARNs.

## Consequences

### Gains
- The northstar→day gap has a durable middle: every dispatched piece of work traces
  slice → property → tier, and the expected movement is declared before the work runs.
- Consumers are mechanical: compiler, day-runner, cockpit Delivery pane, and standup all read the
  same file + registry, no new identity machinery (`slug` + `#S<n>` + resolve-on-disk reused).
- `status.jsonl` finally has a producer: the merge ritual of roadmap slices.

### Costs
- Another artifact to maintain per northstar, and the discipline to keep slice `status:` honest
  (mitigated: compile `--reconcile` reports file-vs-queue drift; lint warns on stale plans).
- Flattened frontmatter (no nesting) means `expected_movement`/`gate` become scalar pairs —
  a parser constraint accepted to stay dependency-free.

### Neutral
- One roadmap per northstar in v1; multiple concurrent roadmaps per northstar deferred until a
  real leg needs it (same evidence-gated posture as cluster-tier/semver refs).
- First registered roadmap: `rm-l1-morning-cockpit` (the dogfood — its PH2 delivers this very
  pipeline's first compiled dispatch and first runner-delivered slice).
