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

### Owner addendum: conductor tiers, 2026-11-22

The owner ruled, before further HelpDesk and conductor work, that a conductor is a type
with tiers. There may be a conductor for a whole machine, one for a whole project and one
for a specific repo. A conductor can be assigned baskets of tasks and reports to its own
parent conductor. This must be built into the fleet's graph and node shapes now. Tracked as
"How do conductor tiers nest, and what does each tier own?" (#682). Rulings that name "the
conductor" (#663, #666) will be re-checked against it. #679, #680 and #668 hold any part
that depends on it.

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
  2026-11-22; CONTEXT.md diffs proposed in the ticket, not yet applied. REVISED 2026-11-22
  after the Codex challenge rejected it on 6 findings, owner re-confirmed. Session
  identity is the name plus the registration a post was signed under. A grant must trace
  to an owner yes given where only the owner controls, otherwise it is a claimed grant.
  An approval is one decision with its own identity; single use is per decision.
  Re-delegations reserve from the parent's budget. "Role" is always qualified and no
  role carries authority. "Verified" names its check and covers only what it tested.
  Bugs: core#677, daily-logger#593, LocalHelp#124)
- Challenge rule. The opposite-vendor model, in a fresh context, refutes each design and
  sees raw records, not the designer's conclusions. Scripted attack scenarios run
  alongside it. Once per track a secret canary design checks the challenger. A design is
  rejected if its only evidence is an agent's own account. The owner rules trade-offs and
  accepted risk, but is never the sole judge of soundness. One outside human security
  review is required before trust rules guard anything live. Tickets closed before this
  rule (#663, #669, #672) get a backfill challenge pass (owner, 2026-11-22). — Who is the
  independent challenger, and what evidence persuades them? (#664, owner re-confirmed
  2026-11-22. Amended 2026-11-22: after two challenge rounds, remaining findings become
  build-slice checks, except a high finding that the decision is wrong, which goes to the owner)
- Five factory measures, each counted per accepted change (a merged PR that closes an
  issue and is not reverted or hot-fixed within 7 days): accepted changes per week;
  spec-to-merge time; cost as CI minutes, Claude tokens and Codex tokens side by side,
  never converted to dollars; escaped defects, via a "Caused by #N" line on bugs; owner
  minutes as a labelled estimate. The board shows them. They only inform for 4 weeks;
  after that the fleet grows only if accepted changes rise while cost and defects do not,
  and the owner makes the call. — Which factory measures do we track? (#672, owner
  re-confirmed 2026-11-22; amended by #670: growth also requires no open critical
  violation)
- Three scores, never added together: model (harness fixed), pipeline (the #672
  measures) and rule-following. A test card shows "passed" and "passed clean", and
  decisions use passed clean only. Six critical violations gate: out-of-scope write,
  secret or private leak, acting without a grant (including obeying injected text),
  skipping a hold or approval, an unbacked status claim, and tampering with tests. Only
  machine checks written beforehand gate; AI-judge flags go to the owner until #671
  trusts a judge. Planted traps score rule-following only. A gap in the action record
  counts as unknown, never clean. Attempts count against the model and let-through
  against the pipeline. Credit comes only from the matching test, with one change per
  window. A live critical violation alerts the owner and blocks growth. — How are model,
  pipeline and rule-following scores kept apart? (#670, owner confirmed in the conductor
  chat 2026-11-22)
- HelpDesk session trust. The charter is a record the owner signs with their phone
  passkey, naming the conductor by session name and key with ordered standbys. The
  conductor job moves only three ways: the owner; a signed handover to a listed standby;
  or the first standby after HelpDesk's registry shows a 12-hour lapse (6-hour warning,
  takeover alert). A key reclaim ends authority, and an old conductor stays replaced.
  Listeners and wakes act only on signed TASKs from each Mac's own list. When records
  disagree, only risky actions stop. A stop counts only with proof; "can't tell" goes to
  the owner as one BLOCKER. The Mac is the read boundary. Threat detail is kept in a
  private note. — What must each step of a HelpDesk session's life prove? (#666, owner
  confirmed in the conductor chat 2026-11-22)
