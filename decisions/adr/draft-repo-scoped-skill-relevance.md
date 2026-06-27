# ADR (draft): Repo-scoped skill relevance — per-repo `applies_to`/`kind` so the repo installer + suggester filter

slug: repo-scoped-skill-relevance
serial: (unassigned — draft; serial assigned at accept per ADR-0087)
domain: workflow-engine
type: process

- **Status:** Proposed (draft)
- **Date:** 2026-06-13
- **Extends:** `adr:catalog-scoped-user-skills` (the catalog `scope` field + the user-scope install; this is the *repo*-scope analogue). NB: an earlier "ADR-0092" stub bundling this with availability-aware suggestions was superseded and never merged.
- **Related:** ADR-0068 (follow skill suggestions / 0.8% rate), ADR-0081 (loading-discipline rollout — reuse its cadence), ADR-0082 (subagent default-deny), ADR-0037 (telemetry)
- **Seed data:** a 2026-06-13 read-only fleet audit + archetype matrix (one-off, not committed)

---

## Context

ADR-0092 added `scope:["user"]` + availability-aware suggestions, fixing the **user-scope** skill
firehose. But **repo-scope** `install-agents.sh <repo>` still symlinks the **entire** catalog into
every repo regardless of fit. The 2026-06-13 fleet audit confirmed: f1-substrate (Python) was given
`scaffold-frame-app`/`extension-audit`/`rag-audit`/`lint-audit`; **most repos carry 18–26 irrelevant
skills**. Manual `rm` (done for the f1 pair) is reverted by the next `install-agents.sh --force`.
This is the repo-scope analogue of the exact problem ADR-0092 already solved for user-scope, and it
is the structural cause of the routing-rot in ADR-0068.

## Decision (proposed)

1. **Per-repo relevance in the catalog.** Add to each `skill-catalog.json` entry: `lang`
   (`ts`|`py`|`any`) and `applies_to` (repo-name globs and/or `kind` archetypes), reusing `tags`
   where they already carry the signal. Mirrors the `scope` field's "declare once" model.
2. **Per-repo profile.** A tiny `.claude/repo-profile.json` (`kind` archetype, `lang`, `framework`).
   Archetypes from the audit: frame-app · frame-lib · standalone-ts-app · extension · game ·
   python-service · mcp-server · prose · infra.
3. **Filtered repo installer.** `install-agents.sh <repo>` symlinks only relevant skills;
   **fail-open** (unclassified ⇒ installed, never silently dropped; every prune `log`-ed);
   **`--all`** escape restores the firehose. Mirrors 0092's catalog-driven user-scope installer.
4. **Relevance-aware suggestions.** `suggest-skill.sh` filters by the same relevance — extends
   0092's availability-awareness from installed-vs-not to **relevant-vs-not**.
5. **Single source of truth.** Reconcile catalog≠installed: 4 skills (`frame-dev`,
   `scaffold-frame-app`, `orchestrate`, `diagram-intake`) are distributed but uncatalogued — add or
   retire them.

## Consequences

- **Gains:** per-repo curation becomes **durable** (survives `--force`); suggestions become relevant,
  which should lift the 0.8% follow-rate (ADR-0068); closes the routing-rot thesis.
- **Resolves a telemetry ambiguity:** ADR-0092 already documents that inline-followed skills bypass
  the `Skill` tool, so `log-skill.sh` won't record them — the `skill-telemetry.jsonl` staleness is
  **expected post-0092**, not a broken hook. (Earlier f1 notes hedged this as "ambiguous"; it's now
  resolved — fold the correction back.)
- **Costs:** each repo needs a `repo-profile.json` (one-time; the audit already assigned archetypes);
  archetype assignment is judgment, not mechanical.

## Rollout (no mass-delete)

Mirror ADR-0081: **one repo per cycle, PR-gated**. The read-only audit is delivered; phases are:
(1) this ADR → accept; (2) annotate the 52 catalog entries + write `repo-profile.json`s; (3) teach
`install-agents.sh` + `suggest-skill.sh` to filter (fail-open, `--all`); (4) roll out per-repo.
Full plan: `~/selfco/wiki/synthesis/fleet-claude-config-relevance-audit-plan.md`.

## Red-team addenda (2026-06-13 workflow — fold in before implementing)
- **Label/filter independence:** golden labels must NOT derive from the same audit doc as `applies_to`
  (self-consistency theater). Ground contested-band labels in observed usage + a 2nd labeler (κ ≥ 0.7),
  sealed hold-out repo.
- **Suggester architecture:** `suggest-skill.sh` runs `suggest-skills.mjs --limit=1`, so a suppressor only
  ever sees the top-1 winner — a confusion matrix is impossible there. The filter must run **inside the
  `.mjs` against the full scored set** (pre-limit), or gate on a live follow-rate A/B instead.
- **Per-repo worst-case** false-prune ≤1% (never a fleet average); recall/precision on the **contested
  band only** (agent-debug, lint-audit, screenshot-audit, council-review, rag-audit). Demote prune-volume
  to a non-gating diagnostic; gate on identity (which skills), not count.
- **Fail-open fault-injected, not asserted.** Add an **`autonomy_safety` field distinct from relevance**
  (relevance ≠ autonomy-safe — this feeds S4/S5 fail-closed classification).
- This is Slice 2 of `OPAV-LOOP-GATED-SLICE-PLAN-2026-06-13.md`; depends on S0 `SUGGESTION_ID`.

## Future trigger-modality addendum (2026-06-13 DeepStack review — candidate S2.5)

**Distinct from repo-relevance.** This ADR filters *which* skills reach a repo; the addendum below adds *how* a skill is triggered. Filed here because both touch the catalog schema and `suggest-skills.mjs`, but it warrants its own slice and draft ADR (`multi-modal-skill-triggers`) — do not merge it into S2's gates.

**Gap.** Our suggester is **keyword-only**: `suggest-skill.sh` is a `UserPromptSubmit` hook matching query words against `triggers[]`. DeepStack (`~/Research/deepstack`) demonstrates two modalities we lack — **path globs** (auto-suggest on `.env`/`package.json`/`*.tsx` edits) and **lifecycle events** (session-start, post-edit, pr-ready). See `DEEPSTACK-ARCHITECTURE-EVALUATION-2026-06-13.md` §(e).

**Proposed shape (implementable on the existing surface):**
- Catalog schema gains `trigger_paths[]` (globs) and `trigger_events[]` (`session-start` | `post-edit` | `pr-ready`).
- `suggest-skills.mjs` gains a `--path` / `--event` matching branch alongside the existing `--query` scorer (it already loads the catalog and scores the full set).
- Emission rides existing hook surface: `PostToolUse` on `Edit|Write` (the surface `claude-md-gate` already uses) for path triggers; a session-start hook (mirrors DeepStack `on-session-start`) for lifecycle. `install-agents.sh` already wires `PostToolUse` hooks.

**Gating.** Entrance-gated on S0 `SUGGESTION_ID` + S1 action instrumentation, identical to the rest of the ladder — a new trigger surface is unmeasurable until the fire-rate denominator is trustworthy. **Not** a free early win; explicitly *not* the description-prose rewrite the DeepStack handoff proposed (that moves neither Layer A nor Layer B — see the evaluation doc).
