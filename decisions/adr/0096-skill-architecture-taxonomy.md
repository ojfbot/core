# ADR-0096: Skill architecture taxonomy and recurring audit

slug: skill-architecture-taxonomy
serial: 0096
rev:
Date: 2026-06-18
Date accepted: 2026-06-18
Status: Accepted

<!-- NUMBERING NOTE: authored on branch adr/suggestion-identity-and-denominator, which
predates origin/main's ADR-0094 (deliverable-tracking-spine) + ADR-0095 (skill-action-
instrumentation, both merged 2026-06-14). Local adr-slugs.sh saw max 0093 and mis-assigned
0094 — collision with main. Renumbered to 0096 anticipating those. This branch + ADR must be
REBASED onto current main before merge; re-run `/adr accept` post-rebase to confirm the serial. -->

domain: meta
type: convention
OKR:
Commands affected: /skill-audit, /skill-create, /frame-standup, /skill-loader
Repos affected: core
gate: shadow
baseline:
traces:
  supersedes:
  amends:
  relates-to: [control-gated-slices, follow-skill-suggestions, catalog-scoped-user-skills-and-availability-aware-suggestions, suggestion-identity-and-denominator]
  parent:
  part-of-series:

---

## Context

Anthropic's "Lessons from building Claude Code: How we use skills" proposes a
**nine-category taxonomy** for skills (Library & API reference, Product
verification, Data & analysis, Business automation, Code scaffolding, Code
quality & review, CI/CD & deployment, Runbooks, Infrastructure ops) plus a set of
**authoring tips** (Gotchas as the highest-signal content, progressive
disclosure, model-facing descriptions, don't-state-the-obvious, etc.). The
governing observation: *the best skills fit cleanly into one category; ones that
do too much straddle several and confuse the agent.*

We have 58 skills in `core/.claude/skills/`. A first audit against this framework
surfaced concrete gaps: the catalog had **no classification axis** (only
tier/phase/tags); **5 skills were on disk but absent from the catalog** (drift,
invisible to `skill-loader`/`suggest-skill`); **57/58 skills had no `## Gotchas`
section** despite Gotchas being the single highest-signal content; coverage was
heavily skewed (27 `methodology-meta`, 13 `code-quality-review`) with
**`library-api-reference` absent (0)** and **`product-verification` thin (1)** —
the latter notable because Anthropic reports verification skills have the most
measurable quality impact. Without a durable instrument these findings decay; a
one-off cleanup would drift back within weeks.

## Decision

Add a required `category` field (the nine categories + a `methodology-meta` value
for off-taxonomy skills) to `skill-catalog.json`, build a deterministic
`/skill-audit` instrument (script + rubric) that scores the library and writes to
an append-only log, enforce the conventions at authoring time in `/skill-create`,
and wire a recurring shadow-stage audit into the OPAV loop via `/frame-standup`
plus a weekly launchd job — never gating, observation only, per ADR-0086.

## Consequences

### Gains
- The nine categories become a first-class, queryable axis → coverage gaps and
  straddlers are surfaced mechanically, not from memory.
- `/skill-create` births compliant skills (category + Gotchas + model-facing
  description), so drift stops recurring — the sustainability lever.
- Catalog↔disk drift is now a measured signal (`drift_count`); it was 5, now 0.
- A reproducible split (deterministic D-signals via script; judgment J-signals
  via LLM) keeps the recurring audit cheap and consistent.

### Costs
- A new required catalog field every skill author must set; a small enforcement
  burden in `/skill-create`.
- ~58 skills now carry a tracked backlog (54 missing Gotchas, 11 buried-reference
  D4 fails, 2 straddlers, 2 coverage gaps) — visible debt that must be worked
  down incrementally, not in one pass.
- The `category` assignment for `methodology-meta`-heavy skills is judgment and
  will need occasional revision.

### Neutral
- Most of the library is `methodology-meta` (orientation/planning/writing/
  continuity) — off Anthropic's product/ops-oriented nine. This is acceptable and
  expected; the categories are a gap-finding lens, not a mandate to refactor
  methodology skills into product buckets.

## Alternatives considered

| Alternative | Why rejected |
|-------------|--------------|
| Keep the audit external (no catalog field) | Can't drive a deterministic, scriptable recurring audit; classification would live only in prose and rot. |
| Full classification + refactor every straddler now | Cargo-cults the framework onto methodology skills; large invasive change against Anthropic's own "lens, not mandate" framing. |
| Force every skill into one of the nine | Misrepresents a methodology-heavy library; `methodology-meta` is the honest bucket. |
| Promote the audit to a blocking gate immediately | Violates ADR-0086 shadow-first; rubric needs shadow data to prove low false-positive before any enforcement. |

## Provenance

| Field | Value |
| --- | --- |
| Zero-point | 2026-06-18 — Anthropic skills report audit |
| Implementation start | 2026-06-18 |
| Implementation end | _pending_ |
