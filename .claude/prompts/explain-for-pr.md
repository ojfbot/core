Generate a pull request description from the current branch's changes.

## Process

1. Run `git log main..HEAD --oneline` to see all commits
2. Run `git diff main...HEAD --stat` for file-level summary
3. Read key changed files to understand the intent

## Output format

```markdown
## Summary
<2-4 bullet points explaining what changed and why>

## Changes
<grouped by area — e.g., "Config", "Source", "Tests", "Docs">

## Testing
<how to verify — commands to run, what to look for>

## Notes
<anything a reviewer should know — trade-offs, follow-up work, risks>
```

## Rules

- Lead with *why*, not *what* — the diff shows what
- Keep bullets concise (one line each)
- Group related changes; don't list every file
- Flag any temporary or hacky code that needs follow-up
- If there are breaking changes, call them out explicitly
