# ADR-0081: Path-scoped `.claude/rules/` for oversized CLAUDE.md files

Date: 2026-06-04
Status: Proposed
OKR: [TBD — Q2 / workflow-engine hygiene]
Commands affected: /init, install-agents.sh
Repos affected: virtualLight, purefoy, cv-builder, TripPlanner, blogengine, core (the >200-line CLAUDE.md set)

---

> **Stub — proposed for a later `/grill-with-docs` session.** Scaffolded 2026-06-04 from the Newline "Setting Up Claude Code" config audit (`~/selfco/wiki/synthesis/newline-setup-vs-ojfbot-claude-config.md`). Not a finished decision.

## Context

The fleet uses **zero `.claude/rules/` directories** — instructions live entirely in per-repo `CLAUDE.md` (always-loaded), `domain-knowledge/` symlinks (loaded on demand by skills), and the 47-skill catalog. The Newline course lesson recommends splitting a `CLAUDE.md` that "grows too large" into path-scoped `.claude/rules/<area>.md` files with YAML `paths:` frontmatter, so Claude loads only the rules relevant to the files it's touching — saving always-on context.

That advice has real purchase in exactly one place here: **6 `CLAUDE.md` files exceed the lesson's ~200-line ceiling** — `virtualLight` (389), `purefoy` (377), `cv-builder` (366), `TripPlanner` (339), `blogengine` (310), `core` (303). Every line of these is loaded into context every session in that repo, including rules that only apply to one subtree (e.g. cv-builder's LangGraph-node rules when editing a Carbon component; core's `/techdebt` allowlist when editing a skill prompt).

The open question is whether this is a genuine gap or whether the existing domain-knowledge-symlink + skills architecture is a **deliberate rejection** of path-scoped rules (one that should be recorded as "why we don't" rather than fixed).

## Decision

*(Direction, not yet ratified.)* Adopt `.claude/rules/` **only** for repos whose `CLAUDE.md` crosses a size trigger (~200 lines), moving subtree-specific rules out of the always-loaded `CLAUDE.md` into path-scoped rule files, while keeping the cross-cutting invariants (grill posture, pnpm, ubiquitous-language) in `CLAUDE.md`. Make the trigger a `/init` (or a `/sweep`/`lint-audit`) check that flags oversized `CLAUDE.md` and proposes a split.

## Consequences

### Gains
- Lower always-on context cost in the largest repos; rules load only when their `paths:` match.
- A natural home for subtree-specific conventions that currently bloat `CLAUDE.md`.

### Costs
- A **second instruction surface** to keep coherent with `CLAUDE.md`, skills, and `domain-knowledge/` — risk of drift and "where does this rule live?" ambiguity (the ubiquitous-language concern).
- `install-agents.sh` would need a rules-distribution story if any rules are fleet-universal (most won't be — rules are inherently repo-local).

### Neutral
- Overlaps conceptually with `domain-knowledge/` (on-demand) and skills; the boundary (rules = passive path-scoped constraints; skills = invoked workflows; domain-knowledge = reference) must be drawn explicitly.

## Alternatives considered

| Alternative | Why rejected (tentatively) |
|-------------|----------------------------|
| Keep everything in `CLAUDE.md` | The 6 oversized files pay always-on context for rules that apply to one subtree; the lesson's critique lands. |
| Move subtree rules into `domain-knowledge/` instead of `rules/` | `domain-knowledge/` is loaded by skills explicitly, not auto-matched by edit path — doesn't give the "only when editing src/api/" behavior. |
| Record "why we don't" and adopt nothing | Viable for repos under the line; the 6 oversized ones still want *some* answer. This ADR exists to force that choice, not foreclose it. |
