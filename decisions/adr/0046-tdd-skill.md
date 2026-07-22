# ADR-0046: Skill /tdd for red-green-refactor enforcement
slug: tdd-skill
serial: 0046
rev: A
domain: workflow-engine
type: tooling

Date: 2026-04-28
Status: Accepted
OKR: 2026-Q2 / O2 (skill ergonomics) / KR2 (feedback-loop discipline)
Commands affected: /tdd (new), /test-expand, /scaffold, /deepen
Repos affected: all

---

## Context

The Frame skill catalog has `/test-expand` (plans coverage, no enforcement) and `/scaffold` (wires types/stubs, no business logic). Neither enforces the *discipline* of test-driven development: write the failing test, watch it fail for the right reason, make the smallest change to green, refactor at green.

Without that discipline, the agent's instinct (and ours) is to write the production code first and bolt tests on after. Bolted-on tests:
- Tend to assert on what the code already does, not on the behavior we wanted
- Skip edge cases the code doesn't already handle
- Can pass without exercising the actual change
- Don't surface design problems (heavy mocking, awkward setup) early — by the time we notice, we've already shipped the bad design

Pocock's `/tdd` skill (mattpocock/skills) addresses this with a turn-by-turn loop. The agent's job is to keep the user on the rails: red, green, refactor, repeat. When the loop fights back (heavy mocks, 30-line setup for a 1-character fix), that's signal about design — escalate to `/deepen` rather than fight the test.

We adopt this with one significant deviation from Pocock's typical posture: **guidance, not gatekeeping.** Strict enforcement (refusing to edit until red exists) is the right call for production-ready features but the wrong call for prototyping, exploration, and one-line bug fixes. We preserve user agency.

## Decision

