# suggester-gold-v1 — the frozen suggester eval set (rm:rm-l1-core#S8)

27 real prompt→expected-skill pairs mined from `~/.claude/suggestion-telemetry.jsonl`
(2,537 events, 2026-04-12 → 2026-07-17), replayed through the **production scorer**
(`scoreCatalog`, exported by `scripts/hooks/suggest-skills.mjs`) by
`scripts/suggester-eval.mjs`. Every PH3 program change (S10 trigger pruning, S11
relevance filter, S12 forced-eval, S14 description work) is measured against this set.

## Composition

- **27 rows**, of which **10 expected `no-match`** (incl. generic steering prompts,
  structural task-notification noise, and three `summarize` over-fire precision cases).
- **Label provenance is explicit per row** (`label_status` + `labeled_by`):
  - `CONFIRMED` / `behavioral-evidence` (13): the live suggestion was corroborated-followed
    (independent engagement signal) or C2-valid `acted`, AND the prompt→skill link is plain.
  - `PROPOSED` / `agent-judgment` (14): no-match calls, over-fire precision cases, and
    recall-miss cases labeled by inspection — **pending an operator sitting**. The harness
    reports the split so the baseline is honest about what backs it.
- Prompts are the recorded `prompt_prefix` (~120 chars). That is what telemetry preserves;
  the live hook scored the full prompt. Known, stated approximation.

## The frozen holdout

**9 rows carry `split: holdout`. They are OUT-OF-BOUNDS for tuning.** PH3 slices may
inspect and cite `dev` misses only; the holdout number may be *reported* but never used
to choose triggers, descriptions, weights, or filters. If a change is selected because it
helps the holdout, the holdout is burned and a v2 set must be cut from newer telemetry.

## Headline metric: Cohen's kappa (chance-corrected)

Hit-rate flatters at this catalog size (62 active skills; "The 99% Success Paradox" —
selectivity can be near-random while accuracy looks high). The headline is **kappa over
predicted-top-1 vs expected with `no-match` as an explicit class**; top-1 accuracy,
fire-precision, recall@3 and MRR (over the full pre-limit scored set) are secondaries.

## Baseline — 2026-07-17 (catalog @ 62 active skills)

| split | n | **kappa** | top1 | fire-precision | recall | recall@3 | MRR |
|---|---|---|---|---|---|---|---|
| overall | 27 | **0.700** | 0.741 | 0.700 (20 fires) | 0.824 (14/17) | 0.882 | 0.853 |
| dev | 18 | **0.743** | 0.778 | 0.714 (14 fires) | 0.909 (10/11) | 1.000 | 0.955 |
| holdout | 9 | **0.603** | 0.667 | 0.667 (6 fires) | 0.667 (4/6) | 0.667 | 0.667 |

Reproduce: `node scripts/suggester-eval.mjs` (deterministic; `--json` for machine form,
`--check` for the fixture self-test).

### Baseline misses (dev — the PH3 worklist; holdout misses shown but off-limits)

- `G24/G25/G26` — `summarize` fires on prompts with no summarization intent (the
  over-firing tail; live evidence 62 fires / 0 honest follows → S9/S10).
- `G13` — `selfco-ingest` outranks `vault` on a capture-this prompt (rank 2 for vault);
  trigger-overlap collision between the two selfco skills.
- `G19` — `writing-shape` fires on a game-input bug report (trigger-word noise).
- `G01` (holdout) — long instruction paragraph defeats top-1; `G22` (holdout) — a
  rendering-bug report yields no fire (recall gap for /investigate).

## P2 target tracking

`ns:l1-core#P2` targets ≥80% precision on this set (chance-corrected, no-match included).
Current honest read: **kappa 0.700 overall / fire-precision 0.700** — below target, as
expected pre-S10. The number may only be re-published after a PH3 change by re-running
this harness; never hand-edit this file's table without the run.
