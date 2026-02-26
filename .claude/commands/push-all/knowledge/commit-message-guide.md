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

Keep body lines ≤72 characters. Separate summary from body with a blank line.

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