Ship `/tdd` at `.claude/skills/tdd/tdd.md` with two knowledge files:
- `knowledge/red-green-discipline.md` — what counts as a valid red, what counts as the smallest change, what to do when the loop slows down
- `knowledge/escalation-triggers.md` — eight specific triggers (three awkward tests in a row, heavy mocking, one-character fix with thirty-line test, intermittent flakes, missing infrastructure, user skip, can't state assertion, long-running test)

The skill cross-references but does not duplicate `../test-expand/knowledge/test-patterns.md` (Vitest patterns, Zod schemas, mocks). Reuse over duplication.

Loop: restate behavior → locate test file → write failing test → confirm red is for *expected* reason → smallest change to green → refactor candidates (await user approval) → postflight escalation check.

Modes:
- Default — full loop, one test per turn.
- `--watch` — `pnpm test:watch <pattern>` driven loop.
- `--scope=<file>` — limit code changes to a single file.
- `--no-refactor` — skip the refactor offer; minimal-change only.

**Strictness:** guidance only. The skill does not block edits when the user explicitly says "skip TDD." It notes the deferred test in the output so it isn't lost.

Heuristic rule (already shipped in PR #81): Tier 3 suggestion when PR diff includes `src/.*\.ts` files but no `*.test.ts` files — surfaces missed TDD opportunities post-hoc.

Postflight: if 3+ tests in a row trigger escalation criteria, suggest `/deepen` on the affected module. The shallow-design signal that emerges from awkward tests is the most valuable byproduct of this skill.

## Consequences

### Gains
- Behavior changes get tests *first*, which means tests that actually exercise the new behavior — not tests that retroactively assert what the code happens to do.
- Heavy-mocking and awkward-setup signal surfaces early, while there's still cheap-to-change architecture under the test. Routes into `/deepen` rather than into accumulated tech debt.
- Regression safety nets accumulate naturally as a side-effect of feature work.
- Telemetry: `/tdd` invocation count is a leading indicator of feedback-loop discipline. Plan target: ≥5 invocations across all repos in 30 days.
- Composes cleanly with `/scaffold` (structure first) and `/test-expand` (coverage planning).

### Costs
- TDD adds turns. A "small" change becomes 2-3 turns instead of 1. Mitigated by `--no-refactor` and the explicit user-skip path; not every change needs the full loop.
- Risk that the skill feels prescriptive and gets ignored. Mitigated by guidance-only stance and clear escalation criteria — the skill earns its keep when it surfaces design problems, not when it slows down small fixes.
- Risk of over-mocking when the test is hard to write. Mitigated explicitly in `escalation-triggers.md` § Trigger 2 (heavy mocking) — the skill names the trap.

### Neutral
- The skill does not run tests itself (the agent runs them via Bash). The skill captures the *discipline*; the test runner stays whatever the project uses.
- Cross-references `/test-expand/knowledge/test-patterns.md` rather than copying it, accepting the small fragility of that link in exchange for not duplicating ~150 lines of Vitest patterns.

## Alternatives considered

| Alternative | Why rejected |
|-------------|--------------|
| Strict enforcement (refuse edits until red exists) | Wrong tradeoff for prototyping and one-line fixes. Friction without payoff for the small-change case. Pocock's tone is closer to enforcement; we deviate deliberately. |
| Fold TDD into `/test-expand` | `/test-expand` is read/plan only; adding edit behavior conflates concerns. Two separate skills compose better — plan with one, drive with the other. |
| Symlink `test-patterns.md` from `/test-expand/knowledge/` into `/tdd/knowledge/` | Symlinks across skill knowledge dirs are fragile in distribution (install-agents.sh would need to recreate them). Cross-reference via "See Also" achieves the same recall without the fragility. |
| Skip TDD as a skill entirely; rely on `/test-expand` planning + agent judgment | Status quo failed. Bolted-on tests are the default outcome without explicit loop discipline. |
| Embed TDD as a mode on `/test-expand` | Conflates planning (which `/test-expand` does well) with implementation discipline. Modes are for related-but-distinct flavors; this is a different operation. |

## Implementation notes

- Skill catalog entry already shipped in PR #81 (tier 2, phase `implementation`, layer-affinity `[2, 3]`, `suggested_after: ["/scaffold", "/plan-feature"]`).
- Heuristic rule already shipped in PR #81 (Tier 3 when source-only diff lacks tests).
- 30-day retro will measure: invocation count, escalation-trigger fire rate, downstream `/deepen` usage following TDD escalation.
- Knowledge files load JIT — only `test-patterns.md` (cross-reference) loads when test setup is needed; `red-green-discipline.md` and `escalation-triggers.md` load when the loop runs into trouble.

## Revision A (2026-07-22) — absorb upstream v1.1 seams + anti-patterns; keep refactor-at-green

Verdict rows D8–D9 in `decisions/adopt-stack/pocock-skills-v1-1.md`; upstream pinned at `ed37663`.

**Absorbed** (from upstream `skills/engineering/tdd/SKILL.md`, `tests.md`, `mocking.md`; re-expressed
in a new `knowledge/seams-and-anti-patterns.md`):
- **Pre-agreed seams.** Test only at seams agreed with the user before any test is written — the
  fewest seams, at the highest level that still exercises the behavior; the ideal number is one.
  Composes with spec-time seam confirmation (`adr:pocock-lifecycle-absorption`): when a spec already
  names the seams, the loop inherits them instead of re-negotiating.
- **Tautological-test anti-pattern.** An assertion that recomputes the expected value the same way
  the code does proves nothing; expected values must come from an independent source of truth.
- **Horizontal-slicing anti-pattern.** Writing all tests first across the surface (horizontal) is
  rejected in favor of vertical tracer bullets — one red→green slice at a time.

**Rejected — the deliberate divergence:** upstream removes refactoring from the loop entirely
("refactoring is not part of the loop… belongs to the review stage"). We keep **refactor-at-green**
(principle 3 of this ADR): the moment of green is when design feedback from the test is freshest and
the diff is smallest. The review-stage structural check upstream relies on ALSO lands locally
(`adr:two-axis-review-hardening` smell baseline), so structural feedback exists at both points —
small cleanups at green, cross-cutting smells at review. Future upstream syncs must not re-litigate
this without new evidence; this section is the recorded reason.
