# ADR-0054: Standup funnel measurement (suggestion → closure)

Date: 2026-04-28
Status: Proposed
OKR: 2026-Q2 / O2 (skill ergonomics) / KR5 (close the feedback loop)
Commands affected: /frame-standup, /skill-metrics, /bead, scripts/hooks/standup-emit.mjs
Repos affected: core (skill bodies, hooks, telemetry, ADR registry)
Depends on: ADR-0050 (skill-metrics measurement system), ADR-0053 (bead-aware /frame-standup)

---

## Context

ADR-0050 shipped the skill-adoption measurement system. The first run against live telemetry surfaced a stark number: **2.9% suggestion-followed rate** (1 of 34 skill suggestions followed in the last 30 days; only `/init`). Counting invocations alone tells us *that* skills aren't being used — not *what* would help. We need a sharper signal that ties skill invocations to *completed work*.

`/frame-standup` is the highest-leverage observation point in the catalog because:
1. **User-driven.** Users invoke it deliberately every morning; it doesn't fire on weak signals like the suggest-skill heuristic does.
2. **Structured output.** Step 7 emits a defined list of suggested follow-up actions per priority, with rationale, target skill, and (post-ADR-0053) optional bead linkage.
3. **Concrete closure.** A standup suggestion is "done" when either the linked bead reaches `closed` status (per ADR-0053) OR the underlying priority is absent from the next standup's audit. Both signals are real evidence of completion.
4. **Already integrated with /orchestrate dispatch.** Step 7 already routes selections into Layer 1 orchestrator prompts; we just need to add observability to that path.

Without this measurement we can ship more skills (Pocock work) but never know whether they are reducing the cost of a quality delivery.

## Decision

Add a **four-stage funnel** to `/frame-standup`'s Step 7 dispatch:

| Stage | Signal | Capture mechanism |
|-------|--------|-------------------|
| **Suggested** | `/frame-standup` Step 7 emits an interactive action option | New `standup:suggested` event in `~/.claude/standup-telemetry.jsonl` (PR-X1) |
| **Launched** | The suggested skill is invoked within 24 hours, correlated by session_id and skill name | Existing `skill:invoked` event in `~/.claude/skill-telemetry.jsonl`; correlator in `/skill-metrics --funnel=standup` (PR-X2) |
| **Addressed** | The skill ran without erroring out (= launched in v1; refined later if data shows mid-flow failures) | Implicit in skill-telemetry; v1 treats launched ≡ addressed |
| **Closed** | (a) Linked bead reaches `closed` status (per ADR-0053) OR (c) the priority absent from the next standup's audit | New `standup:closed` event; emitted by `/frame-standup` next-day audit walk (PR-X2) and by bead-emit on bead lifecycle close (PR-X3) |

### Closure signal: combined (a) + (c)

- **(a) bead-status closed** — strong signal; relies on ADR-0053's bead-aware standup writing a bead per suggestion. PR-X3 wires bead-emit to also write a `standup:closed` event when a bead with `standup_id`/`suggestion_id` references transitions to `closed`.
- **(c) audit-disappeared** — fallback signal; PR-X2's next-day `/frame-standup` walks the last 7 days of `standup-telemetry.jsonl` filtering `closed=false`, then checks each pending suggestion's `priority_id` against today's surfaced priorities. If absent, emit `standup:closed` with `closure_signal=audit-disappeared`.
- Combined: bead-status takes precedence when `bead_id` is present in the original `standup:suggested` event; otherwise fall back to audit-disappeared. Suggestion remains `pending` until either fires; this avoids double-counting.

### Telemetry file

Separate `~/.claude/standup-telemetry.jsonl` (not merged into `skill-telemetry.jsonl`). Different lifecycle, different retention story, different schemas. `/skill-metrics --funnel=standup` reads both files and correlates by `session_id` (when standup and skill ran in the same Claude Code session) and `time delta` (24-hour window from suggested to launched).

### Telemetry shape

```json
{
  "ts": "2026-04-28T22:00:00Z",
  "event": "standup:suggested",
  "standup_id": "stnd-2026-04-28-a3f1",
  "suggestion_id": "s1",
  "skill": "/plan-feature",
  "priority_id": "p3-cv-builder-session-resume",
  "rationale": "session-resume blocker called out in diagram intake",
  "session_id": "<from CLAUDE_SESSION_ID env or empty>",
  "source": "frame-standup",
  "expected_outcome": "spec written, ready to scaffold",
  "bead_id": "cv-stnd-..."
}
```

PR-X2 adds `standup:closed`:

```json
{
  "ts": "...",
  "event": "standup:closed",
  "suggestion_id": "s1",
  "closure_signal": "bead-status" | "audit-disappeared" | "explicit",
  "closure_evidence": "bead bvr-1234 closed at ..." | "priority not in 2026-04-29 standup",
  "session_id": "...",
  "source": "frame-standup"
}
```

### Implementation in three PRs

