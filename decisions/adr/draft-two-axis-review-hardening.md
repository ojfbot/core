# ADR: Harden the two-axis review — fixed-point pinning, parallel axes, Fowler smell baseline
slug: two-axis-review-hardening
serial: draft
rev:
Date: 2026-07-22
Status: Proposed
domain: workflow-engine
type: tooling
OKR: —
Commands affected: /pr-review, /validate (shared smell baseline); /tdd (refactor hand-off point)
Repos affected: core (skills + knowledge); siblings receive via install-agents.sh
gate:
baseline:
traces:
  supersedes:
  amends: [pocock-skill-conventions-and-new-skills]
  relates-to: [tdd-skill, pocock-lifecycle-absorption, wrap-absorb-reject]
  parent:
  part-of-series:

---

## Context

The local review family is already two-axis in intent (`adr:pocock-skill-conventions-and-new-skills`
item 4): `/validate` checks invariants and spec coverage, `/pr-review` audits correctness and
standards, `/spec-review` fact-checks plans pre-implementation. Upstream v1.1's `code-review`
(verdict row D10 in `decisions/adopt-stack/pocock-skills-v1-1.md`) adds three mechanics the local
family lacks:

1. **Fixed-point pinning.** Review runs against `git diff <fixed-point>...HEAD` (three-dot,
   merge-base), with a `git rev-parse` preflight on the ref and a fail-fast on an empty diff —
   review never silently runs against the wrong base or nothing.
2. **Parallel per-axis subagents, reported verbatim.** Standards and Spec run as two independent
   sub-agents; their reports are presented separately and never merged or reranked — "reporting them
   separately stops one axis from masking the other."
3. **A fixed Fowler smell baseline** (Refactoring ch.3: Mysterious Name, Duplicated Code, Feature
   Envy, Data Clumps, Primitive Obsession, Repeated Switches, Shotgun Surgery, Divergent Change,
   Speculative Generality, Message Chains, Middle Man, Refused Bequest) with two binding rules —
   *the repo overrides* (a documented standard suppresses the smell) and *always a judgement call*
   ("possible Feature Envy", never a hard violation; skip anything tooling enforces).

This also completes the tdd divergence recorded in `adr:tdd-skill` rev A: upstream moved refactoring
out of the red-green loop into review; we keep refactor-at-green AND add the review-stage smell
check, so structural feedback exists at both points.

## Decision

1. `/pr-review` and `/validate` gain a **fixed-point preflight**: resolve the base ref with
   `git rev-parse`, diff three-dot from the merge-base, fail fast with a clear message on an
   unknown ref or an empty diff.
2. `/pr-review` runs its Standards and Spec axes as **two parallel sub-agents** whose findings are
   reported under separate headings, verbatim, never merged into a single ranked list. Spec-source
   order: issue refs in the PR/commits → user-passed path → spec files matching the branch under
   `docs/`, `decisions/` → ask; if none, the Spec axis reports "no spec available" rather than
   improvising one.
3. A **shared smell baseline** lands once at `.claude/skills/pr-review/knowledge/smell-baseline.md`
   (12 smells, one "what it is → how to fix" line each, plus the repo-overrides and
   judgement-call rules) and is referenced by both `/pr-review` and `/validate` (one-level
   cross-ref, reuse-over-duplication per `adr:tdd-skill`). The baseline is pasted in full into the
   Standards sub-agent prompt — the sub-agent has no other access to it.

## Consequences

### Gains
- Review results become reproducible (pinned base) and honest about absence (empty diff, missing
  spec) instead of silently degrading.
- Axis separation prevents a noisy standards pass from drowning a single spec-compliance miss.
- The smell vocabulary is deep in model priors; naming a smell ("possible Message Chains") produces
  targeted, checkable feedback at near-zero prompt cost.

### Costs
- Two sub-agents per review costs more tokens than one merged pass; accepted for the masking fix.
- The baseline file must stay in sync with two consumers; mitigated by single-file ownership under
  `pr-review/knowledge/` with `/validate` cross-referencing, never copying.

### Neutral
- `/spec-review` is unchanged — it already is the Spec axis in pre-implementation form.
- The smell check is judgement-only; no lint gate is created (ADR-0089 shadow-first discipline
  would govern any future promotion).

## Alternatives considered

| Alternative | Why rejected |
|-------------|--------------|
| Single merged review report (status quo) | One axis masks the other — a loud style pass buries a quiet spec miss; upstream's separation argument holds locally. |
| Put the smell baseline in `domain-knowledge/coding-standards.md` | Standards doc is repo-wide prose read by humans; the baseline is a review-time sub-agent payload. Different consumers, different lifecycle. |
| Enforce smells as lint-style violations | Fowler smells are contextual by definition; hard enforcement generates false positives and adversarial compliance. Upstream's "always a judgement call" rule is correct. |
| Copy the baseline into `/validate`'s knowledge dir too | Duplication drifts; one-level cross-reference is the established pattern (`adr:tdd-skill` test-patterns precedent). |

## Provenance

| Field | Value |
| --- | --- |
| Zero-point | 2026-07-22 (adopt-stack record `pocock-skills-v1-1.md`) |
| Implementation start | _pending_ |
| Implementation end | _pending_ |
