# Commit Message Guide

## Format

```
<type>(<scope>): <imperative summary> (≤72 chars)

[optional body]

[optional footers]
```

## Type

| Type | When to use |
|------|-------------|
| `feat` | New feature or capability |
| `fix` | Bug fix |
| `refactor` | Code restructuring without behavior change |
| `docs` | Documentation only |
| `test` | Tests only |
| `chore` | Build, CI, dependency updates |
| `perf` | Performance improvement |
| `style` | Formatting, whitespace (no logic change) |
| `revert` | Reverting a previous commit |

## Scope (optional)

The package or module name: `workflows`, `cli`, `ext`, `vscode`, or a feature name.

Examples:
- `feat(workflows): add fileBackedWorkflow JIT loading`
- `fix(cli): handle missing .env gracefully`
- `chore(deps): upgrade @anthropic-ai/sdk to 0.37`

## Summary line rules

- **Imperative mood**: "add X" not "added X" or "adding X"
- **No period** at the end
- **≤72 characters** (hard limit — prevents truncation in git log)
- **Lowercase after the type/scope prefix**
- **Specific over vague**: "add rate limiting to callClaude()" not "fix performance"

## Body (when to include)

Include a body when:
- The *why* is not obvious from the summary
- There are multiple related changes bundled in one commit
- The change has non-obvious side effects
- **The commit is part of a larger feature or initiative** — name what it contributes to

Keep body lines ≤72 characters. Separate summary from body with a blank line.

When a sequence of commits builds toward a single feature, each body should reference that feature by name. This creates a traceable narrative thread that helps both human reviewers and automated consumers (like daily-logger) understand which commits form a coherent story.

## Examples

Good:
```
feat(workflows): add JIT knowledge file loading to fileBackedWorkflow

Previously all content was inline in the main .md file. This moves
reference material to knowledge/ subdirectories, loaded on demand
by the skill's orchestration logic.
```

Good (simple):
```
fix: handle empty personas/ directory in council.ts
```

Bad:
```
Update stuff
WIP
Fix bug
cleanup
```

## Downstream narrative signal

Commit messages in ojfbot repos are consumed by `daily-logger`, which generates daily development blog articles from the last 24h of commits. Good commit messages help daily-logger identify the day's headline stories rather than producing dry changelogs.

**What helps daily-logger:**
- Body text that names the feature or initiative the commit belongs to
- Consistent scope across related commits (e.g., all commits for a dashboard feature use scope `dashboard`)
- Commit type sequences that tell a story: `feat(dashboard): add accordion` → `feat(dashboard): add popover` → `fix(dashboard): capture hover target` → `docs(dashboard): ADR-0036`

**What doesn't help:**
- Generic bodies like "cleanup" or "various fixes"
- Missing bodies on feat commits that are part of a multi-commit feature
- Inconsistent scopes across commits that belong to the same feature

**Example: multi-commit feature with narrative signal**
```
feat(dashboard): add collapsible accordion for decisions page

Part of the daily-logger interactive dashboard initiative. Decisions
were previously a flat list; this adds expand/collapse behavior
grouped by pillar, enabling structured decision data from ADR-0036
to drive a richer browsing experience.
```

```
fix(dashboard): capture hover target before setTimeout in popover

Part of the daily-logger interactive dashboard initiative. The
popover close handler lost its reference to the hovered DOM target
when the event fired after the setTimeout callback registered,
causing immediate dismissal on hover.
```

## Branch-specific behavior

When on a protected branch (`main`, `master`, `production`, `release/*`):
- Warn before committing directly
- Recommend creating a feature branch instead

When on a feature branch:
- Normal commit proceeds
- Suggest squashing before merging if more than 5 commits

## Co-authorship

When Claude Code is making the commit:
```
Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```
