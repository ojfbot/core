# MISSION

Second topic from the same source. The operator chose the "large" scope explicitly after being shown
three options, so this is a scoping decision they made with the trade-offs in front of them — not an
inference.

## The capability

**Sort your own always-loaded instructions into keep and cut, and know how to test the call rather
than argue it.**

Concretely: given any line in a `CLAUDE.md` or skill, say which of two categories it is in, and
describe the ablation that would settle it if you're unsure.

## Why this is a different topic from the algebra lesson

Same talk, different blade, and the corpus is topic-keyed (R6). `agent-algebra-dynamic-workflows`
teaches composition operators. This teaches a pruning judgment. Bundling them would make one folder
mean two things and break the supersession story for both.

## The measured baseline this rests on

Taken 2026-08-04, before any of it was taught:

| Always-loaded, every session on this machine | ~tokens |
|---|---|
| `core/CLAUDE.md` | 5,034 |
| `~/.claude/CLAUDE.md` | 1,370 |
| 19 user-scope skill descriptions | 949 |
| **Total, before a word of work** | **~7,350** |

Boris's team file is ~2.5k. The operator's core file alone is roughly double that. **The number is
not the lesson** — a big file is not automatically wrong — but it is the thing that makes the
sorting rule worth learning rather than noting.

## The distinction the secondary coverage flattened

Every write-up reported "80% cut, model got smarter." The primary source carries a qualifier they
dropped: some prompts are kept *because they help product usability and desired behavior when people
use it*. That splits instructions in two:

- **Deficiency patches** — written to correct something the model got wrong. A model upgrade makes
  these dead weight, and they are what the 80% was.
- **House rules** — what *this* operator wants, which no model upgrade supplies. `pnpm` over `npm`,
  grill-before-acting, log deviations, never write northstar `current:` from a slice session.

Most of the operator's 7,350 tokens is the second kind. So the honest lesson is **not** "cut your
CLAUDE.md" — it is that they have been holding one question when there are two, and only one of them
is answerable by deletion.

## Scope

**In.** The two categories, the ablation loop as the tiebreaker, and the honest limit of running it
without evals.

**Out.** Actually cutting anything. This session teaches the sorting rule; applying it to 7,350
tokens of live fleet instruction is the operator's call and would be a separate, gated piece of work.

## The test of success

Hand them three lines from their own `CLAUDE.md`. They sort each one, and for the ambiguous one they
describe the ablation instead of arguing from taste.
