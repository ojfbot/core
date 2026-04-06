Generate a conventional commit message for the staged changes.

## Format

```
<type>(<scope>): <subject>

<body>

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```

## Rules

1. **type**: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `ci`, `perf`, `style`
2. **scope**: package name (`workflows`, `cli`, `vscode-extension`) or area (`skills`, `domain-knowledge`, `adr`)
3. **subject**: imperative mood, lowercase, no period, under 50 characters
4. **body**: explain *why* not *what* — the diff already shows what changed. 1–3 sentences max.
5. If the change is trivial (typo, import sort), skip the body
6. If the change fixes an issue, add `Fixes #<number>` in the body

## Process

1. Read `git diff --staged`
2. Read recent `git log --oneline -5` to match style
3. Draft the message following the format above
