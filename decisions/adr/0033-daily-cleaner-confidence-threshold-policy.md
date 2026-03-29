# ADR-0033: Daily-Cleaner Confidence Threshold Policy

Date: 2026-03-29
Status: Proposed
OKR: 2026-Q1 / O2 / KR2 (engineering quality)
Commands affected: /sweep, /validate
Repos affected: GroupThink, core, daily-logger

---

## Context

GroupThink's daily-cleaner bot runs on a schedule, scanning repositories for stale comments and docstrings. Candidate items are sent to Claude Opus for categorical judgment into one of three buckets: `high_confidence_stale`, `medium_confidence_stale`, or `uncertain`. Only high and medium confidence items are included in the cleanup PR; uncertain items are silently dropped with no record.

Two problems with the current approach:

1. **Informal definitions.** The three confidence categories are operationally defined by prompt language that Opus receives, not by a formal specification. The most consequential gate in the pipeline — deciding what gets deleted — runs on an undocumented heuristic. If the prompt is edited, the threshold semantics change without any review or audit trail.

2. **Silent skip list.** Items classified as `uncertain` are discarded with no log output. Humans reviewing the PR have no way to know what the bot considered and rejected. This makes it impossible to catch systematic false negatives (stale comments the bot keeps missing) or to calibrate whether the uncertain category is too broad or too narrow.

A specific failure mode motivates formalization: a comment describing a function about to be refactored could be classified as `high_confidence_stale` if Opus reads current code state rather than intended future state. The comment is accurate relative to the planned refactor but appears stale relative to the code on disk. Because false positives (deleting accurate comments) are strictly worse than false negatives (leaving stale ones), the classification criteria must be conservative and explicit.

## Decision

Formalize the three confidence categories with operational definitions, require PR review as the human accountability gate, and log all uncertain items for auditability.

### Category definitions

| Category | Definition | Action |
|----------|-----------|--------|
| `high_confidence_stale` | The comment contradicts the current code behavior AND no open PR or branch modifies the relevant function/module. The comment is provably wrong given the code as shipped. | Include in cleanup PR. |
| `medium_confidence_stale` | The comment describes behavior that has drifted from the code, but the contradiction is partial or the comment may be describing intent rather than implementation. Reasonable reviewers might disagree. | Include in cleanup PR, flagged with `<!-- daily-cleaner: medium -->` for reviewer attention. |
| `uncertain` | The comment's staleness cannot be determined from code context alone, OR the relevant code is in active development (open PR, recent branch activity), OR the comment describes architectural intent that may survive a refactor. | **Exclude** from cleanup PR. **Log** to the daily-cleaner run report. |

### Invariants

1. **PR review is mandatory.** Daily-cleaner PRs must never be auto-merged. A human reviewer inspects every deletion before merge. This is the accountability gate.
2. **Medium items are visually distinguished.** Each medium-confidence deletion in the PR diff carries an inline HTML comment (`<!-- daily-cleaner: medium -->`) so reviewers can prioritize scrutiny.
3. **Uncertain items are logged, not silently dropped.** Each run produces a skip report (log file or PR comment section) listing every uncertain item with: file path, line range, the comment text, and a one-line reason for the uncertain classification. This lets humans audit the skip list and catch systematic blind spots.
4. **Refactor-in-flight guard.** Before classifying a comment as stale, the prompt must check whether the file has open PRs or recent branch activity (last 7 days). If it does, the item is automatically classified as `uncertain` regardless of Opus's judgment. This prevents the refactor-in-flight failure mode.
5. **Prompt changes require ADR update.** Any edit to the classification prompt that changes category semantics must be reflected in this ADR. The prompt is an implementation of this policy, not a substitute for it.

### Classification prompt contract

The prompt sent to Opus must include:

- The three category definitions from the table above (verbatim or semantically equivalent)
- An explicit instruction that false positives are worse than false negatives
- The refactor-in-flight guard rule
- A requirement to output structured JSON with `category`, `file`, `line_range`, `comment_text`, and `reason` fields

## Consequences

### Gains
- Confidence categories have auditable definitions independent of prompt wording
- Uncertain items become visible, enabling threshold calibration over time
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
| Drop uncertain category entirely (binary stale/not-stale) | Forces the model into false precision. The uncertain category exists because genuinely ambiguous cases are common and should be handled differently. |
| Log uncertain items but also include them in PR as skipped | Pollutes the PR diff with non-actionable items. Reviewers should focus on what's being deleted. The skip report is a separate artifact. |
