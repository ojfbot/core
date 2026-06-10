# ADR-0091: Semantic link-suggester for cultivate
slug: semantic-link-suggester
serial: 0091
rev:
Date: 2026-06-10
Date accepted: 2026-06-10
Status: Accepted
domain: observation
type: tooling
OKR: 2026-Q2 / O-Knowledge / KR-cross-project-recall
Commands affected: /vault (cultivate mode — second candidate channel)
Repos affected: core (semantic-suggest.py prototype), selfco-box (optional launchd hookup)
traces:
  amends: selfco-vault-and-skill
  relates-to: [control-gated-slices]

---

## Context

`cultivate` is told to hunt "the same idea under two names" — pages that should connect but
never have. The existing `_suggested-links.md` engine (`lint.py --suggest-links`) is
Adamic-Adar on co-citation: by construction it can only rank pairs that already share inbound
links, so it is structurally blind to semantically-near pages that have never co-occurred —
precisely the serendipitous connections cultivate exists to find. The vault tracks
smart-connections and basic-memory as entities but wires neither into the loop.

## Decision

Add an embedding-based suggester as a second, complementary channel — never a replacement:
`semantic-suggest.py` (prototype) embeds each `wiki/` page (title + body head) and surfaces
top-K nearest non-adjacent pairs that share **zero** neighbours in the wikilink graph (the
structural engine owns every co-cited pair, so the channels partition cleanly). Output is a
ranked table the LLM judges into the human-reviewed `wiki/_suggested-links.md` queue —
suggestion-only; the "Considered, declined" discipline and the empty-run-is-a-success rule
are unchanged. Provider: Voyage AI embeddings when `$VOYAGE_API_KEY` is set (content-hash
cache outside the vault, so a daily run only pays for changed pages), with a deterministic
TF-IDF cosine fallback that is loudly labelled LEXICAL so it is never mistaken for the
semantic channel.

**Smart Connections vs batch pass — evaluated:** Smart Connections is an interactive
Obsidian plugin (local embeddings, in-app similar-notes pane) — useful as a *Mac browsing*
surface but unusable for the headless selfco-box cultivate run, and its index is neither
committed nor scriptable. The batch pass is the channel that feeds `_suggested-links.md`;
Smart Connections can still be enabled in-app later as a human-side complement (it competes
with Bases for attention, not with this script). The accepted ADR should confirm this split
after the prototype has run against real cultivate passes.

## Consequences

### Gains
- Closes the gap between what cultivate is instructed to hunt and what its tooling can surface; first prototype run against the live vault already surfaced plausible never-co-cited pairs (e.g. `doerr-okrs-ref ↔ ojfbot-okrs`, `lean-analytics ↔ lean-canvas`) that Adamic-Adar cannot reach.
- The zero-shared-neighbour filter means the two channels never duplicate each other's candidates.

### Costs
- Embedding cost + a provider dependency + cache freshness to manage (mitigated: content-hash cache; the TF-IDF fallback keeps the channel runnable with zero deps and zero spend).
- Semantic similarity surfaces false-positive "thematic" pairs — mitigated by keeping it suggestion-only behind the existing human-review + declined-list discipline.

### Neutral
- Cosine scales differ per provider (~0.5–0.9 voyage vs ~0.0–0.12 TF-IDF); thresholds default per-provider.
- The prototype is read-only against the vault and exits 0 always — it is a candidate generator, not a gate.

## Alternatives considered

| Alternative | Why rejected |
|-------------|--------------|
| Smart Connections plugin as *the* channel | Interactive-only, Mac-only, un-scriptable index — cannot feed the headless daily cultivate run. Kept as a possible human-side complement. |
| Replace Adamic-Adar with embeddings | The structural channel is free, deterministic, and good at co-citation pairs; the channels partition (shared-neighbour vs zero-shared) — union beats either alone. |
| Auto-link high-cosine pairs | Violates the Goodhart guardrail; a high score is a prompt to look, not a mandate to link. |
| basic-memory / external RAG index | The vault is explicitly not-RAG; a persistent external index re-derives per question instead of compiling pages. |

## Provenance

| Field | Value |
| --- | --- |
| Zero-point | selfco `wiki/synthesis/adr-draft-semantic-link-suggester.md` (2026-06-10, vault best-practices audit § Serendipity) |
| Implementation start | 2026-06-10 (core: semantic-suggest.py prototype; selfco-box: optional cultivate hookup) |
| Implementation end | _pending_ (Voyage-provider run + evaluation against real cultivate passes outstanding) |
