---
type: wayfinder-map
slug: control-plane-conductor
northstar: l2-ojfbot
tracker_issue: "#307"
status: working
---

# Wayfinder — fleet-runner

## Destination

Fleet-runner makes authorized development work progress while the operator's Mac sleeps,
with one execution authority, Codex and Claude workers, controlled publication, durable
review evidence and recovery. It also inherits the conductor's obligation to know which
loops exist, whether they fired, what they produced, whether the outputs were consumed,
and where loops overlap or contradict. Each finding needs a traceable disposition.
These are delivery obligations, not capabilities established by this map.

The operator directed fleet-runner to supersede the earlier conductor initiative on
2026-10-01. Core owns the dedicated component, intended at `packages/fleet-runner`, with
an independent deployment, per [adr:fleet-runner-in-core](../adr/0108-fleet-runner-in-core.md).
Keep #307 as the tracker and retain this map's stable slug/path. Do not run a parallel
conductor program or create replacement tickets for its unanswered questions.

The first governed pilot is one low-risk work order through admission, qualified execution,
local artifact, controlled publication, exact-state review, human merge and original-work
settlement. Human review may wait; useful coding and publication must progress during
sleep. Full loop oversight remains a subsequent obligation, not a claim of that first pilot.

Serves `ns:l2-ojfbot#P2`. Runtime delivery must reconcile the existing L2 roadmap and S25
before dispatch. This decision map registers no delivery slices or movement values.

## Notes

### Skill observation extension, 2026-10-02

The operator confirmed that skill observation covers all Claude and Codex sessions,
including those fleet-runner did not launch, with fleet-runner owning reconciliation
and reporting. Preserve OPAV evidence validation and distinguish acceptance, loading,
application, decline, ignored, and unknown. Telemetry must not become a session gate.

The [bounded investigation](../../docs/fleet-runner-skill-telemetry-investigation-2026-10-02.md)
reproduced a Codex skill load being recorded as ignored because its session had no
corroborating tool ledger. It also found incompatible report cohorts and sticky negative
projections. The [extension design](../fleet-runner/skill-observation.md) and
[proposed ADR](../adr/draft-fleet-runner-skill-observation.md) specify provider capture,
independent skill runs, coverage, revisable projections, and shared report contracts.

This develops the inherited #315/#310/#311/#316/#317/#318 obligations without closing them
or creating another initiative. Detailed contracts and implementation slices remain
proposed. Reconcile existing skill roadmaps before dispatch; the first governed execution
pilot's acceptance criteria do not expand through this note.

The operator subsequently required PR and issue comments alongside telemetry storage and
directed application of the structured-correspondence lessons. The
[correspondence profile](../fleet-runner/skill-observation-correspondence.md) separates
observations, claims, heuristic interpretations, assessments, dispositions, and publication
receipts. It requires confirmed remote delivery, correction lineage, and positive/mutation
tests for each rule. PR #495 merged on October 3 as narrowed Proposed documentation;
the profile reconciles its changed D labels without ratifying its governance contract or
equating an informational reporting comment with an operative work order.

The October 3 [fleet rollout extension](../fleet-runner/skill-observation-rollout.md)
adds the verified daily-logger clean-checkout failure and inventory-derived qualification
waves inside the existing delivery handoff. It supplies bounded evidence to #315/#317;
it neither completes the full loop census nor authorizes fixes, experiments or publication.
Authorized non-fleet/projectless sessions remain in the observation goal.

### Maintenance and decision review through existing tools, 2026-10-08

The operator requires a morning workflow that clears required maintenance, clearly scoped
infrastructure work and pending decisions before focused feature work. This is a use case
of fleet-runner under #307, using the existing fleet plan and tools. Do not add a parallel
maintenance runner, action queue, decision registry, dashboard or scheduled review loop.

The operator selected **spoken approval before execution initially**. Complexity and risk
inform the review gate; when the agent advises source review, require the operator to review
the actual GitHub change before accepting that review gate. Human merge remains required.
This records the requested interaction and authority boundary, not its runtime enforcement.

