# ADR: Work register layer: topics, slices and tasks, owned by one service and referenced everywhere else
slug: work-register-layer
serial: draft
rev:
Date: 2026-11-20
Status: Proposed
domain: workflow-engine
type: architecture
OKR:
Commands affected: /day-run (future: claim tasks from the register), /frame-standup (future: read topics and tasks)
Repos affected: fleet-runner (hosts the register module), LocalHelp (HelpDesk carries task events and references only), morning-cockpit (read-only view, writes through the register API), daily-logger (reads the register)
gate:
baseline:
traces:
  supersedes:
  amends:
  relates-to: [dispatch-queue-and-day-runner, three-tier-northstar, fleet-runner-in-core, control-gated-slices, stable-identity-and-facet-tags]
  parent:
  part-of-series:

---

## Context

The fleet coordinates work across Claude Code and Codex chats on two Macs, headless runs, and several
services. **HelpDesk** (LocalHelp) relays messages between devices and sessions. **FleetRunner**
runs approved jobs. **GitHub** holds code, issues and the roadmap. **MorningCockpit** is the owner's
view and control surface, and **DailyLogger** publishes the narrative.

No service owns the work itself: what work exists, which theme it belongs to, who has claimed it,
and what state it is in. Today the pieces are scattered:
- "TASK", "ACK" and "BLOCKER" are text conventions inside HelpDesk messages.
- Threads stand in for pieces of work.
- The dispatch queue projects ready roadmap slices as task beads.

That makes the whole graph of work hard to follow, and it invites each service to grow its own copy.

The owner set two constraints:
- HelpDesk must stay a messaging, relay and coordination layer and must not own tasks or topics.
- The work graph must be intelligible across services, with permissions, without bundling,
  overloading or duplicating layers.

A short study of proven designs found the same answer across all of them. Airflow keeps task
instances in its metadata store. The Kubernetes API server stores objects while events point at
them. Temporal keeps workflow history while signals address the workflow. In A2A, the serving
agent owns the Task and `contextId` groups tasks. Beads is an agent issue tracker separate from
orchestration. In every case the work register is a store with a state machine and one writer per
record. Messaging carries references and events, never the truth.

## Decision

1. **The work register is its own layer.** It has its own record kinds, `register:topic/<id>`,
   `register:task/<id>` and later `register:slice/<id>`, its own API and its own permissions.
2. **It runs first as a module inside FleetRunner,** in its own tables. Each table carries an
   explicit written contract: what it may hold, what may be done with it, and which identities may
   write it. Guardrails keep register tables and job tables apart, and job tables never define
   tasks. The module can be moved to its own service later without a rewrite.
3. **Model.**
   - **Ownership tree, one parent each, progress rolls up:** northstar property → roadmap item →
     **slice** (one shippable PR, per `adr:control-gated-slices`) → **task** (one agent-sized step:
     build, review, fix round, install, test).
   - **Topic:** a cross-cutting theme. It is a many-to-many tag on roadmap items and slices, may
     span roadmaps and repos, and is never a parent.
   - **Order:** "waits on" is a separate link between any two items.
   - **Assignment:** a session or job *claims* a task. Sessions are never a grouping.
   - **Task states:** `open → claimed → blocked → review → done`, plus `cancelled`. `done` and
     `cancelled` are terminal; follow-up work is a new task that references the old one.
   - **History:** every change is an append-only event recording who made it and why.
4. **Who writes.** Only the claiming session or job changes a task's state; the owner key may
   override. Identity is the device and session identity issued by HelpDesk (signed per-session
   keys with fixed names `<device>/<provider>/<chat id>`), and the register verifies it itself.
   HelpDesk cannot write register state.
5. **One home per record; links everywhere else.** References use the form `<service>:<kind>/<id>`.
   - Tasks link to GitHub issues and PRs, HelpDesk threads, and FleetRunner jobs, and those link
     back.
   - HelpDesk carries events such as "task claimed" or "task blocked" as pointers only.
   - GitHub stays the roadmap; there is no automatic sync of open and closed state.
