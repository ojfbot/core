# ADR-0023: NL instance spawning via ShellAgent, not a sidebar affordance

Date: 2026-03-18
Status: Accepted
OKR: 2026-Q1 / O1 / KR3 (Cross-domain hero demo)
Repos affected: shell
Shipped: [shell] #37 (`704f5ee`)

---

## Context

Phase 4 of the Frame OS roadmap delivers NL instance spawning: a user can open a new app
instance by stating intent in natural language ("open a new TripPlanner for Paris") rather than
clicking a button. Two implementation strategies were considered: routing the spawn through
ShellAgent (the assistant), or adding a "new window" UI control to the sidebar.

## Decision

NL instance spawning is routed through ShellAgent. The user speaks intent; ShellAgent
interprets it, constructs an instance plan, presents it through the G3 Approval Queue, and
executes the spawn on confirmation. There is no dedicated "new window" button in the sidebar for
this capability.

## Consequences

### Gains
- The interaction pattern is **assistant-centric**: the assistant is the interface, not a
  button. The user learns "tell Frame what you want" rather than "click here to open apps."
  This scales to arbitrary app definitions; a new button would require a new UI affordance for
  every new capability.
- Consistent with Samir Mody's thesis ("A button has one outcome; an NL utterance has a
  distribution") — this is the architectural bet that the Frame shell is making visible.
- The Approval Queue is a natural fit for NL spawning: the user needs to see the blast radius
  (which apps will open, which threads will be initialised) before confirming. A button could
  not surface this information without becoming its own wizard flow.

### Costs
- ShellAgent can misinterpret intent. If a user says "open TripPlanner for Paris" and two
  TripPlanner instances are already running, ShellAgent must resolve the ambiguity. The Approval
  Queue handles "do you understand the blast radius" — it does not handle "ShellAgent
  misidentified which instance you meant." Ambiguity resolution under multi-instance spawning
  is an open design gap tracked in ADR-0022 and [shell] #5.
- NL spawning is harder to test than a button click. Integration tests must simulate NL input
  and verify the full ShellAgent → plan object → queue → spawn chain.

### Neutral
- A sidebar affordance could coexist as a power-user shortcut without contradicting this
  decision. This ADR does not prohibit a secondary UI entry point; it establishes that the
  primary and canonical path is NL through ShellAgent.

## Samir pillar

**Assistant-centric architecture** — the assistant orchestrates UI and tools. Every feature is
designed as the assistant acting, not the user operating controls.
