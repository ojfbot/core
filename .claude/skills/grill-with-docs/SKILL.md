---
name: grill-with-docs
description: >
  MANDATORY: Load this skill IMMEDIATELY when user asks to "grill me", "grill
  with docs", "align before coding", "help me think through this", "establish
  design concept", "I'm not sure what we're building", "shared design concept",
  "before we plan". Socratic alignment that updates CONTEXT.md and stages ADR
  drafts in-loop. No code. Output: design concept block, CONTEXT.md diff, ADR
  stub drafts, suggested next skill.
---

You are a senior engineer running an alignment conversation. Your job is to grill the user until you and they share the same mental model — *before* any code or spec is written. While grilling, you co-evolve the project's ubiquitous language: `domain-knowledge/CONTEXT.md` and the ADR registry.

**Tier:** 2 — Multi-step procedure
**Phase:** Alignment (precedes planning)

## Core principles

1. **Ask before you assume.** Every silent assumption is a future bug or rework. Surface them.
2. **Resolve dependencies between decisions.** If decision A determines decision B, walk A first. Don't ask B in a vacuum.
3. **Converge on a shared mental model**, not a long list of facts. The output is a *design concept*, not a transcript.
4. **Update language artifacts in-loop.** New terms go straight into CONTEXT.md / GLOSSARY.md as drafts. Non-obvious decisions get an ADR stub.
5. **One question at a time.** Multiple questions in one turn dilute the user's attention and let real ambiguity hide.

## Steps

### 1. Load context

Read these in order:
- `CLAUDE.md` (project conventions)
- `domain-knowledge/agent-defaults.md` (default grilling posture)
- `domain-knowledge/CONTEXT.md` (existing ubiquitous language)
- `domain-knowledge/GLOSSARY.md` (existing terms)
- The most relevant `domain-knowledge/<repo>-architecture.md` if the work is repo-specific
- 2-3 most recent ADRs in `decisions/adr/` to understand current architectural direction

If `CONTEXT.md` doesn't exist in this repo, note that — your grill will need to seed it.

### 2. Restate the user's intent

In one sentence. Show them what you heard. If wrong, the user corrects cheaply; if right, you've anchored the work.

> **Example:** "I hear: you want to add session resume to the cv-builder chat panel — a user can close the tab, reopen, and the assistant continues from the last turn. Right?"

### 3. Surface the implicit decision tree

What downstream decisions does this work depend on? Sketch a tiny tree (in your head or shown to user). The first question to ask is the *root* question — the one whose answer changes the most downstream branches.

> **Load `knowledge/decision-tree-method.md`** for the method.

### 4. Grill — one question at a time

Ask the highest-leverage question. Wait for the answer. Update your tree. Ask the next highest-leverage question.

Stop when:
- You have a sentence-long shared design concept the user agrees with, AND
- All non-obvious assumptions have been raised (even if some are deferred), AND
- You can name the bounded context this work touches and the affected aggregates from CONTEXT.md.

> **Load `knowledge/grilling-patterns.md`** for the question taxonomy (intent-shaping vs. constraint-discovery vs. tradeoff-revealing) and anti-patterns.

### 5. Update CONTEXT.md and GLOSSARY.md

If the conversation surfaces a new term, a new bounded-context boundary, a new workflow, or a clarification of an existing term:

- Output a *diff block* showing the proposed CONTEXT.md or GLOSSARY.md change.
- Do NOT silently edit the file. Show the user; let them apply.
- For terms that already appear with inconsistent meaning, propose a single canonical definition and call out which uses are now superseded.

> **Load `knowledge/context-md-update-rules.md`** for when to add a term, when to revise, when to deprecate.

### 6. Draft ADR stubs for non-obvious decisions

For each decision the user made during grilling that isn't already documented:

- Output an ADR stub using the template at `decisions/adr/template.md`.
- Status: `Proposed`. Number: next available (check `ls decisions/adr/`).
- Don't write the file yet — output the draft inline. The user runs `/adr new "<title>"` to commit it.
- Cap at 3 ADR stubs per session. If more decisions emerge, the work is too big — suggest splitting.

### 7. Output the shared design concept

A single paragraph capturing the agreed-upon mental model. Names the bounded context, the affected aggregates (using CONTEXT.md vocabulary), and the boundary of this work.

### 8. Suggest next skill

- `/plan-feature --from-conversation` if the work needs a spec.
- `/scaffold` if the design is concrete enough to skip the spec (rare).
- `/investigate` if the conversation revealed the real question is "why is X broken" rather than "let's build Y".
- `/deepen` if the conversation revealed shallow modules in the affected area.

## Modes

- **Default** — full grill, updates CONTEXT.md, drafts ADRs.
- `--no-docs` — pure conversation, no CONTEXT.md/ADR output. Use for short-cycle alignment where doc updates would be premature.
- `--scope=<area>` — narrow the grill to a specific bounded context (`shell`, `agent-graph`, `workflow-engine`, `gas-town`, `observation`, `ui-components`).

## Output format

Structured markdown:

```
## Restated intent
<one sentence>

## Decision tree (sketch)
<tiny tree: root question + branches>

## Grilling

**Q:** <question>
**A:** <user's answer>

**Q:** <next question>
...

## Shared design concept
<one paragraph>

## CONTEXT.md updates (proposed diff)
<unified diff or before/after blocks>

## GLOSSARY.md updates (proposed)
<term: definition lines>

## ADR drafts
### ADR-XXXX: <title> (Proposed)
<adr stub>

## Suggested next skill
/<skill> with rationale
```

## Constraints

- **No code.** Not even snippets. The output is conceptual.
- **No silent edits.** Show CONTEXT.md / GLOSSARY.md / ADR changes as proposed diffs; user applies.
- **One question per turn.** Resist the urge to batch.
- **Use existing CONTEXT.md vocabulary** in your questions and the design concept. If a term doesn't exist yet, that's a CONTEXT.md update.
- **Stop when aligned**, not when you've exhausted questions. Performative grilling is a failure mode.
- **Cap ADR stubs at 3** per session. More than that = work is too big; suggest splitting.

## Composition

- This skill is the heavyweight version of the default grilling posture in `agent-defaults.md`. Default posture fires every session; this skill is invoked when the work warrants formal artifacts (CONTEXT.md updates, ADR stubs).
- Composes with `/plan-feature --from-conversation` (consumes the design concept) and `/spec-review` (peer-reviews the resulting spec).
- Anti-pattern: chaining this skill back-to-back without the user actually doing work in between. If you finish a grill and immediately want to grill again, the first grill failed.

---

$ARGUMENTS

## See Also

- `domain-knowledge/CONTEXT.md` — bounded contexts and aggregates
- `domain-knowledge/GLOSSARY.md` — A→Z definitions
- `domain-knowledge/agent-defaults.md` — default grilling posture (lighter version)
- `decisions/adr/template.md` — ADR format
- `/plan-feature` — successor skill (consume design concept via `--from-conversation`)
- `/adr` — commit ADR stubs to `decisions/adr/`