- **PR-X1 (this PR's foundation):** ADR-0054, `scripts/hooks/standup-emit.mjs`, CONTEXT.md/GLOSSARY.md vocabulary, `/frame-standup` Step 7 emits `standup:suggested` events. No funnel math, no closure logic.
- **PR-X2 (audit-disappeared closure + funnel math):** Branched from a base with PR-X1 + PR #87 (skill-metrics.mjs) merged. `/frame-standup` audits yesterday's pending suggestions, emits `standup:closed` events for audit-disappeared cases, and `skill-metrics.mjs` gains `--funnel=standup` mode that reads both telemetry files and reports per-suggestion funnel rates.
- **PR-X3 (bead-status closure):** Depends on PR #88's ADR-0053 implementation. Wire `bead-emit` to also write `standup:closed` events when a referenced bead's lifecycle reaches `closed`.

## Consequences

### Gains
- First measurable tie between skill invocations and completed work, not just usage.
- Drop-off rates per stage expose whether the problem is adoption (low launch) or efficacy (high launch but low closure).
- The funnel is the natural unit for ADR-0050's "30-day retro" — replaces the ad-hoc target table with per-suggestion outcome data.
- Reusable shape: any future dispatcher (`/diagram-intake`, `/orchestrate`) can emit the same event class once we prove the pattern with `/frame-standup`.
- Combined (a)+(c) closure resists the "marked done because lost interest" failure mode. Bead-status requires actual lifecycle progression; audit-disappeared requires the priority no longer being in the next standup's surface. Both are evidence-of-completion, not self-reporting.

### Costs
- One more telemetry file to manage. Mitigated by JSONL append-only, user-level, no remote sync needed for v1.
- Three-PR sequence means full closure picture isn't visible until PR-X3 lands. PR-X1 produces no funnel report — just establishes the wiring. Acceptable tradeoff for clean separation of concerns.
- `session_id` correlation is fragile when standup and skill run in different Claude Code sessions (user closes terminal, opens new session, runs the suggested skill). PR-X2 will need to fall back to bead-id linkage in those cases. v1 documented as "best-effort" for cross-session correlation.
- `standup-emit.mjs` is a side-effect inside `/frame-standup` Step 7 — must never break skill flow if it errors. Implementation wraps in try/catch with `process.exit(0)` on any failure path.

### Neutral
- `standup-emit.mjs` is a JSONL appender for now (mirrors `log-skill.sh` pattern). Bead-emit would be the right backend long-term but requires Dolt SQL server on port 3307; PR-X3 can switch to bead-emit when ADR-0053 lands.
- The 24-hour launched window is a guess. PR-X2's `--funnel=standup` will accept a `--window` flag so we can tune from data.

## Alternatives considered

| Alternative | Why rejected |
|-------------|--------------|
| Auto-fire on every skill invocation regardless of source | Conflates intentional dispatch with weak-signal heuristic suggestions. We already have suggest-skill telemetry showing 2.9% follow rate; adding more weak-signal data doesn't help. The funnel only matters for *deliberate* user dispatches. |
| Track launch only (skip closure) | Adoption without efficacy is the trap we're already in. Counting "X people clicked the button" without "did it ship?" was the original sin of ADR-0050's TARGETS. |
| Single closure signal (bead-status only) | Forces dependency on PR #88's ADR-0053 implementation before any signal is captured. The audit-disappeared fallback (c) ships the day PR-X2 lands; bead-status (a) lands later. Combined gets value sooner. |
| Single closure signal (audit-disappeared only) | Suggestions whose priorities legitimately recur (e.g. "review test coverage daily") would never close. Bead-status is the explicit closure path for those cases. |
| Manual `/standup-close <suggestion-id>` (option d from grilling) | Lowest data quality (relies on user remembering); rejected during grilling in favor of (a)+(c). |
| Per-stage timing (latency from suggested to closed) | Out of scope for v1. PR-X2's report will include timestamps so this is computable later without schema changes. |
| Push telemetry to `origin/telemetry/daily` branch as part of PR-X1 | Different concern (CI integration vs measurement infra); separate ADR. The funnel is locally-computed for now; CI reads the same JSONL only if/when telemetry-to-branch is wired up. |

## Implementation notes

- `standup-emit.mjs` writes to `~/.claude/standup-telemetry.jsonl` (override via `STANDUP_TELEMETRY_PATH` env for testing).
- `standup_id` format: `stnd-<YYYY-MM-DD>-<short-hash>`. Generated once per `/frame-standup` invocation; reused across all suggestions in that standup.
- `suggestion_id` format: `s1`, `s2`, ... per standup. Cheap, readable; collision risk is per-standup which is fine.
- `priority_id` is free-text from the standup's Step 5 priority list. Not a structured ID; PR-X2's audit-disappeared check matches by string.
- `/frame-standup` Step 7 modification: insert one `standup-emit suggested` call per generated option, before the AskUserQuestion fires. This logs ALL suggestions, not just selected ones — matters because a suggestion ignored (not selected) is also signal about adoption.
- 30-day Pocock retrospective (originally drafted as the next ADR after 0049) becomes a downstream consumer of this funnel. The retro will read both `skill-telemetry.jsonl` (existing) and `standup-telemetry.jsonl` (new, this ADR) to produce the adoption × efficacy report.
