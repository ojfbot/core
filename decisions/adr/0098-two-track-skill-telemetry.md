# ADR-0098: Two-track skill telemetry: the use-funnel and the evolution stream never blend

slug: two-track-skill-telemetry
serial: 0098
rev:
Date: 2026-07-17
Date accepted: 2026-07-17
Status: Accepted
domain: workflow-engine
type: architecture
traces:
  amends: skill-action-instrumentation

- Deciders: operator (ruling recorded live during the rm:rm-l1-core#S6 gold-set sitting)
- Lineage: revises the measurement semantics of `adr:skill-action-instrumentation` (0095);
  grounded by `decisions/opav/capture-quality-report.json` (the
  `missing-authoring-discriminator` finding, 4/13 gold scenarios)

## Context

The S6 gold-set sitting surfaced a class the disposition model cannot express: sessions that
**edit the suggested skill's own files** — improving, refactoring, or extending its SKILL.md,
knowledge, or scripts. 4 of 13 real scenarios were this class. The capture-quality
discriminator (`opav-capture-quality.mjs detectMaintenance`) already *detects* it, but only to
**exclude** it from use — the signal is then discarded.

The operator's ruling: exclusion from the *use* numerator is correct (editing `adr`'s SKILL.md
is not *using* adr), but discarding it is wrong — **the fleet authoring its own skills is the
generative half of the self-improvement loop** and must be tracked in its own right.

A second defect surfaced: the session×skill discriminator is too coarse for skills whose
*product lives next to their definition*. Gold scenario `66B372CC` edited `skills/adr/SKILL.md`
AND wrote a real numbered ADR in one session — authoring and genuine use, collapsed into one
"maintenance" verdict.

## Decision

1. **Two tracks, never blended.**
   - *Use track* (exists): suggestion → ignored | engaged_no_act | capture_miss | acted.
     Authoring activity stays excluded from its numerator AND denominator.
   - *Evolution track* (new): per-skill authoring events — `skill:authoring`
     `{skill, session_id, ts, files_touched, kind: created|extended|refactored}` — with the
     **join to downstream outcomes** as the point of the exercise: after a skill's definition
     changes, did its suggester precision (S8 eval), follow rate (use track), or audit verdict
     (skill-architecture-audit) move? An edit-count alone is activity theater; the join is
     the loop closing.
2. **`skill-authoring` becomes a disposition terminal** in `classifyDisposition`
   (excluded-from-denominator like `engaged_no_act`), so use-track rows stop mislabeling
   authoring sessions as engaged/capture_miss.
3. **Finer granularity for product-near-definition skills:** within a session×skill pair,
   an artifact matching the skill's `expected_artifact.pathPattern` counts toward *use* even
   when skill-dir edits also occurred; only the skill-dir edits themselves are authoring.
4. Shadow-first (ADR-0086): the evolution stream ships observe-only; no gate consumes it
   before its own capture-quality pass against a labeled set.

## Consequences

- The Loop pane (07) gains an Evolution block (authoring events per skill + outcome joins) —
  a later cockpit slice; eras/tracks labeled, never summed together.
- `rm:rm-l1-core` gains P4 + S16 (registered alongside this draft).
- The gold set's 4 `skill-authoring` scenarios become the discriminator's regression fixtures.
- Accept gate: S16 merged with the discriminator live in the reconciler AND the 4 gold
  scenarios reclassifying correctly; serial assigned then. **Met 2026-07-17** (the S16 PR):
  gold agreement 13/13, capture 9/9, false-emit 0/10 — GREEN, zero regressions.
- Precedence pinned during implementation, by gold labels:
  - `acted` (C2-valid self-report) outranks `skill-authoring` — the decision-3 refinement's
    operational form: an expected_artifact match backed by a self-report counts as use even
    alongside skill-dir edits. An artifact **without** a self-report does NOT flip an
    authoring session to use (gold `66B372CC`).
  - The disposition's authoring signal is **suggestion-scoped** (edits at/after the
    suggestion ts, like `engaged`): a pre-suggestion skill-dir edit does not reclassify a
    later-ignored suggestion (gold `EBE96AA0`). The evolution stream itself stays
    session-scoped and suggestion-independent.
