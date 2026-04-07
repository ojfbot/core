# GitHub Actions Workflow Template

## Frame OS Standard Pipeline

```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version-file: '.nvmrc'

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 9.15.4

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Type check
        run: pnpm type-check

      - name: Lint
        run: pnpm lint

      - name: Test
        run: pnpm test

      - name: Build
        run: pnpm build

      - name: Security audit
        run: pnpm audit --audit-level=high
```

## Key Decisions

- **Order**: type-check → lint → test → build (fail fast on cheapest checks)
- **`--frozen-lockfile`**: ensures CI uses exact lockfile versions
- **Node version from `.nvmrc`**: single source of truth
- **pnpm via `pnpm/action-setup`**: official action, caches automatically

## Vercel Preview Deploys

Add to PR workflow:
```yaml
      - name: Deploy preview
        if: github.event_name == 'pull_request'
        run: vercel deploy --token=${{ secrets.VERCEL_TOKEN }}
```

## Security Step

```yaml
      - name: Artifact scan
        run: pnpm security:check
```

Runs `scripts/artifact-scanner.ts` — scans `dist/` for source maps, API keys, debugger statements.