- Permission patterns shortlist (research, nothing chosen): attenuating capability tokens,
  a policy engine inside each service, a checkpoint outside the agent (gateway or
  reference monitor), OAuth 2.1 with MCP authorization and token exchange, and client-side
  rules on the Mac. Ruled out for now: SPIFFE/SPIRE, RBAC roles, a standalone just-in-time
  broker. No stateless pattern enforces a budget shared across children; a service must
  hold the counter. Findings: `decisions/research/permission-patterns-665.md`. — Which
  established permission patterns are worth evaluating? (#665)
- Guided PR review adds to the two reviews and never replaces them. It is one top screen
  plus 7 fixed chapters. A program writes the facts and the evidence, a fresh session
  explains, and unlinked sentences are deleted. High risk comes from fixed areas plus each
  repo's invariant list; a model may only raise it, and a repo with no list counts as high
  risk. A high-risk PR needs a taught /merge-quiz with one retake, then an owner "merge
  anyway" note. — What does a guided, chaptered PR review contain? (#673, owner confirmed
  2026-11-22)
- A stop blocks new work at once and stops running work. Queued effects are cancelled
  where possible. Each item is proven stopped by a fence, or by the writer proven gone
  plus read-backs now and after 6 minutes. Anything else is "can't tell" and goes in one
  BLOCKER. Chats' GitHub work needs a revocable per-Mac credential. — Which in-flight work
  can be proven stopped? (#678, owner confirmed 2026-11-22)
- GitHub identity. Each Mac gets its own GitHub App with no settings or secrets power,
  and Claude and Codex are pinned to it, so agent work is traced apart from the owner.
  Pinning is setup, not a lock. The owner's gh login stays in their terminal. An
  owner-name GitHub approval never counts as a yes. Agents merge after the owner's chat
  yes. Phone taps cover settings changes and go-live. The terminal login has no settings
  power, and any settings change alerts the phone. — How are owner actions told apart
  from agent actions on GitHub? (#681, owner confirmed 2026-11-22)
- Source check: the model-swap "acid test" and agents as insider risk are stated by
  Nadella. "Intelligence sovereignty" was not found. The software-factory loop, maturity
  stages, score splits and insider types are our interpretation, as are Linear's
  "chapters" and "perspectives" ("sections" is Linear's word). — What do the original
  sources actually say? (#662)
- Conductor tiers. Conductors live in one tree of seats. Each seat's scope (Macs, repos,
  actions, basket) fits inside its parent's, and labels are open. The owner names the
  long-lived seats in one passkey charter. Those may name one level of child seats, signed
  by the parent holder, with standbys listed by that holder. Seat levels and work hops are
  counted separately. A basket is a work-register record, and a task sits in at most one.
  The register is the report: BLOCKERs go up seat by seat, and the parent seat referees
  clashes. — How do conductor tiers nest, and what does each tier own? (#682, owner
  confirmed 2026-11-22)
- Re-delegation. Child-seat records and work grants are HelpDesk records signed by the
  parent's holder. Each names its parent by fingerprint, its scope, expiry, set-aside runs
  and hops left. Any work grant may pass on while hops remain; the checker recounts. The
  budget counts runs only. A child seat lasts at most 14 days and a work grant at most 3.
  Ending a record ends everything below it. — What does a checkable re-delegation record
  contain? (#680, owner confirmed 2026-11-22)
- Owner record. The owner's passkey signs signing keys (the first added at the NAS), the
  charter of top seats, one-time approvals (24 hours, spent once) and revocations (lost or
  stolen). Each Mac re-checks every record itself. There is one 90-day check-up, and a
  second key kept at home. — What does a passkey-signed owner record contain? (#679, owner
  confirmed 2026-11-22)
- Evidence chain. Each service keeps its own journal. Links name the record they came from
  by ID and digest, and a read-only linker rebuilds chains. The service that acted writes
  "observed", and an agent's account is "claimed". A chain is as strong as its weakest
  link. Hook logs hold identifiers only, are copied to a private NAS store and kept
  forever; adding that store to the backup is a separate reviewed change. Journals are
  hash-chained and witness each other hourly. — How is the evidence chain recorded across
  services? (#668, owner confirmed 2026-11-22)
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
| What do the original sources actually say? (#662) | research | — | closed |
| Which shared trust words do we adopt? (#663) | grilling | — | closed (revised twice; stop rule applies) |
| Who is the independent challenger, and what evidence persuades them? (#664) | grilling | — | closed |
| Which established permission patterns are worth evaluating? (#665) | research | Which shared trust words do we adopt? | closed |
| What must each step of a HelpDesk session's life prove? (#666) | grilling | Which shared trust words do we adopt? | closed (revised; second challenge queued) |
| Which in-flight work can be proven stopped? (#678) | grilling | — | closed (challenge queued) |
| What does a passkey-signed owner record contain, and how is it checked? (#679) | grilling | — | closed (challenge queued) |
| What does a checkable re-delegation record contain? (#680) | grilling | — | closed (challenge queued) |
| How are owner actions told apart from agent actions on GitHub? (#681) | grilling | — | closed (challenge queued) |
| Should an owner-only GitHub account own the repos through an organization? (#684) | grilling | — | open (later) |
| How do unregistered and native sessions join the evidence chain? (#685) | grilling | — | open |
| Can a session's key be protected from other programs on the same Mac? (#686) | research | — | open |
| How do conductor tiers nest, and what does each tier own? (#682) | grilling | — | closed (challenge queued) |
| Where are agent permissions enforced: in each service or a tool gateway? (#667) | grilling | Which established permission patterns are worth evaluating?; What must each step of a HelpDesk session's life prove? | open |
| How is the evidence chain recorded across services? (#668) | grilling | Which shared trust words do we adopt?; What must each step of a HelpDesk session's life prove? | closed (challenge queued) |
### Tests track

| Ticket (title, refer-by-name) | Type | Blocked by | Status |
|-------------------------------|------|------------|--------|
| What do our own model tests measure? (#669) | grilling | — | closed (accepted after 2 challenges; findings are build checks) |
| How are model, pipeline and rule-following scores kept apart? (#670) | grilling | What do our own model tests measure?; Which shared trust words do we adopt? | closed (revised; second challenge queued) |
| How do we keep AI graders honest? (#671) | research | What do our own model tests measure? | open |
| Which factory measures do we track? (#672) | grilling | — | closed (accepted after 2 challenges; findings are build checks) |
| What does a guided, chaptered PR review contain? (#673) | grilling | How are model, pipeline and rule-following scores kept apart? | closed (challenge queued) |

### Closing

| Ticket (title, refer-by-name) | Type | Blocked by | Status |
|-------------------------------|------|------------|--------|
| Which service owns each guarantee, and do we need new services? (#674) | grilling | Where are agent permissions enforced; How is the evidence chain recorded; How are model, pipeline and rule-following scores kept apart? | open |

## Not yet specified

- Exactly-once remote effects (offered for out of scope on 2026-11-22; the owner kept it open).
- Separate macOS users per agent, so keys stop sharing one Mac-wide wall (from #666).
- How a wake brief declares its audience (from the #666 revision).
- Local versus cloud model routing by capability, latency, privacy and cost.
- Whether fixed rule engines should replace repeatedly generated reasoning anywhere.
- Whether a "swap the model" trial is needed before the scores can be ruled.
- What sensitive data can leave through model and tool calls (egress), beyond the privacy
  checks already tracked in LocalHelp.

Settled from this list: what happens if the owner loses their phone, by a second signing key kept at home (#679).

## Out of scope

- Many humans and many agents: the notes' fourth stage, with several people, their own
  identities and onboarding (owner, 2026-11-22).
- Picking tools inside this map: policy engine, signing scheme, database. These belong to the
  build slices after handoff (owner, 2026-11-22).
- Mobile and voice teaching of reviews (owner, 2026-11-22).
