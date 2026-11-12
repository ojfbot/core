# FleetRunner and HelpDesk cross-harness routing plan

Date: 2026-11-12. Status: Proposed. Parent initiative: [Core #307](https://github.com/ojfbot/core/issues/307).
Capture scope: persist the conversation's plan and publish a sanitized draft PR. No runtime or implementation authority follows.
The public record captures user directions and attributed proposals; it is not independent authentication of human authority.

## Problem and governing directions

Agents must correspond across native harnesses without making one harness, interface or machine the governor.
HelpDesk supplies durable addressed correspondence. Fleet-owned contracts define meanings, identities, permissions, evidence and state transitions.
Adapters integrate native mechanisms without allowing provider-specific IDs or statuses to determine canonical semantics.
Local controlled code runners are available to both harnesses on each Mac. Shared work authority remains singular.

The user explicitly corrected an earlier asymmetric diagram: Codex on Yuri and Claude Code on Yojimbo was only an example,
not the architecture. BOTH Codex and Claude Code must be supported on BOTH Macs, with multiple distinct sessions in every combination.
Requester, reviewer and executor are granted workflow roles, not machine/harness identities.

The deterministic-first constraint is absolute for classical questions. Code reads authoritative facts and evaluates schemas,
identity/permissions, pins, counters, freshness, deadlines, idempotency, hashes, numerical/statistical rules, budgets and test results.
Models are used only for declared judgment tasks and return bounded proposals. A model cannot determine its own authority,
decide whether another model is needed at runtime, grade a classical gate, override a failed check, or manufacture missing evidence.
Statistical/numerical computation remains a classical tool even when the underlying measurement is variable.

Every inference request inside a managed harness is covered: initial requests, retries, compaction, subagents and model reviewers.
Guarding only a process launch is insufficient. A surface unable to expose and constrain that boundary is not qualified for managed inference.
Classical workflows permit zero inference attempts. Unknown workflow classes remain held for reviewed classification.

The user also requires progress toward distinct workload/session identity, limited permissions, controlled delegation,
protected credentials, and attributable access/connections. Device participation is the current access baseline, not the strict target.
OpenCode is a later adapter against the same contract.

## What exists and the evidence limits

| Component | Source-grounded finding | Missing qualification |
| --- | --- | --- |
| HelpDesk | Signed writer requests, command deduplication, durable forum/replay, replies, attachments and device stdio MCP adapter | Native-session delivery and strict workload/resource permissions |
| Current access | Enrolled writer/key principal; thread reads are permitted by device participation | Session addressing is not session isolation, agent identity, physical-device attestation or operator authority |
| Codex on Yuri | The originating session has HelpDesk access; the existing coordinator routes selected messages to known Codex chats | A current, exact managed-execution profile with every-call enforcement |
| Claude Code on Yuri | Shared adapter code is reusable | No inspected binding-specific native dispatch or inference-control receipt |
| Codex on Yojimbo | Historical duplex source and a reported disposable CLI resume probe | Current managed profile, production integration and two-host conformance |
| Claude Code on Yojimbo | Existing peer correspondence | A logical peer address is not independent native-session or inference-boundary proof |
| Two local runners | Workload compute workers and older duplex component fixtures exist | Controlled native-agent runner/adapter integration on both Macs |
| Switchboard | Initial Anthropic-compatible proxy is delivered; later provider/budget/accounting slices are separate | Native harness compatibility, scoped admission, budget enforcement and bypass prevention |
| Legacy duplex | Useful separate ingestion/delivery/acceptance/verification concepts and crash/replay fixtures | Review-only, paused prototypes; no accepted physical two-Mac round trip; old work routes are not the new service API |
| Core compute service | NAS/Mac source integrated; later recovery/interruption source exists | This plan grants no G6–G8 operational promotion or broader governed-development authority |

Source findings are dated, not current health assertions. The new routing catalog has no executed proof.
Do not resume the historical G0–G2 checkout or rebind its receipts to a newer candidate.

## User stories

1. As an owner, I can address one exact session on either Mac without depending on its title or recent activity.
2. As a Codex session, I can communicate with authorized Codex or Claude Code sessions on either Mac.
3. As a Claude Code session, I have the same authorized routing options and access to local controlled execution.
4. As a sibling session, I cannot inherit another session's identity or permissions from a shared machine.
5. As a runner, I can resolve permissions and classical conditions without invoking a model.
6. As a reviewer, I can distinguish journal persistence, native invocation, target acceptance, reported result and verified outcome.
7. As an interrupted consumer, I recover pending correspondence independently from replay progress.
8. As an owner, I can revoke access and observe the bounded effect on open connections and queued work.
9. As a verifier, I can reconstruct every model attempt from independent call-boundary and native evidence.
10. As an operator, I can replace a harness adapter without replacing canonical work, grants or history.
11. As a receiving agent, I can resume this plan from one source revision without treating a handoff as an execution grant.
12. As a later OpenCode participant, I satisfy the same conformance contract.

## Implementation decisions: required semantics, not selected mechanisms

### Fleet contract and adapter boundary

Canonical participant, work, conversation, request, correlation, causation, grant and evidence identities belong to the fleet.
Native thread/session/turn IDs are adapter bindings. A Codex session-tree ID is not automatically the exact target thread.
Codex Desktop, CLI and app-server are separate native surfaces and must be pinned/qualified individually when advertised.
A CLI probe cannot qualify Desktop; unsupported capabilities cannot be silently substituted.

Adapters expose supported binding/observation/dispatch/receipt behavior through a versioned contract.
Capability declarations require evidence. Unknown or unsupported operations return explicit refusal.
Native statuses are mapped without promoting a queued prompt or completed turn into work success.

An addressed message remains peer data even when a native API accepts it in a user-role turn.
Delivery must preserve logical authorship, authenticated publisher, evidence strength and applicable grant references.
A peer's approval text does not become attributable human approval.

### Identity, permissions and trust boundary

Distinguish participant, running workload/process instance, conversation/session, native binding, credential and grant.
A device key proves possession of an enrolled credential; it does not attest a physical machine, model identity or a particular agent.
Preserve reported and independently observed attributes separately. Do not replace these dimensions with an agent-authored trust score.

The strict pilot requires independently validated workload bindings, distinct scoped credentials and protected parent/provider credentials.
Resource services and execution brokers enforce access, including direct API calls. A local adapter filter alone is insufficient.
Protected resources must reject a legacy broad device credential as a fallback path.
Real isolation needs a declared, tested OS/broker boundary; labels or credentials accessible to sibling processes do not establish it.
Host administrator/issuer/enforcement components are explicit trusted actors. No blanket trustless claim is made.

Permissions distinguish metadata/body/attachment reads, correspondence, native wake/start, approved workflow execution,
arbitrary command execution, replies, additional recipients and delegation. Replying does not grant access to unrelated history.
Grants carry issuer, subject, resources, operations, audience, validity, delegation limits and policy revision.
Delegation can only narrow allowed authority and preserves acting-party lineage; the concrete mechanism is unresolved.
Existing signing and auth seams are integration points, not evidence that a new grant policy already exists.

Trace access through request, principal, workload binding, grant/delegation, policy decision, connection/invocation and outcome.
Record both endpoints, public credential identifiers, policy/binding revisions, decision/reason, correlation and native evidence references.
Never log secret values. A connection permits only its authorized operations.
For privileged dispatch, persist authorization evidence before starting; a later uncertain outcome remains held.

### Deterministic runner and call boundary

A reviewed workflow registration fixes model necessity, allowed actors/resources, inputs, schemas, tools, checks, bounds and deciding authority.
No model selects or expands its own execution class. The runner authorizes each step and reserves finite budget before dispatch.
Every inference attempt uses the call boundary, including internal retries/compaction/subagents/reviewers.
Provider credentials are outside agent reach and egress cannot bypass enforcement. Missing call coverage blocks the live pilot.
Native inference-shaped requests to an emulator are recorded separately from real-provider inference requests.
Uncertain charges/dispatch are not silently reset. A new request ID cannot reset a grant's consumed budget.

Model output is stored as an attributed proposal. Code validates structure, references and classical invariants.
Schema validity is not semantic truth or usefulness. Human assessment resolves the pilot's wording quality.
A model challenger may perform an explicitly admitted judgment task, but cannot decide classical proof results.
There is no automatic recursive model-review chain or model repair call.

### Correspondence, replay and state semantics

Reuse the service's command/thread/message/event/reply identities and canonical work/subject revision references.
Delivery bookkeeping is not another canonical work scheduler.
Each consumer owns a stream-aware checkpoint; advance after durable import and track pending deliveries separately.
Transport can repeat. Operation/effect idempotency is distinct from command deduplication.

Required observations are separate: journal persistence, durable receiver import, native invocation, target-agent acceptance,
reported result, independent verification and original-work disposition. Adapter claims are labelled as claims.
Acceptance requires matching request/revision evidence attributable to the intended native session.
Unknown dispatch is reconciled from native evidence or held, not automatically repeated.
One verified active dispatcher serves a native session. Lease expiry does not resolve a possibly completed external effect.
Busy/offline/stopped/approval-blocked targets have explicit dispositions; no silent fork, replacement, provider switch or permission downgrade.
Correspondence acceptance does not create a FleetRunner execution lease.

On a stream change, history may be replayed for reconciliation; imported historical requests must not be automatically re-executed.
Notification hints never substitute for authorized replay. Incomplete pages cannot produce caught-up or successful verdicts.

## First vertical slice

Scope is one advisory workflow across four bindings and both local runners, using isolated pilot resources.
The native sessions and profiles must be explicitly enrolled; real IDs and credentials are not supplied by this plan.
Both Macs execute their local admission, access, checkpoint and receipt checks. A central fixture doing everything is not proof.

### Before live inference

- Freeze the four native surface/version profiles, one workflow, output schemas, grants, evidence requirements and finite bounds.
- Assign implementation leads through the existing owners and review the proposed public test seams.
- Exercise real native bindings against deterministic harness/provider emulators, plus an isolated HelpDesk/state.
- Pass all 12 directed cross-binding routes and four distinct-session cases within the same binding class.
- Run target/access cases across all 16 coordinates; native lifecycle/call-boundary cases across four bindings;
  runner recovery across two hosts; budget/ownership races across both runners.
- Independently accept complete evidence and obtain a separate exact-profile live-pilot authorization.
- Keep the real-provider inference-request count zero throughout mechanical qualification.

### Live advisory workflow, only after a separate GO

Use a frozen, non-sensitive design excerpt containing code-established receipt states.
An admitted Codex role proposes wording that presents those states clearly; an admitted Claude Code role critiques possible misinterpretation.
Roles can be bound on either Mac. The target is selected by an authorized participant/session binding, not machine or harness convention.
Code performs routing, grants, counters, receipts, validation and final evidence verdicts.
The result is a durable reply in the originating participant's inbox; it does not require a new model turn to acknowledge it.
Neither model determines actual receipt state or changes its meaning. Output remains advisory pending human quality assessment.
If there is no genuine judgment task, stop after zero-model proof rather than spending tokens to demonstrate message travel.

Proposed bounds, NOT accepted production policy:

| Parameter | Proposed pilot value / unresolved input |
| --- | --- |
| Inference requests | At most 2 per grant/exchange, at most 1 per role, globally across both runners |
| Output tokens | At most 512 per inference request |
| Request timeout | 120 seconds |
| Exchange deadline | 5 minutes |
| Grant lifetime | 10 minutes |
| Monetary ceiling | Must be explicit, approved and conservatively reserved before any live request |
| Automatic model repair, retry or provider failover | None |
| Model tools and outward effects | None; advisory outputs only |
| Scope | Enumerated immutable inputs, one pilot thread and correlated reply; no unrelated data |
| Delegation, spawning and extra recipients | Denied |

The Codex role may read the frozen input, execute its registered judgment step, address the registered reviewer and read its reply.
The Claude Code role may read that input/proposal, execute its registered critique and reply only within that correlation.
Model/process storage is separately limited to approved pilot state. Broad device/provider credentials, unrestricted shell,
edits, publication, NAS operations and unrelated histories are not part of the pilot.

## Testing decisions

Proposed public seams, pending implementation-owner confirmation:
1. Submit/replay the canonical correspondence workflow and observe journal/receipt outcomes.
2. Observe native adapter invocation/response evidence and forbidden-dispatch absence.
3. Observe the protected provider-call boundary and independent egress/call accounting.

These are behavioral seams, not prescriptions for internal module decomposition.
R01–R25 and their coverage coordinates live in acceptance.json. The eight named semantic mutations each need their designated failing oracle.
Syntax/import failures, unexecuted tests, model-authored verdicts and missing evidence cannot kill a mutant or pass a gate.
Required variants and exclusions are enumerated before execution; no silent denominator or required skip is permitted.
The independent checker consumes raw native/journal/auth/network evidence, not the router's decision reducer.
Native-emulator conformance does not imply live deployment or semantic quality; live text is not expected to reproduce byte-for-byte.

## Delivery order and existing owners

| Phase | Work / owner boundary | Entrance / proof gate |
| --- | --- | --- |
| A | This session: analysis/catalog. Core shared-contract venues and existing HelpDesk peers: review | Confirm unresolved choices and public test seams; fixtures reject unknown/classical model dispatch |
| B | LocalHelp/device owners, existing execution owner and Switchboard component review; adapter/runner/gateway implementation leads UNASSIGNED | Four exact native profiles, two runners, isolated policy resources and enforced call boundary |
| C | Named implementers execute; independent verifier accepts | All 16 routing coordinates, R01–R25 variants and eight mutations; zero real inference requests |
| D | Existing owner makes a separate bounded live-pilot decision | Exact source/profiles/grants/budget and independent zero-model proof; no permission inferred from this document |
| E | Service/host owners and verifier extend operational hardening | Isolation, rotation, constrained delegation, concurrency/recovery and production controls qualified |
| Later | OpenCode adapter owner UNASSIGNED | Same canonical conformance suite; no forked authorization model |

LocalHelp / HelpDesk and its existing Yojimbo peer retain service/transport operations.
Yojimbo Setup delivery coordinator retains its current monitoring route and separate cursor; it is not the production implementation owner for a general router.
Earlier Yuri–Mini duplex protocol pilot owners remain paused; consult their artifacts without resuming or dispatching them.
This session owns analysis and can provide independent acceptance review, not silent implementation authority.

Shared ownership stays with Core under #307 and its existing #311 portability, #313 authority, #318 supervision and #511 identity input.
LocalHelp #7/#12 retain compute-record/wiring questions. Their older API/R5 prerequisites need owner reconciliation, not automatic hold removal.
No new program, scheduler, general work queue, duplicate issue or ready-for-agent designation is created.

### Parallel compute-service gates

G6 requires actual sleep/Wi-Fi evidence and interruption/isolation proofs; G7 requires independent fresh backups and empty-volume restores;
G8 requires owner cutover approval and the 48-hour/200-job soak. Existing FleetRunner/recovery owners retain that path.
This routing plan does not mark those gates complete or reinterpret historical source-bound receipts.
Later governed development dispatch needs accepted routing/authority policy and applicable service acceptance, not just a successful pilot exchange.

## Open decisions and explicit blockers

| ID | Required decision / evidence | Owner venue |
| --- | --- | --- |
| O1 | Exact native Codex/Claude surface, version, session binding and supported lifecycle on each Mac | Existing device/HelpDesk owners; native adapter leads to be named |
| O2 | Workload binding issuer, credential protection and same-user/host-administrator threat boundary | Core identity/authority with host owners |
| O3 | Grant representation, resource policy enforcement, revocation/connection bounds and strict-resource migration | Core authority + LocalHelp/resource owners |
| O4 | Native inference interception, Switchboard reuse/extension, pricing/reservation/accounting and egress proof | Existing gateway/execution owners; implementation lead to be named |
| O5 | Proposed numerical bounds, cost ceiling, deadlines, backpressure and stop policy | Owner under existing authority decision |
| O6 | Independent checker/evidence custody, retention/export and allowed normalization | Supervision/portability owners |
| O7 | User-facing disclosure of reported versus verified identity and advisory versus accepted output | Existing client/contract owners and owner review |
| O8 | Public test seams and the single useful judgment task to use after zero-model proof | Implementation owners + independent verifier + owner |
| O9 | Reconcile current work and legacy holds before assigning disjoint implementation work | Existing FleetRunner/HelpDesk conductors |

No numeric revision forecasts or calendar delivery promises are inferred from this capture.
These open choices prevent treating the captured plan as an implementation-ready, operative contract.

## Security considerations

Threats include sibling credential reuse, forged logical authorship/operator approval, wrong/native-reused session targets,
adapter bypass, direct provider access, confused delegation, replay/cursor gaps, unknown effects, command injection,
unbounded inference/loops, private-data leakage and forged completion.
Enforce policy at services/brokers and the call boundary; a prompt or client-side label is not a security boundary.
Use established cryptographic/authorization mechanisms selected through existing venues; this plan selects no new issuer, OAuth deployment or attestation stack.
Record enforcement/audit failures and bounded unknowns; do not convert absence of evidence into success.
Protect thread bodies, attachments, replay, notifications and connection metadata under the declared profile.
Raw private native IDs, paths, addresses, credentials and operational logs stay outside public source.

## ADR stub: fleet-owned semantics and bounded native adapters

Status: Proposed input to existing #311/#313/#511, not a numbered/accepted ADR.
Context: native harness IDs, lifecycle APIs and device-wide credentials cannot define portable work authority or strict per-session access.
Proposed decision: use fleet-owned semantics and independently qualified native bindings; separate correspondence, grants, invocation and verification;
enforce every admitted inference request and preserve deterministic handling for classical work.
Alternatives: native chat/host as governor; adapter-only filtering with shared device authority; or a parallel proprietary coordination program.
Consequences: explicit binding/grant/evidence management and qualification costs; provider/host swaps preserve canonical meaning;
unsupported native capabilities remain blocked instead of weakening policy. Mechanism and runtime choices remain unresolved.

## Out of scope and authority boundary

This capture changes planning artifacts only. It does not implement a router, alter service/auth/network configuration,
enrol identities, issue grants, invoke a model, start workers, send peer messages, advance cursors, merge code, migrate NAS storage,
resume Selfco/duplex work, or promote any gate. Existing consumer applications and service work remain with their owners.
The live-pilot proposal concerns an isolated advisory workflow, not autonomous governed development or automatic publication.
Selfco can be a later knowledge pointer if requested; the Core package remains the canonical plan.

## Source snapshot and references

Source checked 2026-11-12. These pins establish source lineage, not current runtime proof.

| Source | Pin / role |
| --- | --- |
| Core main | 321a44637b8fc406b8823a192c1194511007e6c0; capture base |
| LocalHelp main | 9f27db3f02c6b1bf97a6f4e0f5e45245f29988c8; transport, auth seam, device-participant repository access |
| Switchboard main | 57926bb314de4da21a8be9c267acc06d9e548af1; initial proxy; later budgets/provider slices remain separate |
| workstation-yuri #8 | efb28e309a41b18af1852111191536447a44be52; review-only historical duplex source |
| workstation-yuri #9 | ab56df95ecea25d6ce7a54c582bef448c674925a; review-only peer audit snapshot |

- [Core map #307](https://github.com/ojfbot/core/issues/307)
- [Accepted ownership ADR](https://github.com/ojfbot/core/blob/321a44637b8fc406b8823a192c1194511007e6c0/decisions/adr/0108-fleet-runner-in-core.md)
- [Proposed stochastic-step/gate-authority input](https://github.com/ojfbot/core/blob/321a44637b8fc406b8823a192c1194511007e6c0/decisions/fleet-runner/gate-authority-tiers.md)
- [Identity input #511](https://github.com/ojfbot/core/issues/511), [authority #313](https://github.com/ojfbot/core/issues/313), [portability #311](https://github.com/ojfbot/core/issues/311), [supervision #318](https://github.com/ojfbot/core/issues/318)
- [LocalHelp #7](https://github.com/ojfbot/LocalHelp/issues/7), [LocalHelp #12](https://github.com/ojfbot/LocalHelp/issues/12)
- [LocalHelp auth source](https://github.com/ojfbot/LocalHelp/blob/9f27db3f02c6b1bf97a6f4e0f5e45245f29988c8/packages/helpdesk/src/auth.ts)
- [LocalHelp repository source](https://github.com/ojfbot/LocalHelp/blob/9f27db3f02c6b1bf97a6f4e0f5e45245f29988c8/packages/helpdesk/src/repository.ts)
- [Switchboard roadmap](https://github.com/ojfbot/switchboard/blob/57926bb314de4da21a8be9c267acc06d9e548af1/.claude/roadmap.md)
- [Historical duplex #8](https://github.com/ojfbot/workstation-yuri/pull/8), [peer snapshot #9](https://github.com/ojfbot/workstation-yuri/pull/9)

Official native API and authorization documentation was consulted in the conversation. Recheck it and the installed versions before implementation:
[Codex app-server](https://learn.chatgpt.com/docs/app-server),
[Claude sessions](https://code.claude.com/docs/en/agent-sdk/sessions),
[OAuth delegation semantics](https://www.rfc-editor.org/rfc/rfc8693.html),
[proof-of-possession semantics](https://www.rfc-editor.org/rfc/rfc9449.html).
These references offer integration mechanisms; they do not select one or prove it is deployed.
