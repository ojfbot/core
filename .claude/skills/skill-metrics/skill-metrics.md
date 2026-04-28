---
name: skill-metrics
description: >
  MANDATORY: Load this skill IMMEDIATELY when user asks to "skill-metrics",
  "how is adoption going", "are we using the new skills", "skill telemetry
  report", "skill adoption metrics", "are the targets met". Computes adoption
  metrics from ~/.claude/skill-telemetry.jsonl + suggestion-telemetry.jsonl
  via scripts/skill-metrics.mjs. Output: invocation counts, sequencing pairs,
  suggestion-followed rate, targets-vs-actual against ADRs 0044-0049.
---

You produce honest skill-adoption metrics. Read the JSONL telemetry, run the calculator, interpret the output against the targets the ADRs claim. No fabricated numbers — if the data doesn't show adoption, say so.

**Tier:** 2 — Multi-step procedure
**Phase:** Continuous / observation

## Core principles

1. **Numbers come from the script, never invention.** If the telemetry is empty, report empty. Aspirational metrics in ADRs are not observed metrics.
2. **Distinguish raw events from user invocations.** Knowledge-file loads are logged as `skill:invoked` but they're not user-driven. The script filters them; surface this in your output.
3. **Show gaps, don't hide them.** The whole point is to see what's not working.
4. **Recommend one action at a time.** If multiple targets are missing, pick the most leveraged one to address first.

## Steps

### 1. Run the script

```bash
node scripts/skill-metrics.mjs --baseline=~/.claude/skill-telemetry-baseline-2026-04-28.jsonl
```

For different windows:
```bash
node scripts/skill-metrics.mjs --since=2026-04-28 --until=2026-05-28
```

For JSON output (CI / further processing):
```bash
node scripts/skill-metrics.mjs --format=json > /tmp/metrics.json
```

For specific sequencing pairs beyond the default:
```bash
node scripts/skill-metrics.mjs --pairs="recon,deepen;tdd,deepen"
```

### 2. Read the output

The script produces six sections:
- **Totals** — raw events vs filtered user invocations
- **Invocations by skill** — top 20, normalized names
- **Delta vs baseline** — change since `--baseline` was snapshotted
- **Sequencing** — A→B pairs within session, with target pass/fail
- **Suggestion-followed rate** — overall + per-skill, within 5min of suggestion
- **Targets vs actual** — table mapping ADR-defined targets to observed values + gaps

### 3. Interpret against ADRs

> **Load `knowledge/interpretation-guide.md`** for the mapping from observed numbers to recommended actions. Examples:
> - Low invocations + low suggestion-followed rate → review suggest-skill triggers
> - High invocations + low sequencing rate → users invoke skills but not in the intended composition
> - High suggestion-followed rate → suggestions are landing; cohort can grow

### 4. Recommend one action

Single highest-leverage move. Examples:
- "The 2.9% suggestion-followed rate is the biggest gap. Audit the heuristic-analysis.sh tier rules — Tier 1 should be reserved for cases where the suggestion was clearly the right next step."
- "`/grill-with-docs` is at 0 invocations. Either nobody's seen the new skill, or its triggers aren't matching. Check whether it appears in skill-loader's filtered list and whether the prompt-prefix overlaps anyone's actual phrasing."

### 5. Save the report

```bash
node scripts/skill-metrics.mjs --baseline=~/.claude/skill-telemetry-baseline-2026-04-28.jsonl \
  > docs/skill-metrics-$(date +%Y-%m-%d).md
```

The report is the receipt — it's what we measured, frozen in time, queryable later.

## Output format

```
## Snapshot — <date>

<one-paragraph summary: total invocations, top skill, biggest gap>

## Targets summary
<count of pass/fail across all ADR targets>

## What's working
- <observation backed by numbers>

## What's not working
- <observation backed by numbers, with the specific number>

## Recommended next action
<single highest-leverage move>
<who/what/when actionable>

## Full report
<inline the markdown from the script, or link to docs/skill-metrics-<date>.md>
```

## Constraints

- **Never invent numbers.** Run the script. If it errors, report the error.
- **Distinguish raw events from filtered.** Most readers see "30 events" and assume 30 user invocations; the script's filter to ~6 invocations is non-obvious. Always surface both.
- **Don't recommend more than 1 action.** A long list dilutes attention.
- **Frame gaps in terms of the ADR target, not your opinion.** "ADR-0045 wants 10 grill invocations / 30 days; we have 0" is grounded. "We need more grill invocations" is hand-wavy.

## Composition

- Run after milestones (post-PR-merge, post-deploy, post-sprint).
- Pairs with `/techdebt` (file gaps as debt items if recurring).
- Pairs with `/sweep` for weekly cadence.
- Output is read by humans; consider running `/council-review` on a major retrospective report.

## Cadence

- **Weekly:** quick run, eyeball the deltas, drop the markdown into a session note.
- **Monthly:** full run, `/council-review` the findings, write follow-up ADR if a target needs adjustment.
- **Retrospective (e.g. 30-day Pocock retro):** full run + interpretation, lands as ADR-0050+ retrospective.

---

$ARGUMENTS

## See Also

- `scripts/skill-metrics.mjs` — the calculator (no deps, JSONL → markdown/JSON)
- `knowledge/interpretation-guide.md` — observed numbers → recommended actions
- `~/.claude/skill-telemetry.jsonl` — invocation source (user-level, append-only)
- `~/.claude/suggestion-telemetry.jsonl` — suggestion source
- `~/.claude/skill-telemetry-baseline-2026-04-28.jsonl` — Pocock baseline snapshot
- `decisions/adr/0044-ubiquitous-language-layer.md` — language layer ADR
- `decisions/adr/0045-grill-with-docs-skill.md` — `/grill-with-docs` ADR
- `decisions/adr/0046-tdd-skill.md` — `/tdd` ADR
- `decisions/adr/0047-deepen-skill.md` — `/deepen` ADR
- `decisions/adr/0048-triage-skill.md` — `/triage` ADR
- `decisions/adr/0049-pocock-mode-extensions.md` — mode extensions ADR
- `decisions/adr/0050-skill-metrics-system.md` — this measurement system
