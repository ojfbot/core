# ADR-0108: Fleet-runner lives in core with an independent deployment
slug: fleet-runner-in-core
serial: 0108
Date: 2026-10-01
Date accepted: 2026-10-01
Status: Accepted
domain: meta
type: architecture
OKR: ns:l2-ojfbot#P2
Commands affected: /day-run, future fleet-runner entry points
Repos affected: core; morning-cockpit and daily-logger as consumers
traces:
  relates-to: [launcher-mechanism-core-scripts-launcher, dispatch-queue-and-day-runner]

---

## Context

The existing day-runner is a morning-invoked CLI in core. The fleet-runner design expands
that responsibility to persistent execution: useful progress while the operator's Mac
sleeps, Codex and Claude workers, one execution-transition authority, controlled
publication, durable review evidence and recovery.

The placement alternatives are a new repository or a dedicated component in core's
existing monorepo. The execution, correspondence and authorization contracts are still
being designed together. Splitting repositories now would require coordinated contract
releases before there is a demonstrated independent consumer or maintenance team.

The accepted launcher decision, adr:launcher-mechanism-core-scripts-launcher, kept shared
tooling and types in core to avoid a second bootstrap and published-package boundary.
Fleet-runner needs a stronger runtime and deployment boundary than that launcher, but
the repository tradeoff remains relevant.

## Decision

**Fleet-runner belongs in `ojfbot/core`, as a dedicated component with its own deployment.**
The intended location is `packages/fleet-runner`. The final package shape follows the
runtime choice; this decision does not select a language, framework, database or host.
Do not create a separate `ojfbot/fleet-runner` repository for the initial implementation.

| Responsibility | Owner |
| --- | --- |
| Shared correspondence, authorization semantics, identities and review contracts | Core's shared contracts, through their existing decision venues |
| Admission enforcement, attempts, scheduling, worker supervision, publication and recovery | Fleet-runner component in core |
| Codex/Claude execution integration | Worker adapters behind explicit interfaces |
| Runtime identities, credentials, durable state and service operation | Deployment environment and selected state store |
| Operator observation and commands | Morning-cockpit, delegating transitions to the execution authority |
| Suggestions and safe public dispositions | Daily-logger |
| Product implementation | The relevant product repository |

Keep fleet-runner independently testable and deployable. Sharing a repository must not
require deploying the service for an unrelated skill or documentation change. Shared
contract changes can be reviewed with their runtime consumer in one PR, while deployed
versions still require explicit compatibility and upgrade handling.

Repository placement does not provide credential isolation. Worker, verifier and publisher
permissions must be enforced by the chosen runtime environment. No secrets or live queue
data belong in the repository. One component does not require one process or one identity.

### Scope of acceptance

The operator approved repository placement on 2026-10-01. Acceptance applies to this
boundary only. It does not accept the remaining execution design or authorize scaffolding,
deployment, live queue mutation, autonomous merge, private export or cluster migration.

Publication uncertainty/reassignment policy, trusted grants, restoration, exact-state
delivery and review continuity, confinement, source revisions, budgets, database, provider
qualification and hosting remain separate design decisions.

The existing correspondence program in [core PR #495](https://github.com/ojfbot/core/pull/495)
remains the contract dependency for a governed pilot. It does not block this repository
decision. Its accepted, operative pilot contract and runtime enforcement both need evidence.
LEGO's separately ratified cutover remains outside this placement decision.

Estate/onboarding ownership remains in [core #279](https://github.com/ojfbot/core/issues/279).
Locating the executor in core does not decide where reusable machine setup belongs.

### Delivery and existing work

Record runtime design and implementation slices through core's existing planning and
review mechanisms. Consumer changes land in their own repositories. Before dispatch,
assign real roadmap references, acceptance checks and dependencies against the registered
northstar; do not create a second roadmap for the same northstar or invent movement values.

`rm:rm-l2-ojfbot#S25` currently covers the narrower day-runner operating-mode decision and
a PR with checks/trace evidence. Completing that criterion would not demonstrate the
fleet-runner contract above. Reconcile its scope before dispatching overlapping work;
this ADR does not change its status, run it or claim it complete.

The [control-plane conductor, core #307](https://github.com/ojfbot/core/issues/307), observes
and coordinates existing loops. Its stated scope excludes replacing dispatch. Preserve
that boundary rather than treating it as authority to implement fleet-runner.

Cut over existing execution entry points only through reviewed implementation slices
that preserve work identity and one transition authority. This ADR moves no code and
does not retire the existing runner.

## Consequences

### Gains

- Contract and consumer changes can land together while the design is evolving.
- The executor shares core's development tooling and decision history.
- Core issues and PRs provide a clear implementation venue without another bootstrap.

### Costs

- Service changes share core's CI and review surface; package-specific checks and a
  dedicated deployment target must keep unrelated changes from affecting operations.
- Module boundaries need enforcement; a monorepo must not encourage direct access to
  mutable runtime storage from unrelated tools.
- Independent deployment still requires version compatibility, migrations and rollback.

### Neutral

- Runtime selection and hosting remain open.
- Product repositories, cockpit and daily-logger retain their responsibilities.
- Reconsider extraction if separate maintainers, repository access restrictions or
  independently versioned external consumers create a concrete need.

## Alternatives considered

| Alternative | Why not selected |
| --- | --- |
| New fleet-runner repository now | Adds contract distribution, coordinated PRs and another release/bootstrap path without a demonstrated repository-level ownership requirement. Independent deployment alone does not require it. |
| Continue expanding the one-pass script without a component boundary | Makes persistent state, provider adapters, recovery and controlled publication harder to test and operate independently. |
| Put execution authority in cockpit | Conflicts with cockpit's observation/delegation role and risks a second transition authority. |

## Verification of this record

- The ADR, index and glossary agree on core ownership and independent deployment.
- Related ADR slugs resolve and their relationship is recorded in both directions.
- No package, dependency, service configuration or dispatch state changes in this record.
- Existing correspondence, estate and conductor venues remain distinct.

Runtime correctness remains unverified by this documentation change.

## Provenance

| Field | Value |
| --- | --- |
| Zero-point | 2026-10-01 fleet-runner repository-placement review |
| Decision authority | Operator explicitly approved the core-component and independent-deployment plan on 2026-10-01 |
| Acceptance scope | Repository and responsibility boundary only; publication/merge state is recorded by Git history |
| Source baseline | core main 5b43c97de28cf251de8921e4ec9b6a7d20b467e9 |
| Implementation start | Pending a separately reviewed implementation slice |
| Implementation end | Pending |
