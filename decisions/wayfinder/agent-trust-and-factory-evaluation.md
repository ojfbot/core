---
type: wayfinder-map
slug: agent-trust-and-factory-evaluation
northstar: l2-ojfbot
tracker_issue: "#661"
status: working
---

# Wayfinder — agent trust and factory evaluation

## Destination

Every question about agent trust and the fleet's own model tests is ruled: what each
service must guarantee, which service owns each guarantee, and whether any new service is
needed. The owner is taught each topic along the way, and an independent challenger tests
each design. The result hands off to the roadmaps as build slices. Serves
`ns:l2-ojfbot#P2` (every app's daily work traces to a measurable property).

Arrived does not mean built. No framework, policy engine, schema or topology is chosen in
this map; those belong to the build slices after handoff.

## Notes

### Origin and owner rulings, 2026-11-22

- Source: two Selfco captures of a ChatGPT discussion of the Pragmatic Engineer interview
  with Satya Nadella, "Software engineering after code becomes cheap"
  (<https://newsletter.pragmaticengineer.com/p/software-engineering-after-code-becomes>).
  Both say they are a synthesis, not a verified transcript; "What do the original sources
  actually say?" separates source-stated claims from our hypotheses.
- Owner rulings at charting: arrived = ruled requirements (not a working proof, not
  understanding alone); one map with two tracks (trust, and tests), because the tests must
  score task quality and rule-following separately; FleetRunner-only questions stay on the
  fleet-runner map (#307) as cross-linked tickets.
- The owner is not a security specialist and wants a systematic backstop: each trust ticket
  teaches its concepts through concrete HelpDesk and FleetRunner cases, and is challenged by
  whoever "Who is the independent challenger" names.
- Core is public. Tickets state questions only. Detailed threat-model findings and anything
  naming the home network stay in private notes.

### Boundaries with other maps

- fleet-runner map (#307): owns FleetRunner authority and promotion through "What
  authority the conductor holds" (#313), which also takes the question of what a worker may
  touch for one task (cross-linked 2026-11-22). Budget reservation was added there as
  "What budgets does the work register reserve against?" (#675).
- #505 owns the maintenance correspondence exchange schema. "How is the evidence chain
  recorded across services?" must not fork it.

### What already exists (facts gathered at charting)

- HelpDesk: session-signed posts under fixed names, role addresses, an append-only journal,
  and the rule that peer messages are data, never approval.
- FleetRunner: database-backed claims and leases, restore-generation fencing, a claim
  trigger and a restore hold (`packages/fleet-runner/recovery.md`); work register layer
  (ADR-0110).
- DailyLogger: a golden eval suite seeded only from documented real failures
  (`core/decisions/failure-taxonomy.md`).
- Review: two independent reviews per PR; two-axis review (ADR-0099); provenance convention
  (ADR-0065); session-provenance-hardening draft ADR; `/resume` evidence tiers.

### Reference layer read (design-time, read-only)

Selfco wiki: `synthesis/fleet-runner-design-contracts`,
`synthesis/fleet-assurance-correspondence-and-learning`,
`synthesis/nanoclaw-fleet-trust-and-queue-research`, `concepts/evaluation-driven-development`,
`concepts/epistemic-engine`, `concepts/agent-harness`. They inform ticket bodies; none is a
decision.

### Prior-art survey, 2026-11-22

At the owner's request two research sessions are surveying how others solve these questions
(arXiv, Hugging Face, Reddit, vendor and standards writing), one per track. Findings will be
filed under `decisions/research/` and linked from the tickets they inform.

## Decisions so far

- Trust words ruled. A session is one keyed chat. An actor is who really acts behind a
  session. A grant is checkable authority; peer messages and role addresses are never
  grants. A conductor may re-delegate only a strictly narrower part of its charter, and
  until that can be checked link by link it only assigns work existing grants cover. A
  role is an address only. Claims carry one of seven statuses (claimed, observed,
  inferred, verified by a named procedure, disputed, superseded, unknown). "Coordinator"
  is avoided. — Which shared trust words do we adopt? (#663, owner re-confirmed
  2026-11-22; CONTEXT.md diffs proposed in the ticket, not yet applied)
- Challenge rule. The opposite-vendor model, in a fresh context, refutes each design and
  sees raw records, not the designer's conclusions. Scripted attack scenarios run
  alongside it. Once per track a secret canary design checks the challenger. A design is
  rejected if its only evidence is an agent's own account. The owner rules trade-offs and
  accepted risk, but is never the sole judge of soundness. One outside human security
  review is required before trust rules guard anything live. Tickets closed before this
  rule (#663, #669, #672) get a backfill challenge pass (owner, 2026-11-22). — Who is the
  independent challenger, and what evidence persuades them? (#664, owner re-confirmed
  2026-11-22)
- Five factory measures, each counted per accepted change (a merged PR that closes an
  issue and is not reverted or hot-fixed within 7 days): accepted changes per week;
  spec-to-merge time; cost as CI minutes, Claude tokens and Codex tokens side by side,
  never converted to dollars; escaped defects, via a "Caused by #N" line on bugs; owner
  minutes as a labelled estimate. The board shows them. They only inform for 4 weeks;
  after that the fleet grows only if accepted changes rise while cost and defects do not,
  and the owner makes the call. — Which factory measures do we track? (#672, owner
  re-confirmed 2026-11-22)
- Private tests cover coding slices, PR review, coordination with honest status reports,
  and triage. Tasks come only from real fleet work, plus harder variants written from a
  real seed. The scored set stays private. Scoring is pass/fail against checks written
  before any run, 3 tries per task, with cost and time reported separately. Tasks, checks
  and budget are fixed and each run is labelled with model, harness and prompt version.
  There is a frozen long-term set plus numbered harder sets, the owner promotes tasks, and
  the sets are reviewed quarterly. — What do our own model tests measure? (#669, owner
  re-confirmed 2026-11-22)

## Tickets

### Trust track

| Ticket (title, refer-by-name) | Type | Blocked by | Status |
|-------------------------------|------|------------|--------|
| What do the original sources actually say? (#662) | research | — | open |
| Which shared trust words do we adopt? (#663) | grilling | — | closed |
| Who is the independent challenger, and what evidence persuades them? (#664) | grilling | — | closed |
| Which established permission patterns are worth evaluating? (#665) | research | Which shared trust words do we adopt? | open |
| What must each step of a HelpDesk session's life prove? (#666) | grilling | Which shared trust words do we adopt? | open |
| Where are agent permissions enforced: in each service or a tool gateway? (#667) | grilling | Which established permission patterns are worth evaluating?; What must each step of a HelpDesk session's life prove? | open |
| How is the evidence chain recorded across services? (#668) | grilling | Which shared trust words do we adopt?; What must each step of a HelpDesk session's life prove? | open |

### Tests track

| Ticket (title, refer-by-name) | Type | Blocked by | Status |
|-------------------------------|------|------------|--------|
| What do our own model tests measure? (#669) | grilling | — | closed |
| How are model, pipeline and rule-following scores kept apart? (#670) | grilling | What do our own model tests measure?; Which shared trust words do we adopt? | open |
| How do we keep AI graders honest? (#671) | research | What do our own model tests measure? | open |
| Which factory measures do we track? (#672) | grilling | — | closed |
| What does a guided, chaptered PR review contain? (#673) | grilling | How are model, pipeline and rule-following scores kept apart? | open |

### Closing

| Ticket (title, refer-by-name) | Type | Blocked by | Status |
|-------------------------------|------|------------|--------|
| Which service owns each guarantee, and do we need new services? (#674) | grilling | Where are agent permissions enforced; How is the evidence chain recorded; How are model, pipeline and rule-following scores kept apart? | open |

## Not yet specified

- Local versus cloud model routing by capability, latency, privacy and cost.
- Whether fixed rule engines should replace repeatedly generated reasoning anywhere.
- Whether a "swap the model" trial is needed before the scores can be ruled.
- What sensitive data can leave through model and tool calls (egress), beyond the privacy
  checks already tracked in LocalHelp.

## Out of scope

_Nothing ruled yet. Candidates offered to the owner on 2026-11-22, not yet ruled: many
humans and many agents (the notes' fourth stage); picking tools now; mobile and voice
teaching; exactly-once remote effects._
