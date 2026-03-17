# ADR-0019: Isolated context windows per domain agent — synthesis at output layer only

Date: 2026-03-17
Status: Accepted
OKR: 2026-Q1 / O1 / KR3 (cross-domain hero demo)
Commands affected: /plan-feature, /validate, /hardening
Repos affected: shell, core

---

## Context

MetaOrchestratorAgent (in `shell/packages/frame-agent/src/meta-orchestrator.ts`) routes
natural language commands to domain agents: ResumeDomainAgent (cv-builder context),
BlogEngineDomainAgent (content/post context), TripPlannerDomainAgent (location/itinerary
context). Each domain agent maintains a conversation thread with its sub-app's API.

The temptation in a multi-agent orchestration layer is to concatenate all domain context
into a single LLM call for synthesis — passing cv-builder conversation history alongside
BlogEngine thread history when generating a cross-domain summary.

This creates cross-domain contamination:

- cv-builder context contains personal work history (employer names, career trajectory,
  private achievements being used in a job application).
- TripPlanner context contains location data and itinerary details (travel dates,
  destinations, accommodation).
- BlogEngine context contains unpublished drafts and editorial strategy.

Concatenating these context windows before synthesis means any one domain agent's LLM
call has visibility into another domain's private user data. This violates data minimality
and creates a contamination risk where cross-domain inference becomes possible.

## Decision

MetaOrchestratorAgent keeps each domain agent's context window entirely separate.
Synthesis of cross-domain results happens at the output layer only — on the structured
responses that domain agents return, not on their raw conversation histories or API
context.

Concretely:

1. Each domain agent is invoked in a separate API call with its own context window.
   The orchestrator collects the structured responses.
2. The synthesis step receives only the domain agents' output objects (structured JSON
   or text responses), not any conversation history or thread state from the sub-apps.
3. No domain agent response is injected into another domain agent's context window
   at any point.

**Mechanical enforcement:** The isolation is structural — domain agents are called as
independent async calls (Promise.all), each going to their own sub-app API endpoint
with no shared context variable or merged prompt that spans domains.

**The invariant a future contributor must not break:**
> A function or node in MetaOrchestratorAgent must never pass a domain agent's
> `threadId`, conversation history, raw API response body, or sub-app state object
> as an argument or context injection into a different domain agent's invocation.
> Cross-domain synthesis is only permitted on the return values of domain agent calls.

## Consequences

### Gains

- Personal work-history data in cv-builder cannot leak into TripPlanner's LLM context
  and vice versa.
- Each domain agent call is independently auditable.
- New domain agents can be added without re-auditing cross-domain contamination risk.
- Consistent with GDPR data minimality principle.

### Costs

- Synthesis quality is bounded by what structured outputs domain agents expose.
- Cross-domain queries that would genuinely benefit from inter-domain context cannot be
  answered holistically without the user explicitly providing bridging context.
- Orchestrator cannot build a "whole-user" context model across sessions.

### Neutral

- The current MetaOrchestrator routes to one domain agent per command; this ADR governs
  architecture for when cross-domain synthesis is implemented (hero demo).
- Does not affect how individual domain agents manage their own thread history.

## Alternatives considered

| Alternative | Why rejected |
|-------------|--------------|
| Shared context window across all domain agents | Creates cross-domain contamination; personal cv-builder data visible in TripPlanner LLM calls; violates data minimality |
| Per-user "whole-context" store passed to all agents | Same contamination risk; adds a high-value central attack surface |
| Context stripping before cross-domain pass | Brittle; a new field added by a future contributor silently re-introduces contamination |
| Let each domain agent decide what to expose | No enforcement mechanism; consistency depends on individual agent implementations |
