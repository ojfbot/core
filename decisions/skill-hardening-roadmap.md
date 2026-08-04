# Skill-hardening roadmap — predictability axes over the 68-skill library

Authored 2026-08-03, from the extended audit (`docs/skill-audit/2026-08-03-extended-audit.{md,json}`)
run under the rubric as extended by `decisions/adopt-stack/pocock-writing-great-skills.md` (D26–D36).
Waves follow gated-slice nomenclature: each has Entrance Criteria, Success Criteria as TPMs, and a
named RIDM promotion point. Instruments already exist — nothing here invents a metric.

## Baselines (2026-08-03, all script-measured)

| Axis | Instrument | Baseline |
|---|---|---|
| Deterministic verdicts (D1–D7) | `audit-architecture.mjs` → jsonl | **39 Aligned / 27 Needs work / 2 Refactor** |
| Extended verdicts (J1–J8 folded in) | extended-audit.json | **14 Aligned / 47 Needs work / 7 Refactor** |
| Sprawl (body ≥ 800 w) | shadow D8 | **30/68** skills |
| Total SKILL.md body words | shadow aggregate | **69,464** |
| Total description words (context load) | shadow D10 | **4,349** |
| Negations (prohibition patterns) | shadow D9 | **518** |
| Skills w/ intra-file dup lines | shadow D11 | **3** |
| Missing Gotchas | D3 | **2** (`opm`, `resume`) |
| Suggester frozen-holdout κ | `scripts/suggester-eval.mjs` | **0.603** (n=9; overall 0.658, dev 0.681) — *fresh 2026-08-03 run; the remembered 0.700 was the at-freeze value* |
| Suggestion-followed rate | `skill-metrics.mjs` | 0.8% at ADR-0068; long-horizon axis |

J-signal tallies (Partial/Gap): J1 5/0 · J2 0/2 · J3 11/1 · J4 5/2 · J5 9/0 · J6 4/11 · J7 10/0 · J8 5/5.
Dominant defect class: **J6 sediment — dead pointers** (knowledge files referenced but absent:
`deploy`, `doc-refactor`, `pr-review`, `rag-audit`; See-Also links to nonexistent `<skill>/<skill>.md`:
`tdd`, `triage`, `deepen`, `writing-fragments`; orphaned must-have files never pointed to:
`skill-loader/knowledge/flows.md`, `frame-standup/knowledge/northstar.md`, `bead/references/bead-schemas.md`).

## Non-goals

- No mass description rewrite outside the Wave-2 eval gate. The `MANDATORY:` prefix is an ADR-0068
  countermeasure, not sediment.
- No re-litigation of D1–D25 or the teach-in-the-loop frontier.
- No change to suggest-skills hook behavior.
- Shadow signals D8–D11 stay out of the verdict roll-up until the Wave-3 RIDM promotion.
- Fixes land in `core/.claude/skills/`, never in `~/.claude/skills/` symlinks.

## Wave 1 — Broken disclosure + sprawl (fix class: disclose)

The dead pointers first: they are silent behavior loss (a JIT directive that never loads means the
skill runs without content its author considers load-bearing), zero-risk to fix, and cheap.

