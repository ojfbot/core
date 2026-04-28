# ADR-0044: Ubiquitous language layer (CONTEXT.md + GLOSSARY.md)

Date: 2026-04-28
Status: Accepted
OKR: 2026-Q2 / O2 (skill ergonomics) / KR1 (cross-repo design language)
Commands affected: /grill-with-docs, /plan-feature, /investigate, every skill that loads domain-knowledge
Repos affected: all (core, shell, cv-builder, blogengine, TripPlanner, lean-canvas, purefoy, gastown-pilot, seh-study, core-reader, daily-logger, mrplug, frame-ui-components, beaverGame, asset-foundry)

---

## Context

ojfbot has grown to 16 repos with rich vocabulary — `skill`, `bead`, `hook`, `mayor`, `witness`, `GUPP`, `Wasteland`, `prime node`, `frame-agent`, `ModFed`, `convoy`, `molecule`, `formula`, `wisp`, `sling`, `nudge` — without a central definitional layer. Terms are defined in 43+ ADRs, 20 domain-knowledge files, and individual skill knowledge files. Two failure modes:

1. **Agent re-derivation cost.** Every new Claude context window pays the cost of reading multiple files to figure out what a term means. This is wasted tokens and often inconsistent (two readings produce two definitions).
2. **Drift.** When a term gets refined in a new ADR, older docs keep using the old meaning. Over time the language fragments, and we ship code where one module's "hook" is the other's "agent assignment."

Matt Pocock framing (from his "Software Fundamentals Matter More Than Ever" talk) names this as the *ubiquitous language* problem from DDD: a system without a shared, explicit vocabulary becomes verbose, redundant, and increasingly hard to change. He prescribes a `CONTEXT.md` artifact as the canonical source of the project's bounded contexts and terms, co-evolved with code.

We need this layer to ground the new `/grill-with-docs` skill (which references CONTEXT.md as it grills) and to serve every other skill that loads domain knowledge.

## Decision

Add two files to `domain-knowledge/`:

- **`CONTEXT.md`** — bounded contexts (six, drawn by concern not by repo), aggregates inside each, cross-context workflows, universal invariants, naming disambiguation table. Dense bullets and short paragraphs, agent-weighted. Authoritative companion to `frame-os-context.md` (which is the *product* layer; CONTEXT.md is the *language* layer).
- **`GLOSSARY.md`** — A→Z one-liner definitions of every non-obvious term, each with a source cross-reference (ADR or domain-knowledge file).

Both files are symlinked into every sibling repo via `install-agents.sh`, joining the existing universal set (`frame-os-context.md`, `app-templates.md`, `shared-stack.md`, `langgraph-patterns.md`, `workbench-architecture.md`, `tbcony-dia-context.md`, `agent-defaults.md`).

Update protocol: any ADR that introduces a new term or changes a term's meaning must update CONTEXT.md / GLOSSARY.md in the same PR. The `heuristic-analysis.sh` library will (after Phase 1 of the Pocock skills work) flag PRs that touch `decisions/adr/*.md` without touching CONTEXT.md as a Tier 1 suggestion to run `/grill-with-docs`.

## Consequences

### Gains
- Every agent context window starts with the shared language; no re-derivation cost.
- New terms have one canonical location, not three.
- Cross-repo vocabulary stays consistent because all repos read the same symlinked files.
- `/grill-with-docs` has a concrete artifact to update, making the skill actionable rather than purely conversational.
- Drift becomes visible: if `CONTEXT.md` says "hook = Claude Code lifecycle script" and an ADR uses `hook` to mean Gas Town assignment, the disambiguation table must be updated, surfacing the collision rather than hiding it.

### Costs
- One more file to maintain. Mitigated by: (a) it's symlinked, so updates propagate automatically; (b) update is required only when language genuinely changes; (c) `/grill-with-docs` does most of the writing.
- Risk that CONTEXT.md becomes stale if updates lag. Mitigated by the heuristic-analysis Tier 1 rule and a `/doc-refactor` weekly cadence.
- Two contexts may want the same word (we found `hook` already collides). Resolved by the explicit naming-disambiguation table — collisions are documented, not squashed.

### Neutral
- Terms not yet appearing in CONTEXT.md continue to be defined ad-hoc in their original location until their first co-edit. The migration is incremental, not big-bang.
- Per-repo `CONTEXT-<repo>.md` files (for repo-local terminology) are explicitly deferred. The universal CONTEXT.md is enough for now.

## Alternatives considered

| Alternative | Why rejected |
|-------------|--------------|
| Single file (CONTEXT.md only, glossary as appendix) | Heavier to load when only the glossary is needed. Two files allow each to be loaded independently. |
| Auto-generated GLOSSARY.md (script reads CONTEXT.md headings + ADR titles) | Rigid format; loses the cross-reference precision and the "1-2 sentence definition" affordance. Script could be added later if maintenance load is high. |
| Per-repo `CONTEXT-<repo>.md` only (no universal) | Pushes vocabulary fragmentation deeper. Universal first; per-repo if we hit a real conflict later. |
| Fold language layer into existing `frame-os-context.md` | That file is the product layer (vision, repos, demo tracks, status). Mixing language and product overloads it; agent context windows pay more to extract either. |
| Skip the language layer entirely; rely on ADRs and domain-knowledge files | Status quo — failed. Demonstrably we don't read all 43 ADRs every session, and the cost of re-derivation keeps compounding. |

## Distribution and lifecycle

- Lives in core: `domain-knowledge/CONTEXT.md`, `domain-knowledge/GLOSSARY.md`.
- Symlinked via `install-agents.sh` into every sibling repo's `domain-knowledge/`.
- Updates land in core; siblings see them on next read (symlink, not copy).
- `--force` re-installs after a rename or directory restructure.
- Edited via `/grill-with-docs` when grilling surfaces new vocabulary; via `/doc-refactor` for quarterly normalization; manually as needed.
