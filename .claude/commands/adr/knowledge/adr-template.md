# ADR Template and Example

When any skill needs to produce an ADR stub, load this file and use this format. The file goes in `decisions/adr/` in the repo root. Any skill can reference this template — not just `/plan-feature`.

---

## Format

```markdown
# ADR-XXXX: [Decision title]

Date: YYYY-MM-DD
Status: Proposed
OKR: [e.g. 2026-Q1 / O1 / KR2]
Commands affected: [e.g. /validate, /scaffold]
Repos affected: [e.g. shell, cv-builder]

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

Date: 2026-02
Status: Accepted
OKR: 2026-Q1 / O2 / KR2
Commands affected: all 28 slash commands
Repos affected: node-template, all sibling repos via install-agents.sh

---

## Context

Flat .md command files were growing to 400–600 lines, mixing orchestration logic with
reference material. Claude Code loads the full file for every invocation, wasting context
budget on content only relevant for specific sub-tasks.

## Decision

Each command is a skill directory: <name>.md (orchestration, ≤250 lines) + knowledge/
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
