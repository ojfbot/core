# ADR-0050: Skill metrics measurement system

Date: 2026-04-28
Status: Accepted
OKR: 2026-Q2 / O2 (skill ergonomics) / KR5 (close the feedback loop)
Commands affected: /skill-metrics (new)
Repos affected: core (script + skill); siblings consume via install-agents.sh

---

## Context

ADRs 0044–0049 set adoption targets for the Pocock skills (≥10 grill invocations / 30d, ≥50% sequencing rate, etc.) but shipped without an automated way to check those targets. The targets sit in ADR text — readable, not measurable. After ~30 days I'd be doing manual `jq` queries against `~/.claude/skill-telemetry.jsonl` and inventing the methodology each time.

Two related infra pieces already exist:

- `~/.claude/skill-telemetry.jsonl` — every `skill:invoked` event, written by `log-skill.sh` PostToolUse(Skill) hook
- `~/.claude/suggestion-telemetry.jsonl` — every suggest-skill match/ignore, written by `suggest-skill.sh` UserPromptSubmit hook
- `pr-skill-audit.sh` — runs in CI, currently fetches `origin/telemetry/daily` if it exists, runs heuristic analysis, posts a comment

What's missing: a calculator that turns the JSONL into adoption numbers, with the targets baked in, so "did we meet ADR-0045's grill target" is one command, not a 20-line ad-hoc query.

A second concern surfaced while validating the script against current data: **the suggestion-followed rate is 2.9%** (1 of 34) — much lower than I'd expected. That's only visible because the script computes it; it would have stayed invisible without this work.

## Decision

Ship three things:

