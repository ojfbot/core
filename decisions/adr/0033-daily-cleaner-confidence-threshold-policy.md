# ADR-0033: Daily-Cleaner Confidence Threshold Policy

Date: 2026-03-29
Status: Proposed
OKR: 2026-Q1 / O2 / KR2 (engineering quality)
Commands affected: N/A (GitHub Actions workflow: daily-cleaner.yml)
Repos affected: daily-logger

---

## Context

The daily-cleaner pipeline (daily-logger repo) runs on a schedule, scanning repositories for stale comments and docstrings. Candidate items are sent to Claude Opus for categorical judgment. The confidence categories used in code are `high` and `medium` for doc validation (no third category), and `high`, `medium`, and `low` for TODO validation. Only `high` and `medium` items are included in the cleanup PR; `low`-confidence TODO results are silently returned as null (discarded), and doc validation does not produce a third category at all.

Two problems with the current approach:

1. **Informal definitions.** The confidence categories are operationally defined by prompt language that Opus receives, not by a formal specification. The most consequential gate in the pipeline — deciding what gets deleted — runs on an undocumented heuristic. If the prompt is edited, the threshold semantics change without any review or audit trail.

2. **Silent skip list.** Items classified as `low` (TODO validation) are discarded with no log output, and doc validation simply never returns a third category. Humans reviewing the PR have no way to know what the bot considered and rejected. This makes it impossible to catch systematic false negatives (stale comments the bot keeps missing) or to calibrate whether the low-confidence threshold is too broad or too narrow.

A specific failure mode motivates formalization: a comment describing a function about to be refactored could be classified as `high` confidence if Opus reads current code state rather than intended future state. The comment is accurate relative to the planned refactor but appears stale relative to the code on disk. Because false positives (deleting accurate comments) are strictly worse than false negatives (leaving stale ones), the classification criteria must be conservative and explicit.

## Decision

Formalize the confidence categories with operational definitions, require PR review as the human accountability gate, and log all low-confidence / excluded items for auditability.

### Category definitions

| Category | Definition | Action |
|----------|-----------|--------|
| `high` | The comment contradicts the current code behavior AND no open PR or branch modifies the relevant function/module. The comment is provably wrong given the code as shipped. | Include in cleanup PR. |
| `medium` | The comment describes behavior that has drifted from the code, but the contradiction is partial or the comment may be describing intent rather than implementation. Reasonable reviewers might disagree. | Include in cleanup PR, flagged with `<!-- daily-cleaner: medium -->` for reviewer attention. |
| `low` (TODO validation only) | The comment's staleness cannot be determined from code context alone, OR the relevant code is in active development (open PR, recent branch activity), OR the comment describes architectural intent that may survive a refactor. The code returns `low`-confidence TODO results as null (silently discarded). Doc validation does not produce a third category — the prompt only asks for `high` or `medium`. | **Exclude** from cleanup PR. **Log** to the daily-cleaner run report. |

### Invariants

1. **PR review is mandatory.** Daily-cleaner PRs must never be auto-merged. A human reviewer inspects every deletion before merge. This is the accountability gate.
2. **Medium items are visually distinguished.** Each medium-confidence deletion in the PR diff carries an inline HTML comment (`<!-- daily-cleaner: medium -->`) so reviewers can prioritize scrutiny.
3. **Low-confidence items are logged, not silently dropped.** Each run produces a skip report (log file or PR comment section) listing every excluded item with: file path, line range, the comment text, and a one-line reason for exclusion. For TODO validation, these are `low`-confidence results. For doc validation, items that do not meet `high` or `medium` threshold are simply not returned. This lets humans audit the skip list and catch systematic blind spots.
4. **Refactor-in-flight guard.** Before classifying a comment as stale, the prompt must check whether the file has open PRs or recent branch activity (last 7 days). If it does, the item is automatically excluded (classified as `low` for TODOs, or omitted entirely for docs) regardless of Opus's judgment. This prevents the refactor-in-flight failure mode.
5. **Prompt changes require ADR update.** Any edit to the classification prompt that changes category semantics must be reflected in this ADR. The prompt is an implementation of this policy, not a substitute for it.

### Classification prompt contract

The prompt sent to Opus must include:

- The category definitions from the table above (verbatim or semantically equivalent)
- An explicit instruction that false positives are worse than false negatives
- The refactor-in-flight guard rule
- A requirement to output structured JSON with `category`, `file`, `line_range`, `comment_text`, and `reason` fields

## Consequences

### Gains
- Confidence categories have auditable definitions independent of prompt wording
- Excluded items (low-confidence TODOs, sub-threshold docs) become visible, enabling threshold calibration over time
- Medium-confidence markers guide reviewer attention to the riskiest deletions
- Refactor-in-flight guard prevents the most dangerous false positive pattern
- Prompt changes are governed by the same review process as any architectural decision

### Costs
- Skip report adds log volume to each daily-cleaner run
- Refactor-in-flight check requires querying open PRs/branches per file, adding latency and API calls
- Medium-confidence HTML comments add noise to diffs (minor — they're HTML comments, invisible in rendered markdown)

### Neutral
- High-confidence items are unaffected — they were already being included and reviewed
- The human reviewer workload is roughly the same; the skip report is optional reading

## Alternatives considered

| Alternative | Why rejected |
|-------------|--------------|
| Numeric confidence score (0.0-1.0) with configurable threshold | LLMs produce poorly calibrated probabilities. Categorical judgment with explicit definitions is more stable and auditable than a float threshold that drifts with model updates. |
| Auto-merge high-confidence items, review only medium | False positives are strictly worse than false negatives. No deletion should bypass human review regardless of confidence level. |
| Drop low category entirely (binary stale/not-stale) | Forces the model into false precision. The low-confidence category (for TODOs) and the two-category doc model exist because genuinely ambiguous cases are common and should be handled differently. |
| Log excluded items but also include them in PR as skipped | Pollutes the PR diff with non-actionable items. Reviewers should focus on what's being deleted. The skip report is a separate artifact. |
