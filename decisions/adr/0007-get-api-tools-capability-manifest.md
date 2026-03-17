# ADR-0007: GET /api/tools capability manifest contract for all Frame sub-apps

Date: 2026-02-27
Status: Accepted
OKR: 2026-Q1 / O1 / KR1
Commands affected: /plan-feature, /scaffold, /validate
Repos affected: shell, cv-builder, blogengine, TripPlanner, purefoy

---

## Context

Frame OS routes natural language commands through frame-agent's MetaOrchestratorAgent
to the correct sub-app domain agent. For the MetaOrchestrator to route intelligently,
it needs to know what each sub-app is capable of — without that knowledge being hardcoded
in frame-agent's source.

As of 2026-02-27, cv-builder and BlogEngine both expose `GET /api/tools`, but with
a key structural difference:

- **cv-builder** maps each tool to a specific REST endpoint (`POST /api/resume/generate`,
  `POST /api/resume/tailor`, etc.)
- **BlogEngine** routes all tools through a single chat dispatch endpoint
  (`POST /api/v2/chat`) — the agent graph handles internal routing

TripPlanner and purefoy expose no capability manifest at all. MetaOrchestratorAgent
currently has hardcoded tool knowledge for all domains, bypassing the manifest entirely.

Without a canonical contract, each new sub-app implementation diverges. The hero demo
(cross-domain coordination) and any future dynamic tool discovery depend on a stable,
predictable response shape.

## Decision

Every Frame sub-app API must expose `GET /api/tools` returning a JSON manifest
with the following canonical shape:

```json
{
  "service": "string — repo name, lowercase, hyphenated",
  "version": "string — semver",
  "description": "string — one sentence, human-readable",
  "tools": [
    {
      "name": "string — snake_case verb_noun",
      "endpoint": "string — HTTP method + path (e.g. POST /api/resume/tailor)",
      "description": "string — one sentence, what it does",
      "input": { "fieldName": "type description" },
      "deprecated": false
    }
  ],
  "dataEndpoints": {
    "resourceName": "GET|POST path"
  }
}
```

**Tool endpoint convention:** tools point to their specific REST endpoints, not to
a generic chat dispatcher. This is the cv-builder pattern. BlogEngine must be migrated
to this pattern when its agent graph is refactored (tracked in BlogEngine backlog).

**Auth:** `GET /api/tools` is unauthenticated. The manifest is public discovery
metadata, not a protected resource.

**Versioning:** `version` is the API semver of the sub-app's tool interface, not
the app version. Breaking changes to input shapes or endpoint paths increment the
major version. MetaOrchestrator reads this version to detect incompatible manifests.

**Registration:** MetaOrchestrator fetches all registered sub-app manifests at
startup. Sub-app URLs are provided via environment variables
(`CV_BUILDER_API_URL`, `BLOGENGINE_API_URL`, `TRIPPLANNER_API_URL`). If a
registered sub-app is unreachable at startup, frame-agent logs a warning and
falls back to hardcoded tool stubs — consistent with ADR-0008's graceful-degradation
stance. A cv-builder outage must not prevent the gateway from starting.

## Consequences

### Gains
- Sub-app capabilities are discoverable at runtime — adding a new tool to a sub-app
  does not require a frame-agent code change or deploy
- frame-agent MetaOrchestrator can be refactored from hardcoded tool knowledge to
  dynamic discovery without changing the routing logic
- Contract is testable: `GET /api/tools` response can be validated against this schema
  in CI for every sub-app
- Adding a new sub-app to Frame requires only: implement `GET /api/tools` + register
  URL in frame-agent env

### Costs
- BlogEngine's current implementation (all tools → chat dispatcher) diverges from
  the contract. It works today because frame-agent doesn't actually read the manifest,
  but divergence will cause issues when dynamic discovery is implemented
- TripPlanner and purefoy must implement this before they can participate in frame-agent
  routing
- MetaOrchestrator refactor (hardcoded → dynamic) is a non-trivial change that must
  be sequenced carefully — the existing hardcoded routing must remain working during
  the transition

### Neutral
- The manifest is read-only infrastructure metadata. It does not affect how tools are
  actually called — that path is through the domain agent → sub-app API
- REST endpoints for tool calls are preserved unchanged; this ADR only governs the
  discovery layer

## Alternatives considered

| Alternative | Why rejected |
|-------------|--------------|
| Hardcode tool knowledge in MetaOrchestrator permanently | Already doing this; breaks on every new sub-app or tool; requires frame-agent redeploy for any capability change |
| All tools route through POST /api/chat (BlogEngine pattern) | Less machine-readable; MetaOrchestrator cannot call tools directly; hides the actual API surface |
| GraphQL introspection instead of REST manifest | Premature — ADR-0006 (GraphQL federation) is still Proposed; REST manifest is immediately implementable |
| OpenAPI spec instead of custom JSON | Heavier than needed for a 6-tool manifest; `GET /api/tools` is human and machine readable without a parser |

## Implementation checklist

- [x] cv-builder: `GET /api/tools` — shape conforms to this contract
- [ ] BlogEngine: `GET /api/tools` — exists but tools point to chat dispatcher, not specific endpoints (tech debt)
- [x] TripPlanner: `GET /api/tools` — implemented (PR #27, 2026-03-17)
- [ ] purefoy: `GET /api/tools` — not yet implemented
- [ ] MetaOrchestrator: refactor from hardcoded tool knowledge to dynamic manifest fetch (Phase 2)
- [ ] CI validation: add schema test for `GET /api/tools` in each sub-app's test suite
