# Refactor cost model — weighing the move

Every deepening proposal has a cost and a benefit. This file is the framework for stating both honestly so the user can decide.

## Cost dimensions

### 1. Test impact

How many tests must move, rewrite, or be added?

- **Low:** existing tests target the public surface that survives the move; no test changes needed.
- **Medium:** 1–10 tests need to update their imports or restructure setup.
- **High:** tests target internal pieces that are about to disappear; the test suite must be rewritten against the new surface. (If you're doing this, run the move via `/tdd` so the new tests drive the relocation.)

### 2. Blast radius

How many callers (files outside the deepened module) change?

- **Low:** only the file/package itself; callers don't see the change because the public surface is the same shape.
- **Medium:** 5–30 callers update their imports or call sites.
- **High:** >30 callers, or the change crosses sub-app boundaries (cv-builder calls into a function in shell, etc.). Always ADR-required.

### 3. Migration risk

What can go wrong if the move is partial or interleaved with other work?

- **Low:** new module sits alongside old; both work; old is removed in a follow-up. Reversible at every step.
- **Medium:** there's a flag-day where some callers use new and some use old; partial-merge state is dangerous if interrupted.
- **High:** semantics change — same name, different behavior. Old callers calling the new module silently get wrong results. Avoid; if unavoidable, rename the new module to break the old name.

### 4. ADR required?

Yes if **any** of these are true:
- Change crosses a package boundary (`packages/X` → `packages/Y`)
- Change introduces a new public concept callers must know about
- Change supersedes or contradicts an existing ADR
- Change is irreversible (data format, on-disk schema, public API)

## Benefit dimensions

### 1. Cognitive load delta

The single most important benefit. How much smaller does the affected mental model get?

- Count files an average reader has to traverse to understand the responsibility before vs. after.
- Count exports the public surface presents before vs. after.
- Lower = better. Big deltas (5 files → 1 file, 12 exports → 3 exports) are the most defensible.

### 2. Caller ergonomics

What do callers stop having to know?

- "Callers no longer assemble three calls in the right order — one call now does it."
- "Callers no longer have to remember which of `validateX`, `parseX`, `coerceX` to use — there's now `parseX` that does all three."
- "Callers no longer thread a config object through five layers — the config lives inside the module."

State concretely. "Better ergonomics" by itself isn't a benefit; *what specifically* is.

### 3. Testability

What becomes easier to test?

- Fewer mock dependencies needed (the consolidated module hides what was previously injected).
- The seam where behavior matters is now the public surface.
- Integration tests can replace integration *of* unit tests.

If a proposal *adds* testing complexity, that's a cost, not a benefit. Be honest about which direction it goes.

### 4. Agent ergonomics

Underrated. Does the change reduce token cost for an agent reading this code?

- Fewer files to load to understand a change.
- Public surface that explains itself without requiring all-the-callers context.
- Dense modules that an agent can hold in working memory entirely.

## Weighing the move

Rough heuristic for whether to propose:

| Cost | Benefit | Recommendation |
|------|---------|----------------|
| Low | High | Propose, recommended order = 1 |
| Low | Medium | Propose, recommended order = 2 |
| Low | Low | Don't propose — net change too small to justify churn |
| Medium | High | Propose, recommended order = 2, ADR if cross-package |
| Medium | Medium | Propose only if other proposals are also Medium/Medium and bundling reduces total cost |
| Medium | Low | Skip |
| High | High | Propose, recommended order = 3, mandatory ADR, plan multi-PR migration |
| High | Medium or Low | Skip; the cost-to-payoff ratio is wrong |

## Anti-patterns

**Premature deepening.** Consolidating modules that aren't causing pain. If callers don't complain and the metrics are borderline, leave it.

**Speculative APIs.** Designing the new public surface around hypothetical future use cases. Use what callers do *today* as the surface. The next change can deepen further.

**Rename-only refactors.** Moving code from `foo.ts` to `bar.ts` without consolidation isn't deepening — it's churn. Don't propose unless the rename is part of a real consolidation.

**Bundling unrelated proposals.** "While we're in there, also fix this other thing." No — one proposal per PR, one ADR per cross-boundary move. Bundling makes review harder and increases blast radius.

**Cost handwaving.** "Migration risk: low" without specifics. State the actual risk: what happens if a caller is missed, what happens if the move is interrupted halfway.

## How to write the proposal block

Given a candidate cluster, pick the format that matches the move:

**Consolidation:** "Merge N files into 1; surface the M most-used exports; hide the rest."
**Inlining:** "Inline single-caller helper into its sole consumer; remove the indirection."
**Splitting:** "This file does two things; split into two files, each focused; deepen each via consolidation with adjacent helpers."
**Boundary move:** "This belongs in package X, not Y; move it; update callers."

State the move in one sentence. Then list affected files, proposed surface, costs, benefits.
