# 0001 — the agent algebra, and why its runtime forbids the clock

Date: 2026-08-04
Lesson: 0001-agent-algebra.html
Supersedes:
Status: recorded

## Prior knowledge disclosed

- The operator **dismissed the mission question set** and instead supplied the primary transcript
  excerpt with a pointer to what interested them. That is a disclosure in itself: they did not want
  scoping questions, they wanted the source read properly.
- What they flagged, verbatim: *"it's interesting to me that he says (1) hasn't been written about a
  lot yet (2) background is functional programming (3) algebra for agents."*
- Implied by the ask ("get the resources and branching suggestions of what to follow captured into
  vault"): the intent is **accumulation for later action**, not immediate application.

## Evidence

Interrogation-free this round, so the evidence is thinner than lesson 0001 of the previous topic —
and it is worth being exact about what it does and does not support.

**What the three-item pointer demonstrates.** Those three quotes are not the memorable ones. The
memorable lines in that excerpt are the agent counts — "thousands," "the work of dozens or hundreds
of engineers." The operator skipped every headline number and picked out the *lineage* claim and the
*under-documented* claim. That is a reading for structure over spectacle, and it is the reason the
lesson targets the operators and the purity constraint rather than the capability.

**What it does not show.** No evidence about what they can already do with the mechanism. The fleet
has zero references to dynamic workflows, so the working assumption is near-zero hands-on exposure —
an inference from absence, not a disclosure.

**No quiz evidence.** The lesson has not been taken. Nothing here reflects what landed.

## Corrected misconception

**None recorded yet.** One anticipated, stated so a later record can confirm or refute:

> Anticipated, unconfirmed: that `pipeline` means "slower, sequential" and `parallel` means "faster,
> concurrent" — the reading the English words invite. The lesson argues the opposite is usually
> true, because `parallel` is a *barrier* and idles every fast branch at each stage boundary. If
> this lands, the tell is the operator reaching for the data dependency ("does stage N need all of
> stage N−1?") rather than for a speed intuition.

## Still open

- **The capability is untested.** Can they take a real fan-out and choose the operator, cold? No
  evidence either way.
- **The purity argument is the fragile half.** It is inferred from observable runtime behaviour
  (`Date.now()` throws; resume replays an unchanged prefix), not from anything Boris said about
  determinism. The inference is sound but it is *mine*, and a learner who repeats it as Boris's
  claim would be overstating the source. Worth probing directly.
- **Untested against a real run.** Neither the operator nor this session has executed a dynamic
  workflow. Everything is read off a transcript and a tool contract — the same limitation lesson
  0001 of the previous topic had, and the most likely place the model breaks on contact.
- **The loops/routines half got reference treatment, not teaching.** It is the part with a live
  fleet analogue (`decisions/loops/loops.md`, `launchd`), so it is arguably the more actionable
  half, and it was deliberately not taught. If the follow-up interest lands there rather than on the
  algebra, the placement was wrong.
- **Scope honesty carried forward.** The operator asked for "everything Boris covered." What exists
  is one supplied excerpt of a ~36-minute talk. The reference says so; a future session should not
  read the corpus entry as complete coverage.
