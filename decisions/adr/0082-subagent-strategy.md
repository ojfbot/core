# ADR-0082: Subagent strategy — when `.claude/agents/` vs skill vs workflow engine

Date: 2026-06-04
Status: Proposed
OKR: [TBD — Q2 / workflow-engine hygiene]
Commands affected: /council-review, /pr-review, /orchestrate, install-agents.sh
Repos affected: core (canonical agents/), cv-builder (.agents/ + 3 subagents), all repos (distribution)

---

> **Stub — proposed for a later `/grill-with-docs` session.** Scaffolded 2026-06-04 from the Newline "Setting Up Claude Code" config audit (`~/selfco/wiki/synthesis/newline-setup-vs-ojfbot-claude-config.md`). Not a finished decision.

## Context

The fleet has invested heavily in **skills** (47 in core) and **hooks** (16 scripts), but barely in **subagents**: only `core` defines one (`queued-prompt-executor`) and `cv-builder` three. The Newline course lesson teaches `.claude/agents/` as a first-class power feature for three jobs: (1) **tool isolation** (a reviewer with `tools: [Read, Grep, Glob]` that physically cannot write), (2) **cheaper-model delegation** (run a simple pass on Haiku), (3) **context isolation** (keep a large analysis out of the main session).

The fleet currently does review work as *skills* (`council-review`, `pr-review`) — invoked in the main context, with the main session's full tool access. The lesson's canonical example (a read-only `code-reviewer` subagent) is a genuinely unfilled surface: a reviewer skill can be prompted "don't edit," but a subagent with a restricted tool list *can't* edit, which is a stronger and auditable guarantee.

This is muddied by **three overlapping mechanisms** that all look like "delegate to a sub-process": `.claude/agents/` (Claude Code subagents), cv-builder's `.agents/registry.json` (programmatic NL-triggered automation — a *different* system, see core `CLAUDE.md` § "The `.agents/` system"), and `/orchestrate`'s 4-layer agent pipeline + the `@core/workflows` TS engine. There is no written rule for which to reach for.

## Decision

*(Direction, not yet ratified.)* Define a **decision rubric**: reach for a `.claude/agents/` subagent when you need *tool restriction*, *model downgrade*, or *hard context isolation*; reach for a **skill** when you need a reusable, interactively-invoked workflow with full tooling; reach for the **workflow engine / `/orchestrate`** when you need deterministic multi-agent fan-out/control-flow. As a first concrete adoption, promote the read-only review path to a tool-restricted `code-reviewer` subagent that `council-review`/`pr-review` delegate to, and distribute it via `install-agents.sh`.

## Consequences

### Gains
- Auditable least-privilege for review/analysis (can't-write beats told-not-to-write).
- Cheaper passes via model downgrade where quality allows.
- A clear answer to "skill vs subagent vs orchestrate," reducing the current ad-hoc choice.

### Costs
- A fourth thing to distribute and keep coherent (`install-agents.sh` already handles skills/hooks/domain-knowledge/decisions; agents/ would join it).
- Risk of re-implementing as a subagent what a skill already does well — net complexity if the rubric isn't disciplined (cf. the bitter lesson / `[[heresy-vibe-coded-codebases]]`: don't add a mechanism the model's native delegation already covers).

### Neutral
- cv-builder's `.agents/` system stays *complementary* (event/NL-triggered automation), not merged with `.claude/agents/`; the rubric must name the distinction so they don't get conflated.

## Alternatives considered

| Alternative | Why rejected (tentatively) |
|-------------|----------------------------|
| Keep review as skills only | Loses the auditable tool-restriction guarantee the lesson's example provides; the main session retains write access during "review." |
| Use `/orchestrate` + TS engine for everything | Heavier than needed for a single read-only pass; orchestration is for deterministic multi-step fan-out, not a lone restricted reviewer. |
| Do nothing (skills + hooks are enough) | Defensible given the bitter-lesson caution, but leaves the tool-isolation use-case unserved and the skill-vs-subagent choice undocumented. |
