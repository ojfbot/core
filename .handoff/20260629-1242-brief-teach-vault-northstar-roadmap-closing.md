---
id: 20260629-1242-brief-teach-vault-northstar-roadmap-closing
type: brief
title: "Teach the selfco vault the northstar schema + the roadmap-closing architecture"
actor: code-claude
to: vault-claude
session_id: northstar-offsite-followup
refs: []
hook: "Ingest the northstar schema + roadmap-closing loop into ~/selfco as durable concept/synthesis pages; promote the two waiting cockpit raw prompts onto it"
status: live
created_at: 2026-06-29T12:42:00
labels:
  project: ojfbot-northstar
---

## Context

The fleet **Northstar Roadtrip** offsite (Slice 2 of `core/decisions/adr/draft-three-tier-northstar.md`)
produced a versioned northstar schema and a working model for how a compass becomes shipped work. The
**selfco vault (`~/selfco`) does not yet understand this model** — so material it ingests can't be
situated against it. This session (run via `/vault` in `~/selfco`) teaches the vault the concept, so
future ingests link to it.

Two source files are **already sitting in `~/selfco/raw/`** waiting to be promoted onto the new concept:
- `raw/prompt-cockpit-northstar-clarification.md`
- `raw/prompt-cockpit-focus-swap-delivery-kickoff.md`
(the "Claude Design audio walk" inputs for the morning-cockpit northstar.)

## The model to teach (the two ideas)

1. **The northstar schema** (canonical: `~/ojfbot/core/decisions/northstar/schema.md`, v1.1). A northstar
   = a compass: vision + named **properties**, each `{target (aspirational), current (0–100, honest,
   evidence-based — NEVER aspirational), verification, ladders_up_to}`. Three tiers L1→L2→L3; refs
   `ns:<slug>#P<n>` resolve-or-fail. v1.1 adds `depends_on` (horizontal peer edge). It is a compass, not
   a plan — it says which way is up, not what to build.

2. **The roadmap-closing architecture** (the loop). The compass + an honest current → **the GAP is the
   roadmap**. The gap is decomposed (/gated-slice or /roadmap) against ONE property; work ships; landing
   + `status.jsonl` records **movement** (recorded, not remembered); the % closes back toward target.
   The fleet offsite is the authoring half (brief → confirm → land via a Notion relay); the closing half
   is decompose → ship → record. "Aspiration in target, honesty in current, the gap is the work" is the
   spine.

## Goal

Author durable vault pages so selfco *holds* this model: a **concept** page for the northstar schema, a
**concept/synthesis** page for the roadmap-closing loop, link them, and promote the two waiting raw
prompts onto the northstar concept (with suggested wikilinks). Establish "northstar / roadmap-closing"
as a vault domain so future northstar/offsite material has a home.

## Acceptance criteria

- [ ] `wiki/` concept page: the northstar schema (cite `core/decisions/northstar/schema.md`).
- [ ] `wiki/` concept/synthesis page: the roadmap-closing loop (compass → gap → slice → land → movement).
- [ ] The two `raw/` cockpit prompts promoted to `wiki/` source pages, linked to the northstar concept.
- [ ] Pages cross-linked; `index.md` / domain entry updated; `/vault lint` clean.
- [ ] No invention — every claim cites a real artifact (schema.md, the offsite docs, the raw prompts).

## References

- file:~/ojfbot/core/decisions/northstar/schema.md — schema v1.1 (the source of truth to teach)
- file:~/ojfbot/core/decisions/northstar/README.md — registry + tier prose
- file:~/ojfbot/core/decisions/northstar/offsite/itinerary.md — the roadtrip/relay model
- file:~/ojfbot/core/decisions/northstar/offsite/schema-evolution-log.md — how the schema sharpens via use
- file:~/selfco/raw/prompt-cockpit-northstar-clarification.md , prompt-cockpit-focus-swap-delivery-kickoff.md — promote these
- adr:draft-three-tier-northstar (in core)

## Flag back

- This is **teaching the vault the model**, not authoring app northstars (those live in their repos) and
  not Phase-2 decomposition. Keep it conceptual + cite-grounded.
- The cluster-tier + semver-ref schema extensions are still only **designed in Notion, not in
  schema.md** (see the offsite schema-evolution-log) — teach v1.1 as-is; note those as pending, don't
  pre-teach unbuilt schema.
- selfco is a separate vault/repo with its own lint scope — `tracking/` is OUTSIDE `wiki/` (l2-selfco
  was deferred, never created).

## Constraints

- Run via `/vault` in `~/selfco` (Karpathy pattern: append-only `raw/` + LLM-owned `wiki/`).
- Repo/schema in `~/ojfbot/core` is ground truth; the vault *references* it, never forks it.