| Existing responsibility | Integration requirement |
| --- | --- |
| Daily-logger suggestions and cleaner PRs | Read `api/actions.json` and `api/done-actions.json` with their source revisions and stable action IDs; verify the referenced repo, issue or PR. Reuse existing cleaner and review outputs. A suggestion is input, not an executable grant. |
| `/frame-standup` intake and the shared bead queue | Reconcile suggestions against existing beads, roadmap slices and resolved work before offering them. Expand only the selected item. Preserve source-to-work links; repeated preparation or voice re-entry must not create duplicate work. |
| Pending decisions in issues and ADRs | Resolve daily-logger narrative decisions to the existing pending decision ticket or ADR. Article `decisions[]` reports decisions; it does not establish that a decision awaits approval. Keep decision review separate from implementation admission. |
| `/day-run`, `roadmap-compile.mjs` and `bead-emit.mjs` | Preserve ready-slice admission, claim eligibility, leases and the supported writer. The current runner selects agent-eligible beads with a `roadmap_ref`; approving an arbitrary suggestion does not make it dispatchable. Route selected work through its scoped plan and operative grant before dispatch. |
| Morning-cockpit Available lane, `/api/claim` and GitHub review | Voice, cockpit and GitHub refer to the same work and review state. The cockpit currently delegates claims to core; a claim or button click does not prove a revision-bound execution grant or source review. Add the missing approval integration through the execution authority, not direct queue writes. |
| Existing loop registry and operating-mode decision | Census the actual blog, cleaner, review and dispatch rails before selecting the preparation cadence. Reuse those rails where their contracts fit; voice is another entry point, not a new scheduler. S25 remains the existing operating-mode decision venue. |

The intended interaction is: check the current queue; discuss one verified item with its
evidence, scope, complexity, risk and recommended next step; record approval, deferral,
decline or a request for investigation; dispatch only admitted work; return its result to
the same item. Feature work does not enter this maintenance workflow merely because a
daily-logger suggestion mentions it. Unclear scope goes to decision review or investigation.

Bind spoken approval to the named item, proposed scope and reviewed source revision through
the human-authority mechanism decided in #313 and the operative correspondence contract.
Generic assent, silence, an agent-authored transcript or a shared-account GitHub comment
cannot substitute for that mechanism. Record the assessment and why source review is or
is not required. Unknown complexity or risk must remain visible; thresholds, budgets and
promotion criteria still need decisions, rather than a guessed numeric policy here.

When source review is required, link the GitHub diff and its head/base, show that requirement
in voice and cockpit, and retain it until the operator's attributable review of that revision
is recorded. Approval to execute does not satisfy it. A changed scope or diff requires
reassessment and any renewed approval the operative policy requires. Do not convert one
spoken approval into standing agent eligibility or automatic merge authority.

Completion returns verified delivery and the disposition to the original item and its
source action. Discussed, approved, claimed, PR-opened, reviewed and completed are distinct
facts; a narrated briefing or PR creation alone does not drain the action. Deferrals and
declines retain their reason and any revisit condition; do not label them completed work.
If publication or disposition is uncertain, retain the outstanding item and apply Q1's
hold rather than retrying into duplicate work or asserting closure.

| Existing ticket | Required evidence for this use case |
| --- | --- |
| #315 census; #317 overlap | Trace actual suggestion, cleaner/review, standup, queue and dispatch producers/consumers; identify duplicates and gaps before adding or retiring rails. |
| #313 authority | Demonstrate item/scope/revision-bound human approval, complexity/risk escalation, source-review enforcement and revocation without blanket autonomy. |
| #316 consumption | Read back the original action's attributable disposition and resulting delivery; prove that approving or opening a PR cannot manufacture completion. |
| #311 portability; #309 reach | Define a voice adapter to the same authority and state, preserving identities and review gates when entry points change; qualify phone access separately from Mac-sleep execution. |
| #318 supervision | Independently detect stale preparation, missing dispositions and unconsumed review requests; preserve the stop path and recursive-trigger guard. |

