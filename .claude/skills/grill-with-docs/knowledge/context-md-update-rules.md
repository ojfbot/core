# CONTEXT.md update rules

When grilling surfaces vocabulary, the right move is usually a CONTEXT.md or GLOSSARY.md update — not a code comment, not a one-off explanation in the conversation. The vocabulary needs to outlive this turn.

## When to add a new term

Add a term to GLOSSARY.md when:
- It appears (or will appear) in code, ADRs, skills, or other domain-knowledge files
- Its meaning isn't obvious from a single look at the code
- A new agent context would have to re-derive the meaning to use the term correctly

Don't add:
- One-off project nicknames that won't survive past this PR
- Words whose meaning is exactly the standard English/CS meaning ("function," "variable," "test")
- Terms used by only one person in one conversation

## When to revise an existing term

Revise (in place, with the date noted) when:
- A grill surfaces that the term is being used inconsistently — propose a single canonical meaning and note which past uses are now wrong.
- An ADR explicitly redefines the concept (link the ADR).
- The term has drifted: the code uses it for a slightly different concept than the docs claim.

Don't revise:
- To make the wording prettier — leave it.
- To match someone else's project's naming conventions — Frame's vocabulary wins at every boundary.

## When to add a bounded context

Adding a 7th bounded context to CONTEXT.md is a big move. Add only when:
- The grill surfaces a cohesive set of aggregates that don't belong in any of the existing 6 contexts.
- That set has its own internal language that conflicts (or risks conflicting) with the existing language.
- An ADR is being written for the new boundary.

Otherwise, fold the new aggregate into the closest existing context.

## When to deprecate / remove

Remove a term when:
- The concept has been removed from the codebase.
- The term has been renamed and the new name is in use everywhere — leave a note in GLOSSARY.md ("**Deprecated:** see <new-term>") for one release cycle, then delete.

## Output: propose a diff, don't edit silently

The grilling skill never edits CONTEXT.md or GLOSSARY.md silently. Always output the proposed change as a diff block:

```
## CONTEXT.md updates (proposed)

In § Bounded contexts, under "3. Workflow Engine":

- Add to **Aggregates**: `BeadSession` — file-based per-session record produced
  by the bead-session.sh hook. Captures decisions, gotchas, and reports for
  inter-session continuity.
```

Or for GLOSSARY.md:

```
## GLOSSARY.md updates (proposed)

Add under § B:

**BeadSession** — file-based per-session record from bead-session.sh hook.
Captures decisions, gotchas, reports for inter-session continuity.
(`bead/bead.md`, ADR-0043)
```

The user reviews and applies. This keeps the language layer auditable — every term change is a deliberate edit.

## Cross-references

When you add a term, link to its source:
- ADR number if the term comes from a decision: `(ADR-0033)`
- Domain-knowledge file if it comes from an architecture doc: `(daily-logger-architecture.md)`
- Skill file if it's a skill primitive: `(bead/bead.md)`

Cross-references rot less than prose definitions. They give the next reader a path to verify.

## Disambiguation

If a term has different meanings in two bounded contexts, *do not* pick a winner — both are valid. Add both to GLOSSARY.md, distinguished by parenthetical:

```
**Hook (Claude Code lifecycle)** — Shell script bound to a Claude Code event...
**Hook (Gas Town)** — Pointer attached to an agent indicating which bead...
```

Then add a row to the Naming Disambiguation table in CONTEXT.md.

The collision is information; squashing it would lose that information.

## When you're not sure

If you're unsure whether a term qualifies for CONTEXT.md or GLOSSARY.md, the safer call is *not* adding. False additions clutter the language layer; honest omissions cost nothing — the term will resurface later if it matters.

Err on the side of fewer, better terms.