6. **Delivery audit loop: the only path that closes an issue.** It is deterministic around a model
   judgement.
   - **No auto-close on merge.** PRs reference issues with `Refs #N` (plus `Roadmap-Ref:` and the
     slice id), never `Closes #N`, so GitHub does not close an issue on merge.
   - **Trigger.** When a slice's PR merges, the register opens an `audit` task for it. Merges are
     detected by polling the GitHub API from the fleet, not by GitHub Actions, which keeps CI
     minutes inside the free tier.
   - **Independent auditor.** The audit runs as a fresh headless agent from a different provider
     than the builder (Codex audits Claude's work and vice versa), read-only. It reads the issue's
     acceptance criteria, the roadmap entry's success criteria, the merged diff and the tests. It
     tries to break the claim and returns a structured verdict per criterion: `met`, `partly`,
     `not-met` or `untestable`, each with evidence. If the two providers disagree, a second audit
     runs, and an unresolved disagreement goes to the owner. This follows
     `adr:defect-ledger-and-closure-loop`: only an independent check may close.
   - **Deterministic applier.** Code, not the model, applies the verdict to GitHub:
     - every criterion met: close the issue with an audit comment;
     - some met: tick those criteria, or close their sub-issues, label `partially-delivered`,
       comment, and **fork** a linked follow-up issue (`follow-up of #N`) with the unmet criteria,
       plus a register task for it;
     - none met, or untestable: keep the issue open, comment, and raise a BLOCKER to the owner.
     Every action is logged as a register event, and the issue, the PR, the follow-up and the
     task all link to each other.
   - **Precondition.** Issues and roadmap entries carry acceptance criteria as a checkable list.
     An issue without them gets an `untestable` verdict rather than a guess.

7. **Service roles.**

| Service | Owns | Never |
| --- | --- | --- |
| HelpDesk | identity issuance, messages, threads, presence | task or topic state |
| Work register (in FleetRunner) | topics, slices, tasks, their events | running work, message bodies |
| FleetRunner jobs | execution, approvals, budgets, run logs | defining tasks |
| GitHub | code, PRs, issues, roadmap files | live task state; issues close only through the audit loop |
| MorningCockpit | the owner's view and controls | writes except through each home service's API |
| DailyLogger | the published narrative | operational state |

Permissions are enforced by each record's home service. A viewer that assembles the whole graph
sees only what each home service allows.

## Consequences

### Gains
- One place answers "what work exists, who has it, what state is it in", and every other service
  points at it.
- HelpDesk stays small and keeps its first-slice rule: check-ins and messages are never commands
  or locks.
- Topics give the cross-repo view the owner needs (for example, readiness for a trip) without a
  second hierarchy.
- The dispatch queue, the day-runner and MorningCockpit's Claim lane get a durable home for
  claims.

### Costs
- One more module, with migrations, backups and an agent-friendly CLI or MCP surface. Without that
  surface, agents will skip it.
- The existing dispatch-queue beads must either become register tasks or be projected from them.
  Running both as sources of truth is not allowed; the migration is its own slice.
- FleetRunner must be up for the register to be readable.

### Neutral
- The first version builds on session identity (LocalHelp #79), which must merge first.
- Typed TASK/ACK/BLOCKER messages stay as human-readable conversation; the register does not
  parse them into state.

## Alternatives considered

| Alternative | Why rejected |
|-------------|--------------|
| Tasks and topics inside HelpDesk | Overloads the messaging layer and breaks its "never commands or locks" rule; owner rejected it. |
| GitHub issues and milestones as the register | Too coarse, online-only, rate-limited; task states do not map onto open and closed. |
| Tasks as an ordinary part of FleetRunner job data | Couples "what should be done" to "how it runs"; much work never becomes a job. |
| A separate register service from day one | The cleanest split, but one more service to run and secure; deferred until the module earns it. |
| Everything as one item type joined by links (Beads style) | Flexible, but tangles easily and loses roll-up; kept as an influence for typed links only. |

## Provenance

| Field | Value |
| --- | --- |
| Zero-point | 2026-11-20 owner grill in a LocalHelp session; decisions recorded on LocalHelp #83 |
| Implementation start | _pending_ (after LocalHelp #79 merges) |
| Implementation end | _pending_ |
