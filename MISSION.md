# MISSION

Not interrogated with questions this round — the operator dismissed the question set, supplied the
primary transcript excerpt directly, and named what interested them. That *is* the interrogation,
and re-asking would have been ceremony.

## The signal, in their words

> "it's interesting to me that he says (1) hasn't been written about a lot yet (2) background is
> functional programming (3) algebra for agents"

Three pointers, and together they name one thing: **the design has an intellectual lineage, and the
lineage predicts the shape.** Not "what is a dynamic workflow" — that is a feature description. The
interest is in *why the operators are what they are*, in an area with no secondary literature to
lean on.

## The capability

**Choose correctly between the composition operators when designing a fan-out, and say why the
runtime forbids what it forbids.** Concretely: given a task, decide sequence-vs-parallel and defend
it; and explain why the workflow runtime throws on `Date.now()` rather than treating that as a
quirk.

## Why this placement

The operator has the Workflow tool in-session and has never used it — the fleet has **zero**
references to dynamic workflows in any skill, ADR, or decision record (grepped 2026-08-04). So the
frontier is not "learn that it exists," it is one step past: they can read "algebra for agents" and
cannot yet *apply* it.

The ZPD target is the pair of things that are invisible from the transcript alone but visible in the
live tool contract:

1. **`parallel()` is a barrier; `pipeline()` is not** — and the tool's own guidance is to default to
   `pipeline()`. Boris names sequence and parallel as the two operators; he does not say which to
   reach for, and the wrong default silently wastes most of the fan-out's wall-clock.
2. **Purity is enforced at runtime.** `Date.now()`, `Math.random()`, and argless `new Date()` throw.
   That is not a limitation, it is referential transparency made mandatory so a run can be replayed
   from a journal. This is exactly where "my background is functional programming" stops being
   biography and becomes an observable constraint — the single best evidence for the operator's own
   point (2)→(3).

## Scope

**In.** The algebra (sequence/parallel composition), the barrier distinction, enforced determinism
and why resume needs it, and the loops-vs-routines split.

**Out of the lesson, into `reference/`.** Everything else Boris covered — the self-maintenance
routine fleet, abstraction police, test-time-compute framing, the agent counts. Breadth is real and
was explicitly asked for, but per D24 it belongs in a document that gets revisited, not in a lesson
that gets read once.

**Not claimed.** The operator asked for "everything Boris covered here." The supplied excerpt is one
segment of a ~36-minute talk. The reference covers the excerpt faithfully and says so; it does not
pretend to cover the talk.

## The test of success

Hand them a fan-out task. They can say which operator it wants, name the cost of choosing the other,
and predict what would break if the script called `Date.now()`.