1. **`scripts/skill-metrics.mjs`** — pure-Node calculator. Reads `~/.claude/skill-telemetry.jsonl` and `~/.claude/suggestion-telemetry.jsonl`. Computes:
   - Invocation counts per skill (filters knowledge/template/reference loads)
   - Delta vs `--baseline` (snapshotted JSONL file)
   - Sequencing pairs (skill A precedes skill B within session, configurable window)
   - Suggestion-followed rate (within 5min, same session)
   - Targets-vs-actual table (ADR-defined targets baked into the script's `TARGETS` constant)
   - Markdown (default) or JSON (`--format=json`) output

2. **`/skill-metrics` skill** at `.claude/skills/skill-metrics/skill-metrics.md` — wraps the script with interpretation. Includes `knowledge/interpretation-guide.md` mapping observed patterns (low invocations, high suggested + low followed, etc.) to recommended actions. Ships ADR target table inside the skill body.

3. **First baseline report** at `docs/skill-metrics-2026-04-28.md` — committed to the repo. Frozen-in-time receipt of what we measured today. Future reports compare against this.

**ADR target table location:** in the script's `TARGETS` constant. When ADRs 0044–0049 (or future ADRs) change a target, that change goes in two places: the ADR text and the script's `TARGETS` constant. The script is the source of truth for what gets *measured*; the ADR is the source of truth for what we want to *be*. They must agree.

**Cadence:** the skill is invoked deliberately, not auto-suggested. Recommended cadence:
- Weekly — quick run, eyeball deltas, drop into a session note
- Monthly — full run, council-review the findings, write follow-up ADR if a target needs adjustment
- Retrospective (e.g. 30-day Pocock retro 2026-05-28) — full run + interpretation, lands as the retrospective ADR

**CI integration (deferred):** the existing `claude-skill-audit.yml` workflow could be extended to include a "trends" section in PR comments using `--format=json`, but only once `origin/telemetry/daily` is being populated regularly. That's a separate ADR if/when we automate telemetry-to-branch syncing.

## Consequences

### Gains
- ADR targets become *checkable* (`pass` or `gap`). The 30-day retro is a script invocation, not an ad-hoc analysis.
- Real signal we wouldn't have seen otherwise: the 2.9% suggestion-followed rate is actionable.
- Reproducibility: any session can run the script, get the same answer (deterministic from the same inputs).
- Honest baseline. Today's report shows zero adoption for the Pocock skills — the truth, captured at PR time.
- Knowledge-load filtering distinguishes user-driven invocations from internal hook traffic, so reported numbers match what humans expect.
- The interpretation-guide makes the metrics useful even to a future agent who hasn't seen this session — "here's what 0% suggestion-followed means, here's what to do."

### Costs
- One more skill in the catalog (40 → 41). Mitigated by being tier 2 / phase `observation` and not auto-suggested.
- Targets duplicated between ADRs and the script. Mitigated by clear ownership convention (ADR is what we want; script is what we measure; both must agree on the number).
- Script is heuristic — relies on `:knowledge:`, `:templates:`, `:references:` patterns to filter, not strict event metadata. If the hook's logging format changes, the filter may need updating. Acceptable for now; can be tightened with strict event types if telemetry schema changes.
- The "5-minute follow window" for suggestion-followed rate is somewhat arbitrary. Real follows might happen later in the same session. We'll see in the data; ADR can adjust.

### Neutral
- The script reads from `~/.claude/`, not the repo, because that's where Claude Code writes telemetry today. CI access requires `origin/telemetry/daily` syncing — separate concern.
- Script output is deterministic given the same input. Re-running won't drift.

## Alternatives considered

| Alternative | Why rejected |
|-------------|--------------|
| jq one-liners in the ADR retrospective | Worked once, ages badly. Re-running 30 days from now would be a new analysis, not a comparable measurement. |
| External tool (Grafana, Datadog) | Way out of scope; telemetry isn't shipped off-disk. JSONL → markdown is the pragmatic step. |
| Embed targets in `.github/workflows/skill-audit.yml` | Workflow is for PR-time audits, not retrospectives. Different cadence, different audience. The skill + script run from any session. |
| Auto-suggest /skill-metrics when targets due | Adoption metrics aren't time-bound from the hook's perspective. Manual invocation aligned to milestones is the right cadence. |
| Skip the script; run `/council-review` on raw telemetry | Council-review is for documents, not data. Wrong tool. |
| Persist target table in `skill-catalog.json` | Conflates skill metadata (tier, triggers, phase) with measurement targets. Different concerns; targets belong with the calculator. |
| AST-parse skill output to detect escalations / refactor proposals | Would be ideal but doesn't exist in the telemetry schema. Logged events only show "skill X was invoked," not what it produced. Out of scope; could be a future ADR if we extend the hook. |

## Implementation notes

- **Script:** `scripts/skill-metrics.mjs` (~400 lines, no deps). Tested manually against current telemetry; output saved to `docs/skill-metrics-2026-04-28.md`.
- **Targets:** copied from ADRs 0044–0049 + the Pocock plan's "Success metrics" section. Subject to the same update protocol as the ADRs (an ADR change requires a script change in the same PR).
- **Filter heuristic:** matches `:knowledge:`, `:templates:`, `:references:` substrings in the `skill` field. If a skill's structure adds new subdir conventions, update both the heuristic and this ADR.
- **Sequencing pairs:** configurable via `--pairs="from1,to1;from2,to2"`. Default tracks ADR-0045's `/grill-with-docs → /plan-feature` claim. Add pairs as new ADRs introduce new compositions.
- **Pair window:** default 3600s (1hr), per the ADR-0045 claim. Adjust via `--pair-window=N` for ad-hoc queries.
- **Baseline:** today's snapshot is `~/.claude/skill-telemetry-baseline-2026-04-28.jsonl`. Re-snapshot at major milestones (e.g. after the 30-day Pocock retro) to define new windows.

## What this enables next

The 30-day Pocock retrospective (originally planned as ADR-0050 but renumbered when this measurement system took that slot) becomes ADR-0051. Its work is:
1. Run `/skill-metrics --since=2026-04-28 --until=2026-05-28`
2. Read the targets-vs-actual table
3. For each missed target, apply `interpretation-guide.md` to recommend an action
4. Write the retro ADR documenting what we observed, what we'll change, what we'll measure next window

That whole flow is now scripted. The 30-day retro takes minutes, not hours.
