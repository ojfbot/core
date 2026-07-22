# ADR-0101: /wayfinder — file-canonical decision maps upstream of the roadmap spine
slug: wayfinder-decision-maps
serial: 0101
rev:
Date: 2026-07-22
Status: Accepted
domain: workflow-engine
type: tooling
OKR: —
Commands affected: /wayfinder (new), /grill-with-docs, /prototype, /gated-slice (boundary note), /frame-standup (chart-it trigger)
Repos affected: core (skill + decisions/wayfinder/); GH issues in the target repo
gate:
baseline:
traces:
  supersedes:
  amends:
  relates-to: [control-gated-slices, roadmap-under-northstar, three-tier-northstar, pocock-lifecycle-absorption]
  parent:
  part-of-series:

---

## Context

Work that is "too big for one agent session and wrapped in fog" has no home in the current spine.
The northstar names the destination properties; the roadmap decomposes a *known* route into
dispatchable slices; `/gated-slice` stages *decided* initiatives for safe shipping. All three assume
surveyed terrain. What's missing is the survey: the phase where the open questions are charted,
sequenced by dependency, and burned down one decision at a time. Today that happens ad hoc in grill
sessions and offsite documents, leaving no durable frontier and no provenance trail from "we decided
X" to the slices that assume X.

Upstream v1.1's `wayfinder` (verdict rows D11–D13 in `decisions/adopt-stack/pocock-skills-v1-1.md`)
is the strongest available pattern for this: a map with a named Destination, typed decision tickets
(research / grilling / prototype / task) linked by native blocking edges, a frontier (open +
unblocked + unclaimed), one-ticket-per-session, and a hard "plan, don't do" doctrine — done when
nothing is left to decide, at which point it hands off.

The structural affinity with the roadmap is real — both are one-session nodes on a dependency graph
with a ready-frontier — but the closure semantics differ: a roadmap slice is closed by a merged PR
and turns the odometer; a wayfinder ticket is closed by an answer and never touches `status.jsonl`.
Merging the two would break the movement contract and pollute the compiled queue with tickets that
can never state a `check:`. They must be two ledgers with an explicit interface.

## Decision

Ship `/wayfinder` in core, adapted from upstream as follows.

**Map is file-canonical, tracker-projected.** The map lives at `core/decisions/wayfinder/<slug>.md`
(sections: Destination / Notes / Decisions so far — an index, not a store / Not yet specified /
Out of scope). Tickets are GitHub child issues labelled `wayfinder:<type>` with the tracker's native
blocking relationships, so the frontier renders in the tracker UI. The file is canonical; issues are
the projection — same posture as roadmap files vs compiled beads.

**Optional `northstar:` anchor.** Map frontmatter may reference the northstar (`ns:<slug>`) and the
Destination may cite specific properties (`ns:<slug>#P<n>`), resolve-or-fail. A map charts the fog
in front of named properties; the link is lintable, not prose.

**Ticket types map to existing skills.** grilling → `/grill-with-docs` (its in-loop ADR staging
gives the Decisions-so-far index real `decisions/adr/` entries to point at); prototype →
`/prototype`; task → manual work; research → the **deep-research harness, serialized** — one cycle
at a time (sequential-research rule), findings filed to `decisions/research/`, never to throwaway
branches. Upstream's chart-time parallel research fan-out is explicitly rewritten to sequential.

**Placement ladder (the litmus, written into the SKILL.md):**
can you state `success` + a machine-runnable `check`? → roadmap slice. Can you state only the
question precisely? → wayfinder ticket. Can't state the question yet? → Not-yet-specified fog.
The graduation test for fog → ticket is whether the question can now be stated precisely.

**Handoff is a slice refinery.** When the frontier empties, the charted decisions are what make
`entrance`/`success`/`check` statable — so the terminal action is not a parked spec: spec via
`/plan-feature --from-conversation`, tickets via `/orchestrate --emit=github-issues`, and (when the
map is northstar-anchored) slices appended to that northstar's roadmap, entering the normal
`queued → ready → dispatched` lifecycle. For enforcement-bearing initiatives, hand to `/gated-slice`
instead. Boundary rule cross-referenced in both SKILL.mds: *what/whether → wayfinder; how to ship
safely in stages → gated-slice; once sliced → roadmap slices dispatched by day-run.*

**Kept from upstream verbatim:** one-ticket-per-session, claim-by-assignment, refer-by-name,
no-fog early exit (if the journey fits one session, skip the map), "plan, don't do."

**Standup trigger.** When `/frame-standup` can't assert a slice's entrance criterion, that is
unacknowledged fog — the move is "chart it," not "leave it queued."

## Consequences

### Gains
- Foggy initiatives get a durable frontier with provenance: every assumption a slice rests on
  traces to a closed ticket and, for grilling tickets, an ADR.
- The fourth rung completes the ladder: northstar (toward what) → wayfinder (what must be decided)
  → roadmap (by what deliveries) → dispatch (what runs today).
- Decision-closure and delivery-closure stay in separate ledgers; the odometer's anti-confabulation
  contract is untouched.

### Costs
- One more catalog entry (tier 2, planning) — accepted because no existing surface covers
  pre-decision charting; this is the one genuinely new capability in v1.1.
- Serialized research makes charting slower than upstream's parallel fan-out; the SKILL.md says so
  explicitly to stop agents from "helpfully" fanning out.
- Two-surface maintenance (file + issues) until a reconciler exists; mitigated by the same
  file-canonical discipline the roadmap already runs shadow-lint on.

### Neutral
- Maps are per-initiative and retire at handoff; the roadmap remains the standing ledger.
- Non-coding uses (course planning, ops) work unchanged — the map format is not code-specific.

## Alternatives considered

| Alternative | Why rejected |
|-------------|--------------|
| Host decision tickets as roadmap slices (one graph) | Breaks the movement contract (answers would move property %) and the `check:` queue discipline (decision tickets can never state one — permanent `human_only` demotions polluting the queue). |
| Tracker-only map body (upstream behavior) | Contradicts the file-canonical + projection pattern the northstar/roadmap spine standardized; map history should be reviewable in PRs like every other decision artifact. |
| Parallel research fan-out at chart time (upstream behavior) | Violates the sequential deep-research rule (2026-06-05 overnight batch failure: concurrency saturates the API and collapses the verify stage). |
| Extend `/gated-slice` with a "foggy mode" instead of a new skill | Conflates deciding with shipping; gated-slice's TPM/shadow/RIDM machinery presumes the destination is already decided. |
| Keep using ad-hoc grill sessions + offsite docs | Status quo: no frontier, no dependency ordering, decisions scattered across transcripts with no index. |

## Provenance

| Field | Value |
| --- | --- |
| Zero-point | 2026-07-22 (adopt-stack record `pocock-skills-v1-1.md`; wayfinder↔roadmap interface discussion) |
| Implementation start | 2026-07-22 (S6 branch) |
| Implementation end | _pending_ (S6 PR merge + first dogfood chart) |
