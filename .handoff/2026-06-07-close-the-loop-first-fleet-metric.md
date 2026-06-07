---
id: 20260607-1020-brief-close-the-loop-metric
type: brief
title: "Close the loop: pick the first fleet metric for closed-loop keep/discard control"
actor: code-claude
to: code-claude
session_id: 2026-06-07T15:20:52Z
refs:
  - url:https://github.com/karpathy/autoresearch
  - file:~/selfco/wiki/synthesis/karpathy-loop-in-ojfbot.md
  - file:~/selfco/wiki/concepts/karpathy-loop.md
  - file:~/selfco/wiki/sources/karpathy-autoresearch.md
  - adr:0086
  - adr:0068
  - adr:0043
  - adr:0060
hook: null
status: live
created_at: 2026-06-07T15:20:52Z
labels:
  origin: selfco-vault-ingest-karpathy-autoresearch
  decision-type: deferred-but-triggered
  next-skill: grill-with-docs
---

# Close the loop: pick the first fleet metric for closed-loop keep/discard control

## Context
On 2026-06-07 we ingested Karpathy's `autoresearch` repo into the selfco vault (filed as
knowledge — see the three refs in `~/selfco/wiki/`). The premise was corrected: autoresearch
is an autonomous **ML-training** loop (one GPU / one file / one metric `val_bpb`), **not** a
knowledge engine. The transferable thing is the **control pattern** — the "Karpathy Loop":
propose → measure → keep/discard on ONE ungameable metric, immutable evaluator, git-as-state,
no human in the loop.

The diagnosis that makes this a real fleet issue: **every metric we have is open-loop.**
`/deep-research` quality, `/skill-metrics` adoption, and `/vault lint` health are all *measured*
but nothing *auto-acts* on the measurement. We have all the ingredients of a closed loop
(ADR-0086 TPM = one metric; `wiki/log.md` ≈ `results.tsv`; worker agents ADR-0043/0060 = the
unattended host; `SKILL.md` = `program.md`) but we never close it. autoresearch is the
existence proof that closing it is cheap **iff** the metric is single + cheap + ungameable by
the agent producing it — which is exactly the part we have not pinned down.

This brief is the **trigger** that keeps "deferred" from silently becoming "dropped."

## Goal
Make the one load-bearing decision: **name the first ojfbot metric to bring under closed-loop
keep/discard control, and its immutable evaluator** — OR explicitly **kill** the harness idea.
There is deliberately **no third "defer again" option.**

Candidate metrics (from the grilling that produced this):
1. **Per-skill prompt eval score** — pick one skill (e.g. `/grill-with-docs`), fix an eval set +
   scorer, let a loop mutate the `SKILL.md` and keep only improvements. *Closest 1:1 analog to
   `val_bpb`; the evaluator is the most controllable.*
2. **`/deep-research` report-quality rubric** — claim-verification rate / citation density /
   contradiction count over a cycle. *Higher value, but fuzzier evaluator and the sequential-run
   constraint binds (see Flag back).*
3. **Vault lint/health score** — orphans, broken links, stale claims, raw-without-source.
   *Cheapest, deterministic evaluator; lowest stakes.*

## Acceptance criteria
- A named metric **and** its evaluator, with a one-paragraph answer to *"how would the agent
  cheat this ruler, and what makes that impossible/detectable?"* — OR a written kill decision.
- If a metric is chosen: a `decision` bead here (and, only if it stabilizes, promotion toward an
  ADR — not before; ADR-0068).
- The selfco synthesis page `karpathy-loop-in-ojfbot.md` updated to record the choice (its
  Implications section currently lists the candidates as open).

## Constraints
- **Knowledge-first / ADR-0068:** do not build a `/autoresearch` harness on spec. Earn it with a
  metric that demonstrably wants closing.
- **Out of scope:** building `/autoresearch`, writing an ADR up front, running the literal GPU
  repo (`train.py`/`val_bpb`).

## References
- `~/selfco/wiki/synthesis/karpathy-loop-in-ojfbot.md` — the full mapping + candidate analysis
- `~/selfco/wiki/concepts/karpathy-loop.md` — the pattern + its open questions
- `~/selfco/wiki/sources/karpathy-autoresearch.md` — primary-source ingest (Critique + Bridge)
- ADR-0086 (`/gated-slice`, MOE→MOP→TPM) · ADR-0043 / ADR-0060 (worker agents = the host) · ADR-0068 (knowledge-first)
- Suggested next move: **`/grill-with-docs`** on the chosen metric — its failure/success-scenario
  output is the right shape for the "how would the agent cheat this?" question.

## Flag back
- **The evaluator-immutability problem is the whole risk.** An LLM-judge evaluator is
  *editable-in-effect* — the producing agent can learn to flatter it. If a candidate's evaluator
  can't be made un-cheatable (deterministic, or adversarial/multi-judge panel), that's a reason to
  reject *that candidate*, not to defer the whole decision.
- **The sequential-deep-research rule binds.** A 2026-06-05 overnight run of 4 concurrent
  ~100-agent `/deep-research` cycles saturated the API and collapsed the verify/synthesize stage.
  Any overnight keep/discard loop inherits this — candidate (2) especially. Do not design a loop
  that fans out concurrent research cycles.
- If, after the grill, **no** candidate survives the cheat-the-ruler question, the correct
  outcome is to **kill the harness idea** and keep only the knowledge pages. That is a success,
  not a failure of this brief.
