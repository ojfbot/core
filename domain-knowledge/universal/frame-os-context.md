# CircusGreen fleet — agent context brief

Read this before architectural decisions or code across ojfbot repositories.
The filename `frame-os-context.md` remains the distributed compatibility path;
Frame OS is one part of the fleet, not its universal product or runtime model.

## Start with the current purpose

The [ojfbot northstar](https://github.com/ojfbot/core/blob/main/decisions/northstar/l2-ojfbot.md)
defines the fleet's purpose: turn daily agentic work into shipped product. Its
properties are usable app surfaces in their natural venues, work that traces to
measurable properties, and an Arcade operating surface that can launch, front and
talk to registered apps across composition tiers. These are goals, not claims
that every app, integration or deployment is already qualified.

The July 23, 2026 decision retired demo-track targeting and the single cross-domain
hero demo as fleet-wide goals. **Frame OS names the Tier-A, in-process cluster.**
Tier B covers process federation across stacks. Module Federation is a Tier-A
technique, not the fleet membership rule. See the
[operating-surface decision map](https://github.com/ojfbot/core/blob/main/decisions/wayfinder/operating-surface-bonded-pair.md)
for decisions, open questions and their existing tickets; do not treat a proposed
seam in that map as an implemented API.

Do not rank projects using this brief. Resolve current priorities from the owner's
instructions, the applicable charter and the project's current northstar/roadmap.
A source describing a long-term goal does not establish today's priority or grant
permission to execute work.

## Resolve evidence at its owner

Use a local core checkout when available; the links below identify canonical
sources when the brief is installed into a sibling repository.

| Question | Source |
| --- | --- |
| Fleet purpose and measurable properties | [ojfbot northstar](https://github.com/ojfbot/core/blob/main/decisions/northstar/l2-ojfbot.md) |
| Registered northstars and where to find them | [Northstar registry](https://github.com/ojfbot/core/blob/main/decisions/northstar/README.md), then the named app's own northstar |
| A project's current work and architectural choices | Its `AGENTS.md`/`CLAUDE.md`, roadmap, accepted ADRs and current source; use the relevant issue or charter for unresolved decisions |
| Shared terms and boundaries | Flat distributed `domain-knowledge/CONTEXT.md` and `domain-knowledge/GLOSSARY.md`; check their cited decisions and distinguish proposed vocabulary from shipped contracts |
| Established authorization, holds and continuation | Flat distributed `domain-knowledge/agent-defaults.md`, plus the actual current owner instruction/charter |
| Cross-session correspondence | [HelpDesk charter coordination](https://github.com/ojfbot/LocalHelp/blob/main/docs/charter-coordination.md) and the addressed work's attributable receipts |
| Deployment, runtime readiness or completed work | The project's current release/qualification contract, actual target and source-bound receipts |

The northstar registry is a goal registry, not a complete live service inventory.
Do not copy its entries or an old repository table into a new authority for fleet
membership. Use the relevant consumer's real discovery/registration contract.
For onboarding, follow core's `/fleet-onboard` surface matrix and reverify paths.

Treat a plan, source implementation, passing fixture, installed client, actual
agent pickup and completed production effect as different observations. A merged
PR is not proof that a service is deployed; a listener receipt is not proof that
an agent consumed a request. State the revision, observation and evidence gap
behind operational claims. Do not carry forward old labels such as "most active",
"CI green", "not scaffolded" or "all apps consume" without current evidence.

## Keep the fleet's responsibilities distinct

The operating-surface map separates the operational spine's work objects from
SelfCo's reference/understanding layer. SelfCo supports design-time understanding;
it is not the live runtime backend or an authority to dispatch work. Keep curated
seams explicit rather than making one shared store out of every related record.

HelpDesk correspondence, FleetRunner execution, application workflow state and
observability have different owners and meanings. Read their current contracts
before integrating them. A correlation ID can connect records without equating
transport acceptance, workflow completion, publication, human approval or a trace.
A project's selected provider or observability stack does not automatically enroll
the rest of the fleet. Preserve source-specific identities and uncertainty.

Personal career/application material belongs in the private SelfCo layer and
must not be copied into fleet-distributed context or public repository artifacts.
Follow each source's privacy rules and the existing curated boundary.

## For Frame / Tier-A work

When the actual task concerns Frame composition, read the affected repositories'
current architecture and accepted decisions before editing. The following
references explain Frame-specific contracts; they do not impose a common stack
or a single LLM gateway on standalone fleet applications.

| Frame concern | Starting reference |
| --- | --- |
| Host-owned settings and isolated app namespaces | [ADR-0011](https://github.com/ojfbot/core/blob/main/decisions/adr/0011-settings-modal-chrome-ownership.md) and current shell/sub-app stores |
| Module Federation remotes and shared runtime dependencies | [ADR-0012](https://github.com/ojfbot/core/blob/main/decisions/adr/0012-module-federation-remote-integration-pattern.md) and current host/remote build configuration |
| Deployment layers and demonstration safety | [ADR-0013](https://github.com/ojfbot/core/blob/main/decisions/adr/0013-safe-demo-deployment.md), [ADR-0014](https://github.com/ojfbot/core/blob/main/decisions/adr/0014-layered-deployment-architecture.md), then current deployment policy |
| Shared Frame components | [ADR-0030](https://github.com/ojfbot/core/blob/main/decisions/adr/0030-shared-frame-ui-components-library.md) and the component package's current exports |
| Agent routing, tools and conversation state | Current shell agent implementation, domain adapters and project-specific ADRs |

Read the relevant distributed architecture file for the repository being changed.
Resolve actual ports, routes, package versions, environment names and deployment
state from its current source and configuration. Historical examples do not prove
that a service is running or that a planned route exists. Do not reclassify an app
as a Frame remote merely because it uses React, LangGraph or a shared skill.

## Distribution and adoption

Core's `domain-knowledge/manifest.json` owns distribution. This brief remains at
the flat `domain-knowledge/frame-os-context.md` path in every receiving repository;
do not rename it or change installer topology as part of a context correction.
References to other distributed files must also use flat paths.

A source correction, its merge, installation, client loading and observed behavior
are separate evidence. Updating this file does not prove that every active agent
has loaded it. Carry relevant corrections through the current authorized handoff
without inventing a new conductor or dropping an explicit hold.

The old inventory, numbered roadmap, two demo tracks and March deployment table
are historical context, retained in
[the prior brief](https://github.com/ojfbot/core/blob/0f6f283afbf8391af69857b7dd4f3a5446e92628/domain-knowledge/universal/frame-os-context.md).
They are not a current status ledger or a fleet-wide execution policy.
