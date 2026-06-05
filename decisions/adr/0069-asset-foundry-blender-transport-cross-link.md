# ADR-0069: Cross-link asset-foundry's dual Blender transport contract for fleet visibility
slug: asset-foundry-blender-transport-cross-link
serial: 0069
domain: meta
type: convention

Date: 2026-05-05
Status: Accepted
OKR: 2026-Q2 / O2 — engineering-platform durability
Commands affected: none
Repos affected: core (this ADR), asset-foundry (canonical home), beaverGame (consumer)
References: [asset-foundry/decisions/adr/0011-layered-blender-access.md](https://github.com/ojfbot/asset-foundry/blob/main/decisions/adr/0011-layered-blender-access.md)

---

## Context

asset-foundry exposes Blender execution through a single stable internal contract — `runBlenderScript(opts: RunOptions): Promise<RunResult>` — backed by two peer transports:

- **`SubprocessTransport`** (default) — `blender --background --python …`. Always available; deterministic; the right fit for CI / offline / headless runs.
- **`KernelMcpTransport`** (opt-in) — MCP client over stdio against `uvx blender-mcp`, executing through a *running* Blender instance via `execute_blender_code`. The right fit for interactive / live-viewport / fast-iteration design sessions.

Selection is explicit, not auto-detected: `FOUNDRY_BLENDER_TRANSPORT=subprocess|kernel`. Default stays `subprocess` to preserve CI behaviour.

The full design — selector semantics, the `__file__`/`sys.argv` shim, error semantics, and rationale — is canonical inside asset-foundry's own ADR tree at [`decisions/adr/0011-layered-blender-access.md`](https://github.com/ojfbot/asset-foundry/blob/main/decisions/adr/0011-layered-blender-access.md). That ADR shipped 2026-05 (Status: Accepted) and extends asset-foundry/ADR-0009 (MCP transport stance for outbound tooling).

This core ADR exists because **fleet consumers need fleet-visible decisions**. beaverGame already consumes asset-foundry-produced assets, and additional consumers will appear as the platform spreads. None of those consumers should have to discover the transport contract by reading a sibling repo's ADR tree, and the daily-logger pipeline should not have to rely on commit-message scraping to know an inter-repo contract exists.

## Decision

Cross-link asset-foundry/ADR-0011 from core's ADR registry. Treat the asset-foundry document as the canonical source for any details about transport behaviour, selection, error handling, or future evolution. This ADR carries the *fleet-facing pointer* and the *consumer expectations*; it does **not** duplicate the contract definition.

Specifically, fleet consumers can rely on:

1. The public export `runBlenderScript(opts: RunOptions): Promise<RunResult>` is stable. Implementation transport is invisible to callers.
2. Consumer code does not select the transport. The transport is chosen at session level via environment variable, not per call.
3. Subprocess is always available; kernel-MCP requires a running Blender kernel with the `blender_mcp` addon enabled. Consumers must not assume kernel availability.
4. The contract is owned by asset-foundry. Any consumer wishing to extend the surface (additional `RunOptions` fields, richer `RunResult`) must propose the change against asset-foundry/ADR-0011, not in their own repo.

## Consequences

### Gains
- Cross-repo contract is discoverable through the core ADR index without traversing sub-app trees.
- daily-logger's article-quality verification layer (post-ADR-0068, see daily-logger PR #189) can surface this entry to drafters when commit messages mention `runBlenderScript`, ADR-0011, or transport-selection logic — closing the kind of speculation gap that produced the 2026-05-05 ADR-0011 mis-claim.
- Consumer expectations are stated once, in fleet view, instead of being implicit in each consumer's CLAUDE.md.

### Costs
- Two ADRs now reference the same contract. Drift risk: if asset-foundry/ADR-0011 evolves (e.g., a third transport, or auto-detection), this cross-link must be updated. Mitigation: keep the consumer-expectations list short; defer detail to the canonical ADR.
- Sets a precedent for cross-linking sub-app ADRs from core. Acceptable when the contract is genuinely fleet-cutting (asset-foundry is consumed by ≥1 sibling repo); not warranted for sub-app-internal decisions.

### Neutral
- No code changes. The contract was already stable; this ADR records its fleet-visible status.

## Alternatives considered

| Alternative | Why rejected |
|---|---|
| **Author the contract directly in core** as ADR-0069, with asset-foundry/ADR-0011 deleted or downgraded to a pointer. | Inverts the natural ownership. asset-foundry is the implementer; the ADR belongs where the code lives. core is not the runtime owner of `runBlenderScript`. |
| **Leave asset-foundry/ADR-0011 un-cross-linked.** | Discoverability gap. The 2026-05-05 daily-logger article and a frame-standup Plan agent both made wrong claims about the existence and status of this contract — both had to traverse multiple repos to verify. A fleet-visible record reduces that cost. |
| **Document the contract in `core/CLAUDE.md` Ecosystem table footnotes** instead of a dedicated ADR. | CLAUDE.md is the orientation surface, not the decision record. ADRs are what daily-logger's verification layer (and future tooling) consults; placing this in CLAUDE.md hides it from those tools. |
