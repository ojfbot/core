# ADR-0035: Daily-cleaner inference budget cap

Date: 2026-03-29
Status: Proposed
OKR: 2026-Q1 / O2 / KR5 (operational cost governance)
Commands affected: N/A (GitHub Actions workflow: daily-cleaner.yml)
Repos affected: daily-logger (cleaner processes fleet repos at runtime, but code changes are only in daily-logger)
Linked: ADR-0033 (confidence threshold policy)

---

## Context

The daily-cleaner pipeline (`daily-logger/src/cleaner.ts`) sends every candidate (TODO/FIXME comments, doc files) to Claude Opus for classification via the Anthropic API. Each candidate triggers a full `messages.create` call with system prompt, file context, recent commits, and the day's article text.

Today the fleet has ~10 repos. The cleaner sweeps all repos with activity in the last 48 hours, with no limit on how many candidates are sent for validation. As repos grow in size and the fleet expands, inference cost scales linearly with candidates. A busy day across 10+ repos could generate hundreds of candidates, each consuming 2-4k input tokens for TODO validation and 4-8k for doc-file validation.

There is currently no budget cap, no per-run token accounting, no rate limiting, and no circuit breaker. This was flagged as techdebt on 2026-02-27.

## Decision

Enforce a per-run inference budget with candidate limits, token tracking, and a circuit breaker. Specifically:

1. **Per-run input token cap: 100,000 tokens.** The cleaner must estimate input tokens before each API call (system + user prompt character count / 4 as a conservative heuristic, or use Anthropic's token counting endpoint if available). Once cumulative input tokens reach 100k, stop validating.

2. **Per-repo candidate limit: 50 candidates.** After the sweep phase, if a repo produced more than 50 candidates, truncate to 50 (prioritizing FIXMEs over TODOs, then doc-files last, since doc validation is the most token-expensive).

3. **Cost logging.** Each run must log to stdout at completion:
   - Total candidates swept (before truncation)
   - Total candidates validated (API calls made)
   - Estimated total input tokens consumed
   - Estimated total output tokens consumed
   - Repos processed vs. repos skipped

4. **Circuit breaker at 80%.** When cumulative input tokens reach 80k (80% of the 100k cap), the cleaner must skip all remaining repos and log which repos were skipped along with their candidate counts. Repos already in progress finish their current candidate but no new repos are started.

5. **Monthly cost target visibility.** The cleaner run log must include a running monthly estimate: `(today's estimated cost) * (days remaining in month) + (month-to-date actual)`. This is informational only, not enforced. The estimate uses Anthropic's published per-token pricing for the configured model.

## Consequences

### Gains
- Predictable worst-case cost per run (~$0.30-0.50 at current Opus pricing for 100k input tokens).
- Circuit breaker prevents runaway spend on unusually active days.
- Cost logging enables trend monitoring without external tooling.
- Per-repo cap prevents a single noisy repo (e.g., a large refactor touching 200 files) from consuming the entire budget.

### Costs
- On high-activity days, some repos will be skipped entirely. Their stale TODOs and docs persist until the next quiet day.
- Token estimation via character count / 4 is imprecise; actual consumption may be 10-20% higher or lower than logged.
- Adds ~40 lines of bookkeeping code to the cleaner pipeline.

### Neutral
- The 100k cap and 50-candidate limit are initial values. They should be tuned after 2 weeks of production data.
- Does not affect the sweep phase (cheap GitHub API calls), only the validate phase (Anthropic API calls).

## Alternatives considered

| Alternative | Why rejected |
|-------------|--------------|
| No cap, monitor manually | Current state. Unacceptable as fleet grows past 10 repos. |
| Hard dollar cap via Anthropic usage limits | Anthropic's API usage limits are account-wide, not per-workflow. Would affect other pipelines (council review, article drafting). |
| Use Haiku for initial triage, Opus only for high-signal candidates | Good future optimization but adds pipeline complexity. Can layer this on top of the budget cap later. |
| Time-based rate limiting (e.g., 1 call/sec) | Slows the run but does not cap total spend. A 200-candidate run at 1/sec still costs the same. |
| Skip cleaner entirely on high-activity days | Loses the most valuable signal (busy days produce the most stale docs). Budget cap is more surgical. |