OpenAI documents voice through Codex on iOS with a paired, available desktop host in
[ChatGPT Voice](https://learn.chatgpt.com/docs/features/voice) and
[remote connections](https://learn.chatgpt.com/docs/remote-connections), inspected 2026-10-08.
This supports an initial phone entry point, not evidence of this integration on the
operator's account. CarPlay tool/approval access remains unverified and needs its own
capability check. Neither phone access nor a local automation proves useful Mac-sleep work.

Before implementation, reconcile S25 and register bounded deliveries in the existing L2
roadmap after their entrance decisions are resolved. Preserve #307's inherited dependencies,
Q1, unresolved recovery/authorization policy and the proposed status of #495's contract.
This amendment starts no runtime, changes no live queue or schedule, closes no ticket and
adds no new delivery status or movement claim.

### Current decision and evidence limits

Repository placement, initiative succession and Q1's first-pilot affected-item hold are
accepted. The hold blocks reassignment and conflicting publication while earlier authorized
writes remain unknown; unrelated independent work continues. The authorization point,
reconciliation and reopening authority, runtime, store, host, trusted grants, recovery,
exact-state delivery/review, confinement and source revision policies remain open.
See [adr:fleet-runner-publication-hold](../adr/0109-fleet-runner-publication-hold.md).
The correspondence dependency is
[core PR #495](https://github.com/ojfbot/core/pull/495); estate ownership remains
[core #279](https://github.com/ojfbot/core/issues/279).

This map was recovered from commit `887983af32035fda2e5f774ce3607862850b91a4`
on the historical conductor branch; it was absent from main `5b43c97`. The sections below
retain the historical findings, with current scope and transfer rules stated explicitly.
No live census or runtime verification was performed for this succession record.

### Historical charting evidence, 2026-08-01

The counts and implementation observations in this subsection are historical evidence,
not a refreshed inventory. References to "the conductor" name the predecessor initiative.


Charted 2026-08-01. Re-charted the same day: the first pass fixed the Destination on *rail policy*
(how the registry describes a routine), after an option set that never named a conductor. The
operator corrected it — rail policy is a sub-problem; the conductor is the initiative. Surviving
tickets are marked below. The portability constraint was added by the operator mid-charting and is
now a standing constraint on every ticket.

**The operator affirmed all four sprawl failure modes as having real instances ("it's a mess"):**

1. **Loops die silently.** The selfco pair froze 53 days; `day-run` ran nowhere for a month;
   `weekly-measure` sits on the manual rail. `loops-liveness.mjs` detects this but is report-only
   and nothing reads its report on a cadence.
2. **Nobody can see the whole.** 32 declared loops across core / daily-logger / selfco /
   screenshot-organizer / mrplug, plus whatever is undeclared. Discovery means reading the registry.
3. **Outputs pile up unread.** Measurement snapshots, lint reports, defect sweeps, vault
   suggestions — produced faithfully, consumed by nobody. This is the cycle-1 "loops decide what
   happens next" gap, still open: convergent as *program*, absent as *runtime*.
4. **Loops overlap and contradict.** Six documents describe the retired selfco Notion path as live;
   telemetry ledgers carry competing definitions; harnesses measure overlapping things differently.

**Facts gathered during charting:**

- `loops-liveness.mjs` already does the *tracking* half — reads `cadence:` + `evidence_ref:`,
  verdicts OK · STALE · DOWN · UNVERIFIABLE · EXCLUDED, exits 0 always. A conductor that only
  tracks is a re-skin of a script that exists; its justification has to be the part that doesn't.
  This is why the authority question is charted rather than assumed.
- `loops-lint.mjs` defines `TRIGGERS = ['launchd','gh-actions','hook','watchpath','manual']` — no
  routine value. An authoring attempt already fell back to `trigger: hook`
  (`implementation-notes.md`).
- Rails today: 6 launchd · 6 gh-actions · 14 hook · 1 watchpath · 5 manual. 26 live, 6 disabled.
- Vantage tension: routines fire ephemeral cloud containers; Dolt (`127.0.0.1:3307`), `~/selfco`,
  and `~/.claude/*.jsonl` are local. A conductor that must read all three cannot be purely
  cloud-side today — a portability finding as much as a placement one.
- Doctrine that constrains any answer here: ADR-0086 (shadow-first, RIDM promotion), gate-0
  (humans merge), and the standing rule that a measurement never blocks.

**Staged input (2026-08-01):** [draft-bead-substrate-stability.md at historical commit `887983a`](https://github.com/ojfbot/core/blob/887983af32035fda2e5f774ce3607862850b91a4/decisions/adr/draft-bead-substrate-stability.md), absent from this branch. It recorded audited
assumptions + gated slices for the bead data layer (durability, loud emissions, committed
digests, substrate RIDM). Its DS2 feeds #318, DS4/DS5 feed #309. Charted as *input to*
tickets, resolving none of them.

**The risk this map must not walk into:** the conductor becomes loop #33 — watching 32 others, with
no verifier of its own, producing one more artifact nobody reads. *Who watches the conductor* exists
to make that a decision rather than a discovery.

## Decisions so far

*(index only — the decision lives in its ticket/ADR)*

- Repository placement: dedicated component in core, independently deployed; initiative
  succession: fleet-runner supersedes conductor, operator decision 2026-10-01.
  See [adr:fleet-runner-in-core](../adr/0108-fleet-runner-in-core.md).
- No inherited decision ticket has been resolved by this re-charting.
- Q1's first-pilot policy: hold reassignment and conflicting publication for the affected
  item until outstanding effects are reconciled; unrelated independent work continues.
  Operator decision 2026-10-01, [adr:fleet-runner-publication-hold](../adr/0109-fleet-runner-publication-hold.md).
  Authorization/reopening mechanics and Q3 recovery remain open; no runtime proof is claimed.

## Tickets

| Ticket (title, refer-by-name) | Type | Blocked by | Status |
|-------------------------------|------|------------|--------|
| Census the control plane (#315) | task | — | open |
| What a scheduled-agent primitive gives you, generic vs vendor-specific (#308) | research | — | open |
| The portability seam and how the registry names a swappable trigger (#311) | grilling | What a scheduled-agent primitive gives you | open |
| Where the conductor runs and what it must reach (#309) | grilling | The portability seam | open |
| What authority the conductor holds (#313) | grilling | Census the control plane; What a scheduled-agent primitive gives you | open |
| What "consumed" means for a loop's output (#316) | grilling | Census the control plane | open |
| Report or consolidate: overlap and contradiction (#317) | grilling | Census the control plane | open |
| Who watches the conductor, and when is it retired (#318) | grilling | What authority the conductor holds | open |
| What evidence a fired routine leaves behind (#310) | prototype | Where the conductor runs | open |

**Frontier:** *Census the control plane* and *What a scheduled-agent primitive gives you* — both
open, unblocked, unclaimed. One ticket per session; take the census first for the higher leverage.

### Carry-forward into fleet-runner

Ticket titles above preserve their GitHub identities. Apply the successor scope below when
working them; old Claude-Routines-only or observe-only framing is historical.

| Existing ticket | Successor obligation and closure evidence |
| --- | --- |
| #315 | Census declared and undeclared loops with actual firing, output and consumption evidence. Distinguish dead, stale, healthy-empty and unverifiable; report denominators and vantage. Fix nothing during the census. |
| #308 | Research the scheduled-agent capabilities needed by a provider-neutral runner. Separate generic execution/trigger behavior from vendor-specific features; retain primary-source evidence and operating constraints. |
| #311 | Define replaceable trigger/worker interfaces and stable identities; prove a trigger swap preserves work and evidence. Reconcile the original committed-history requirement with durable runtime storage and recoverable, vendor-independent evidence. |
| #309 | Decide hosting and minimum required reach, including useful work during Mac sleep and qualified Codex/Claude workers. Private local data does not become remotely accessible merely because execution moves. |
| #310 | Run an authorized, bounded evidence probe distinguishing ran-empty, failed, skipped and never-fired. Retain durable receipts independent of vendor UI; stop and remove the probe after recording evidence. |
| #313 | Set observe/report, retry and supervision authority explicitly, with grants, budgets, stop conditions and promotion evidence. Inheriting the remit grants no new write authority. |
| #316 | Define observable consumption/disposition. A generated report or presumed human read does not prove an output was used. Preserve consumer, referenced output, action and unresolved cases. |
| #317 | Define overlap/contradiction and route findings to a named disposition. Keep factual detection separate from human adjudication; consolidation or retirement needs authorization. |
| #318 | Define an independent verifier, kill path, recursive-trigger protection and usefulness/retirement criteria. Verify the runner's own outputs are consumed; avoid self-grading. |

Portability remains required. Contracts, inventory and decisions remain committed in core.
The original rule that all conductor knowledge be reconstructible from git requires an
explicit storage/recovery disposition in #311/#318 before runtime acceptance. No essential
history may silently become vendor-only. The design must state which facts are reconstructed
from git, durable state and exported evidence, and prove recovery under the accepted policy.

> **Blocking edges are declared here and in each issue body, not natively in the tracker.** This
> environment's GitHub MCP surface has issue and sub-issue writes but no issue-dependency write. All
> tickets are sub-issues of #307 with `## Blocked by` in their bodies. Wire native edges in the UI
> if tracker-side frontier rendering is wanted. Logged in `implementation-notes.md`.

## Not yet specified

In-scope fog — belongs to the Destination, question not yet statable precisely:

- **What the conductor's surface actually is.** Cockpit pane, committed report, standup input,
  issues/beads, or several. Not askable until *What authority the conductor holds* and *What
  "consumed" means* settle what it emits and to whom.
- **Whether selfco is conducted by the same loop or a federated peer.** selfco has its own vault
  semantics, its own disabled rails, and a different write posture. One conductor across both vs a
  conductor per domain sharing a schema is a real fork — but which is right depends on the census's
  overlap findings.
- **Cadence and spend for the conductor itself.** Depends on authority: a see-and-surface conductor
  is cheap and can run often; a supervisor must be rarer and better gated.
- **Whether any existing loop retires into the conductor.** Several may already be doing a fragment
  of this job (`loops-liveness`, `defects-lint`, `weekly-measure`, `audit-delivery-check`).
  Consolidation candidates are a census output, not chartable ahead of it.
- **The exit runbook.** The portability seam's *test* is chartable now; the actual "here is how you
  re-point this at cron / systemd / Actions / Temporal / n8n" document is a deliverable that follows
  the decisions, not a decision.

## Out of scope

- Runtime operation, existing-runner cutover and live queue changes from this record.
  The operator's 2026-10-01 succession decision changes initiative ownership, not deployment authority.
- Automatic acceptance or completion of S25. Its older operating-mode/PR criterion remains
  narrower than fleet-runner's governed-delivery contract and must be reconciled before dispatch.
- Autonomous merge or blanket retry/consolidation authority. #313/#317 retain those boundaries.
- Automatic conversion of session lifecycle hooks to schedules. Preserve event semantics
  unless a separate reviewed change establishes an equivalent contract.
- A general rail-selection rule (#312) and wholesale launchd migration (#314) remain
  deferred, as ruled on 2026-08-01. Supersession does not reopen them or make working plists debt.
- Implementing census, contracts, supervision or runtime code in a wayfinder session.
  Deliveries require statable success/checks and registered slices before dispatch.

### Historical boundaries replaced by the successor

The predecessor was built around Claude Routines and excluded dispatch replacement.
Fleet-runner has a broader development-execution destination with Codex and Claude support.
The operator superseded those initiative boundaries on 2026-10-01. The earlier cycle-5
rejection of a particular migration is not a blanket approval to replace the current queue.
Keep its valid constraints until a reviewed implementation decision explicitly reconciles them.

## Next handoff

For skill observation, use the [delivery handoff](../fleet-runner/skill-observation-delivery.md).
It starts with bounded local provider qualification and leaves the runtime and publication
decisions below open. It does not register unattended dispatch or change roadmap status.

Keep the inherited questions open and retain their existing blocking edges. Start the census
and scheduled-agent research as decision work; do not interpret this map as a runtime order.
Review publication/recovery and authorization policies before accepting execution mechanisms.
Record accepted contracts and demonstration-sized slices in core, reusing existing planning.

The relevant accepted and operative correspondence contract and runtime proofs must both
clear before a governed pilot. Isolated, authorized experiments can proceed earlier. LEGO
migration requires its own ratification. Loop consumption, contradiction handling and independent
supervision must have separate evidence before claiming the inherited conductor remit delivered.
