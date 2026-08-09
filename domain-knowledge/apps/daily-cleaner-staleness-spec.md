# Daily Cleaner: Shipped vs Abandoned Staleness Classification

**Origin:** daily-logger 2026-02-27 open action
**Status:** Draft spec

## Problem

The daily-cleaner currently answers one question: "Is this comment stale?" It does not ask *why* it is stale, and the correct action depends on the answer:

- **Shipped-stale**: The code changed and the comment describes old behavior that has been replaced. The comment is noise. Action: remove it (or rewrite to match new behavior).
- **Abandoned-stale**: The comment describes intended work that was never done -- a TODO that went cold, a FIXME nobody addressed, a doc section describing a feature that was planned but dropped. The comment may still be valuable as a record of intent. Action: flag for human triage (it may represent forgotten work items worth tracking in issues).

Today both cases produce the same `CleanProposal` with `replacement: ""` (delete). This loses information and quietly discards abandoned work signals that should surface to the developer.

## Proposed Classification Matrix

Extend `CleanProposal` with a `staleness` discriminator:

| Staleness | Confidence: High | Confidence: Medium | Confidence: Uncertain |
|-----------|------------------|--------------------|-----------------------|
| **Shipped** | Auto-remove via PR | Auto-remove via PR | Include in PR as suggestion (commented, not applied) |
| **Abandoned** | Create GitHub issue | Create GitHub issue | Flag in PR body only (human decides) |

New type field on `CleanProposal`:

```typescript
staleness: 'shipped' | 'abandoned'
```

Confidence remains `'high' | 'medium'` for actionable proposals. Add `'uncertain'` as a third level that is included in output but not auto-applied.

## Detection Heuristics

The validate phase already sends recent commits and the daily-logger article to Claude. Add these signals to the prompt and structured output:

1. **Git history of the surrounding function/section.** If the function body changed significantly in the last 48h but the comment was not updated, lean toward shipped-stale. Query: `git log -p --since=48h -- <file>` filtered to the line range.

2. **Function signature change.** If the function name, parameters, or return type differ from what the comment describes, that is strong shipped-stale evidence.

3. **TODO/FIXME age.** Use `git log -1 -- <file>` limited to the comment line (`-L <line>,<line>:<file>`). If the TODO is older than 14 days and no related commit mentions the same keyword, lean toward abandoned-stale.

4. **Daily-logger article mentions.** If today's article describes shipping the feature the comment references, that is high-confidence shipped-stale. If the article mentions deprioritizing or dropping the feature, that is abandoned-stale.

5. **Keyword signals.** Comments containing "planned", "future", "phase 2", "someday", "blocked on" lean abandoned. Comments containing version numbers, old API names, or config values that no longer exist in the codebase lean shipped.

## Implementation Changes

1. **Types** (`src/types.ts`): Add `staleness: 'shipped' | 'abandoned'` to `CleanProposal`. Add `'uncertain'` to the `confidence` union.

2. **Validate prompts** (`src/cleaner.ts`): Update the system prompts for `validateDocCandidate` and `validateTodoCandidate` to return `staleness` in their JSON output. Add the heuristic signals (git blame age, function signature diff) to the user prompt context.

3. **Sweep phase** (`src/cleaner.ts`): For each candidate, fetch `git log -L` data via the GitHub API (`GET /repos/:org/:repo/commits?path=<file>`) to determine comment age.

4. **PR phase** (`src/cleaner.ts`): Split `buildPRBody` into shipped (auto-applied diffs) and abandoned (issue links or triage section). For abandoned-stale items at high/medium confidence, call `gh issue create` instead of applying a diff.

5. **Workflow** (`.github/workflows/daily-cleaner.yml`): No changes needed -- the workflow already grants `contents: write` and `pull-requests: write`, which covers issue creation via `gh`.

## Acceptance Criteria

1. `CleanProposal` includes a `staleness` field with value `'shipped'` or `'abandoned'` for every validated proposal. No proposal has an undefined staleness.

2. Shipped-stale proposals at high or medium confidence are applied as diffs in the PR (existing behavior preserved). Abandoned-stale proposals at high or medium confidence create a GitHub issue in the target repo instead of applying a deletion.

3. The validation prompt includes at least two of the five detection heuristics (git history age and daily-logger article match at minimum) and Claude returns the staleness classification in structured JSON.

4. Uncertain-confidence proposals (either staleness type) appear in the PR body as a "Needs human review" section but are not auto-applied and do not create issues.

5. A dry-run (`DRY_RUN=true`) prints the staleness classification for each proposal alongside the existing confidence and rationale output.
