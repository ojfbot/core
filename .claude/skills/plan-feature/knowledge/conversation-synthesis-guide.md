# Conversation synthesis guide — `--from-conversation` mode

How to extract a spec from a preceding `/grill-with-docs` (or any Socratic alignment) session without losing what the conversation surfaced.

## What you're working from

A conversation transcript with these likely artifacts:
- A *restated intent* sentence the user confirmed.
- A *decision tree* with branches walked and choices made.
- A *shared design concept* paragraph at the end.
- 0–N proposed CONTEXT.md / GLOSSARY.md updates.
- 0–N ADR stubs (Proposed status).

If the conversation came from `/grill-with-docs`, all of these will be present in a structured form. From other Socratic flows (raw user-Claude back-and-forth), they may be implicit — extract them.

## Step-by-step extraction

### 1. Find the design concept

The single paragraph that names the bounded context, the affected aggregates, and the boundary of the work. If `/grill-with-docs` produced a "Shared design concept" section, it's that. If not, write one yourself by compressing what the conversation converged to.

This paragraph becomes the spec's problem statement.

### 2. Surface 3 implicit assumptions

The conversation always leaves something unsaid. Surface the three highest-leverage unstated assumptions before writing the rest of the spec. These are typically:
- Edge cases the user didn't address ("what if the session is older than 30 days?")
- Trade-off endpoints not chosen ("we said cache locally — does that mean offline-first or just local-cache-with-network-fallback?")
- Implementation seams the conversation glossed over ("we said 'use the existing checkpointer' — does the existing checkpointer support per-user state, or do we need to extend it?")

Output them as a numbered list. Wait for user confirmation before continuing past Step 2.

This step is the only deviation from default `/plan-feature`. Default mode skips it because the user's `$ARGUMENTS` is the spec source. With `--from-conversation`, the conversation is the source and assumptions are how you check that you read it correctly.

### 3. Use the decision tree's branches as constraints

If the conversation walked a decision tree, each branch chosen is a constraint on the spec:

- "We picked server-side state" → spec mentions "state lives server-side" in problem statement and acceptance criteria; rejects client-only solutions in "Out of scope."
- "We picked p1 not p0" → severity informs scope (enough to ship safely, not enough to forgo testing).

Don't re-litigate decisions made in the conversation. If you think a decision was wrong, surface it as an open question — but assume the user got it right unless evidence contradicts.

### 4. Lift CONTEXT.md / ADR drafts

If `/grill-with-docs` proposed CONTEXT.md or GLOSSARY.md updates, mention them in the spec's "Architecture" section: "this work introduces the `BeadSession` aggregate (proposed CONTEXT.md addition; pending review)."

If ADR stubs were drafted, the spec's "ADR stub" section should reuse them, not reinvent them. Either include the existing draft inline or say "ADR-XXXX (proposed by `/grill-with-docs`) covers the decision."

### 5. Write the spec body as usual

Steps 3–7 of `/plan-feature` proceed normally — proposed solution, acceptance criteria, test matrix, open questions, ADR stub.

The acceptance criteria should *reflect* the design-concept paragraph: each criterion is a falsifiable statement of one consequence of the design concept.

### 6. Suggest next skill

Default suggestion is `/scaffold`. But if the conversation surfaced shallow modules or test difficulty, suggest `/deepen` or `/tdd` first.

## What to do when the conversation didn't reach a single design concept

Sometimes `/grill-with-docs` ends in ambiguity — two viable directions, no chosen one. In that case:

1. Don't pick one yourself. Tell the user the conversation didn't converge.
2. Output the two directions with a one-line summary of each.
3. Ask the user to pick before you write the spec body.
4. If the user picks, continue normally. If they say "you decide," pick the simpler direction (lower migration risk, smaller blast radius) and note your choice in "Open questions" so they can revert.

## What to do when the conversation contradicted itself

The user may have shifted positions during grilling — that's normal. Take the *last* coherent position as the spec's basis. If you're unsure which is last, list both and ask.

## What `--from-conversation` does *not* do

- Doesn't replace the user's review of the spec. They still confirm acceptance criteria and architecture sketch before `/scaffold`.
- Doesn't auto-commit ADR stubs. Those are still drafts; the user runs `/adr new` to commit.
- Doesn't auto-update CONTEXT.md. Those are still proposed diffs; the user applies via PR.

The mode is a *transformation* (conversation → spec), not an *amplification* (more autonomous behavior).

## Example output (truncated)

```
## Problem statement (synthesized from /grill-with-docs session 2026-04-28)
We need session resume on cv-builder's chat panel — closing the tab and
reopening within 24h restores the last 10 messages and the agent's working
state. State lives server-side (decided in grilling). Targets cv-builder
specifically; cross-app session sharing is out of scope.

## Implicit assumptions surfaced
1. "Session" identity is the existing thread_id — not a new session_id.
   Confirm? [y/n]
2. The 24h window is wall-clock, not user-active time. Confirm? [y/n]
3. State restoration is full (messages + agent state), not partial
   (messages-only with re-derived agent state). Confirm? [y/n]

## Architecture sketch
... (proceeds normally once assumptions confirmed)
```
