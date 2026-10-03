# Skill observation verification notes

Scope: documentation proposal in [PR #501](https://github.com/ojfbot/core/pull/501). The [design](skill-observation.md) is normative. This file records methods, limitations, and review locations; it contains no approval verdict or implementation acceptance.

## Review provenance

The author used `/spec-review`, followed by separate Standards and Spec agents within the author session. Those are author-session agent reviews. Separate agent contexts did not establish independence from the authoring process. They examined the proposal through `4515641`; the next commit appended their reports and was not covered by their verdicts.

The external Claude Code session posted [a review of `b7fe533`](https://github.com/ojfbot/core/pull/501#issuecomment-5964769287), including that appended material. It states its model/vendor independence and shared-account limitation. It requested six corrections. Their dispositions and subsequent review belong on the PR, pinned to the applicable head. Removing the earlier in-file verdict does not erase its git history or establish approval of a later head.

## Executed checks and limits

- Initial investigation: 37 existing capture tests passed in two Vitest suites. The fixtures reproduced missed shell/Codex loads, premature ignored, and ignored surviving later evidence. This tested existing behavior, not the proposed runtime.
- Publication preparation: the capture-suite rerun could not start because Vitest was absent in the isolated worktree. That attempt contributed no test pass.
- At `b7fe533`, GitHub Build & Test, ADR provenance, northstar lint, security checks, and skill audit all reported success. A passing skill-audit job did not prove telemetry capture: its comment reported no telemetry for this PR despite the author-reported workflow artifacts.
- At that revision, local roadmap and northstar lints each returned zero errors and 22 warnings; provenance returned zero errors and three warnings. Forty-five checked relative links resolved, and whitespace checks passed. Those counts describe that revision only.

## Open qualification work

Provider contracts, interval closure, durability, and governed publication remain unqualified. The [delivery handoff](skill-observation-delivery.md) defines the proposed first proof and its registration entrance. No collector, runtime schema, publisher, consumer migration, SC01–SC08 qualification, or remote-recovery behavior has been implemented by this documentation PR.

The repeated ADR-helper path mismatch remains a maintenance follow-up for `.claude/skills/adr/SKILL.md`; fixing skill distribution is outside this design PR. Publication and consumption contracts remain proposed future-slice requirements because both are explicit user requirements, not runtime scaffolding introduced by slice 1.