- **1a — Dead/weak pointers (11 skills):** create or re-point the four missing knowledge files
  (`deploy` blast-radius, `doc-refactor` mermaid-templates, `pr-review` framework-checks,
  `rag-audit` migration-paths — write the file or delete the pointer, author's call per skill);
  fix the `<skill>/<skill>.md` See-Also pattern (`tdd`, `triage`, `deepen`, `writing-fragments`
  → `SKILL.md` paths, and `/grill-me` → `/grill-with-docs`); wire the orphaned must-have files with
  imperative pointers (`skill-loader` flows.md, `frame-standup` northstar.md, `bead` bead-schemas.md,
  `wayfinder` fleet-substrate.md imperative wording).
- **1b — Sprawl disclosure (worst offenders first):** `merge-quiz` (3113 w, no knowledge/),
  `selfco-ingest` (2955 w, no knowledge/), `speculative-pass` (2557 w), `grill-with-docs` (2381 w),
  `gated-slice` (2016 w), `blind-sweep` (1908 w), then the remaining D4 fails. Push reference down
  per D30; inline only what every branch needs.

Entrance: PR #397 merged (rubric + shadow signals live). Success TPMs: **dead-pointer count = 0**
(verified by a one-off grep pass, then added to the script as a D12 candidate); **D4 pass rate ≥ 95%**
(≤ 3 fails); **sprawl count 30 → ≤ 15**; deterministic Aligned ≥ 55. RIDM point: promote D8 into the
verdict roll-up once the wave's disclosures land without J8 regressions (weak pointers).

## Wave 2 — Description hardening, eval-gated (fix class: rewrite-description)

Small batches (≤ 8 skills each). Per batch: rewrite per D29 (front-load the trigger word, one trigger
per branch, cut body-duplicated identity), then run `pnpm exec node scripts/suggester-eval.mjs` —
**ship only if holdout κ ≥ 0.603 and overall κ does not drop**. Start with the 4 D5 fails (`day-run` —
also missing frontmatter entirely, `frame-dev`, `init` — plus its stale 8-repo table (J6 Gap),
`scaffold-frame-app`) and the longest descriptions (`frame-standup` 102 w desc / 8 triggers).

Entrance: Wave 1 merged (so κ shifts are attributable). Success TPMs: **holdout κ ≥ 0.603 after every
batch** (hard gate); **total description words 4,349 → ≤ 3,500**; **D5 pass rate = 100%**; the eval's
current misses (G01 adr, G13 vault, the summarize over-fires) not worsened — treat fixing any of them
as upside, not a target. RIDM point: if two consecutive batches hold κ while cutting ≥ 15% description
tokens, the D29 style becomes the authoring default in `/skill-create`.

## Wave 3 — Sediment, no-op, and negation pruning (fix classes: prune, add-criteria)

- Close the remaining **J6 Gaps** not fixed by Wave 1: `init` repo table, `lint-audit` pinned
  versions/TD mappings → knowledge or live-derive, `techdebt` allowed-paths drift,
  `daily-logger` four-vs-five phase drift, `workbench` migration note, `scaffold-frame-app` 30-vs-28
  checklist count, `resume` + `opm` missing Gotchas (D3 → 0 fails).
- **J5 no-op pruning** sentence-by-sentence on the worst offenders (`recon`, `summarize`, `push-all`,
  `roadmap`, `setup-ci-cd`, `handoff`) — delete failing sentences whole (D32); findings are
  candidates, confirmed by behavior.
- **J7 completion criteria**: add checkable, demanding bars where flagged (`handoff` step 1,
  `screenshot-audit` "every pair classified", `test-expand`, `scaffold`, `roadmap`,
  `diagram-intake` step-1 confidence checkpoint).
- Negation → positive rewrites where convertible (518 baseline); hard guardrails stay, paired with
  the positive target.

Entrance: Wave 1 merged. Success TPMs: **total body words 69,464 → ≤ 62,500 (−10%)** with **zero
D-signal regressions** (jsonl diff); **missing-Gotchas = 0**; **J6 Gap count 11 → 0**; negation count
trending down (report only — no numeric gate, conversion is judgment). RIDM point: promote D9/D11
into the verdict roll-up if pruned skills show no drift after two weekly pulses.

## Wave 4 — Structural refactors (fix class: split)

The 7 extended-Refactor skills, per the J4/J8 evidence:

- `frame-standup` (3301 w, straddle) — split queue-sweep/dispatch and movement-recording out of the
  morning read; wire northstar.md (Wave 1a) first, split second.
- `gastown` — four modes span four categories; split pilot-UI review from audit/sync.
- `merge-quiz` — delegate the vault-capture step to `/vault`; disclose the question bank mechanics.
- `orchestrate` — extract the GitHub-issue-emission mode; reduce mandatory jq bead bookkeeping to a
  script (D6).
- `opm` — add Gotchas (Wave 3), then decide split vs. documented straddle for its four modes.
- `deploy`, `doc-refactor` — re-verdict after Wave 1a restores their missing content; split only if
  still Refactor.
- Catalog hygiene: `scaffold-app` → `straddle: true` (intentional bundling, documented);
  `fleet-onboard` category `environment` → a rubric value.

Entrance: Waves 1–3 merged (structure decisions on clean bodies, not sediment). Success TPMs:
**extended Refactor count 7 → 0**; straddle flags accurate (every `straddle: true` documented);
suggester κ unchanged after any trigger moves (same Wave-2 gate). RIDM point: none — split decisions
are operator-ratified per skill (movement-contract discipline).

## Wave 5 — Standing: birth compliance + pulse (never closes)

- `/skill-create` already carries checklist items 8–11; every new skill born compliant (verified by
  `--scorecard=<name>` postflight).
- Weekly `skill-architecture-audit` launchd pulse now logs the shadow aggregates — the drift alarm
  for every TPM above. Monthly re-baseline via `weekly-measure.mjs` outputs.
- Extended (full-J) audit re-run: after Wave 3 lands, then quarterly. Compare J tallies against this
  document's baseline table.
- Final RIDM: once Waves 1–3 TPMs hold for a month of pulses, promote D8–D11 from shadow into the
  verdict roll-up and update the rubric's shadow section.

## Cross-references

- Adoption record: `decisions/adopt-stack/pocock-writing-great-skills.md` (D26–D36)
- Scorecard: `docs/skill-audit/2026-08-03-extended-audit.md` + `.json`
- Rubric: `.claude/skills/skill-audit/knowledge/architecture-rubric.md`
- Instruments: `audit-architecture.mjs` (D + shadow), `suggester-eval.mjs` (κ gate),
  `skill-metrics.mjs` (adoption), `~/.claude/skill-architecture-audit.jsonl` (pulse history)
- Wave issues: filed on ojfbot/core (one per wave, linked on creation)
