# ADR Template and Example

When any skill needs to produce an ADR stub, load this file and use this format.

## decisions/ namespace convention

Each repo has its own `decisions/` directory for domain isolation:
- `decisions/adr/` — ADRs specific to this repo (create new ones here)
- `decisions/okr/` — OKRs specific to this repo (if any)
- `decisions/core/` — symlink → cluster-wide ADRs + OKRs from the `core` repo (read-only by convention)

When deciding where an ADR belongs:
- **Repo-local** (e.g. cv-builder/decisions/adr/): architectural decisions that only affect this repo or its domain agents
- **Cluster-wide** (core/decisions/adr/): decisions about shared contracts, cross-repo patterns, Module Federation, ADR-0001-style rules

When referencing cluster ADRs from a sibling repo, use `decisions/core/adr/<file>.md`.

---

## Frontmatter schema (ADR-0087 — stable identity + facets)

`slug` is the ADR's **permanent, immutable identity** (the NASA Configuration Item "unchanging base").
The 4-digit `serial` is a **non-load-bearing display number** assigned once at `/adr accept`
(`max(serials)+1`, never reused, reserved, or renumbered). Drafts are `draft-<slug>.md` with
`serial: draft`. Cross-references use `adr:<slug>`, never the number. Evolve a decision with
`/adr revise` (bumps `rev:`), never by renumbering. Full rationale + the SEH↔Configuration-Management
mapping: `decisions/adr/0087-stable-identity-and-facet-tags.md`.

Controlled vocabularies:
- **`domain`** (REQUIRED) = `shell-host-composition | agent-graph | workflow-engine | gas-town-governance | observation | ui-components | meta` (the six ADR-0044 bounded contexts + `meta` for the decision process / cross-cutting platform work).
- **`type`** (REQUIRED) = `architecture | convention | process | infrastructure | policy | tooling`.
- **`status`** = `Proposed | Accepted | Superseded | Deprecated`.
- **`traces`** (optional, bidirectional, every value a slug that resolves on disk): `supersedes`↔`superseded-by`, `amends`↔`amended-by`, `relates-to` (symmetric), `parent`/`part-of-series`.
- **`gate`/`baseline`** (optional NASA lifecycle facets) — `gate: adr-<slug>:C<n>` links to a `/gated-slice` Control Gate; `baseline: functional|allocated|product`.

## Format

```markdown
# ADR-XXXX: [Decision title]
slug: kebab-stable-id
serial: draft
Date: YYYY-MM-DD
Status: Proposed
domain: [bounded-context]
type: [decision-class]
OKR: [e.g. 2026-Q1 / O1 / KR2]
Commands affected: [e.g. /validate, /scaffold]
Repos affected: [e.g. shell, cv-builder]
traces:
  relates-to: []

---

## Context

What situation forced this decision. What constraint, tension, or requirement drove it.

## Decision

What we decided, stated plainly. One clear sentence.

## Consequences

### Gains
What this enables or improves.

### Costs
What this makes harder, slower, or more constrained. Be honest.

### Neutral
Side effects that are neither positive nor negative.

## Alternatives considered

| Alternative | Why rejected |
|-------------|--------------|
| Option A    | Reason       |
```

---

## Completed example

```markdown
# ADR-0003: Skill directories over flat command files
slug: skill-directories-over-flat-files
serial: 0003
Date: 2026-02
Status: Accepted
domain: workflow-engine
type: convention
OKR: 2026-Q1 / O2 / KR2
Commands affected: all slash commands
Repos affected: core, all sibling repos via install-agents.sh
traces:
  superseded-by: skills-directory-rename-from-commands

---

## Context

Flat .md command files were growing to 400–600 lines, mixing orchestration logic with
reference material. Claude Code loads the full file for every invocation, wasting context
budget on content only relevant for specific sub-tasks.

## Decision

Each command is a skill directory: SKILL.md (orchestration, ≤250 lines) + knowledge/
(JIT-loaded reference) + scripts/ (deterministic utilities).

## Consequences

### Gains
- Small default context footprint; heavy reference loaded only on demand.
- Knowledge files independently editable without touching orchestration logic.

### Costs
- A human needs to look in two places to fully understand a command.
- JIT loading creates gaps if the orchestration prompt doesn't explicitly call for the knowledge file.

## Alternatives considered

| Alternative    | Why rejected                                                   |
|----------------|----------------------------------------------------------------|
| Flat .md files | Became unwieldy; no separation of concerns; hard to maintain.  |
| External KB    | Over-fitted for current scale; JIT file loading is simpler.    |
```

---

## When to write an ADR stub in /plan-feature

Write a stub when the feature involves a decision that:
- Affects how more than one module or repo will be structured
- Involves a real trade-off (you rejected at least one other approach)
- Would be confusing to a future reader without context

If the implementation is straightforward and there's only one reasonable approach, skip the ADR.

After the spec is approved, use `/adr new "your title"` to create the actual file in `decisions/adr/`.
