Reference for `/triage` Step 5: the required GitHub label scheme and the missing-labels rule.

Required GitHub label setup (the skill warns if these labels don't exist):
- Severity: `severity/p0`, `severity/p1`, `severity/p2`, `severity/p3`
- Effort: `effort/xs`, `effort/s`, `effort/m`, `effort/l`, `effort/xl`
- Domain: `domain/auth`, `domain/agent-graph`, `domain/ui`, `domain/infra`, `domain/docs`, `domain/ops`
- Type: `type/bug`, `type/feature`, `type/refactor`, `type/architecture`, `type/docs`, `type/chore`

If labels are missing, output the `gh label create` commands needed, but do not run them automatically — label scheme is repo-level config.

If `gh` isn't installed/authenticated, output the proposals as a markdown table and tell the user how to apply manually.
