# Daily-Logger Architecture Brief

## What it is

`@ojfbot/daily-logger` — automated daily development blog generator. Runs on a nightly GitHub Actions schedule. Collects the day's GitHub activity across all ojfbot repos, generates an article, optionally runs it through a council of expert reviewers, and writes the final article to `_articles/<date>.md`.

## Four-phase pipeline

```
Phase 1: Collect   src/collect-context.ts
         ↓ collectContext(date) → BlogContext
         GitHub API: commits (24h), merged PRs, closed issues, open issues
         Reads: domain-knowledge/ (ROADMAP.md injected as projectVision)

Phase 2: Draft     src/generate-article.ts
         ↓ generateArticle(ctx) → GeneratedArticle
         1 Claude call. Output: { title, date, tags, summary, body }
         Article structure: "What shipped" / "The decisions" / "Roadmap pulse" / "What's next"

Phase 3: Council   src/council.ts  [skipped if SKIP_COUNCIL=true or no personas/]
         ↓ for each persona: reviewDraft(draft, persona) → CouncilNote
         1 Claude call per persona. Each persona critiques independently.
         ↓ synthesizeWithCouncil(draft, notes, ctx) → GeneratedArticle (revised)
         1 Claude call. Incorporates all council feedback.

Phase 4: Write     src/index.ts
         ↓ writeFileSync(_articles/<date>.md)
         Optionally: POST to BlogEngine API
```

## Persona format

Personas live in `personas/*.md`. Each file:
```
---
slug: kebab-case-id
role: Full title/context — be specific
---

## Background
[professional history, what makes their lens distinct]

## Their lens
[specific analytical frame — what they ask first, what they see others miss]

## What they typically challenge
[3-5 concrete, specific challenges — phrased as they would ask them]

## What lands for them
[1-2 things that earn credibility with this persona]
```

See `/council-review` skill `knowledge/persona-format.md` for the full spec.

## Key types

```typescript
interface Persona { slug: string; role: string; content: string }
interface CouncilNote { personaSlug: string; personaRole: string; critique: string }
interface BlogContext {
  date: string; repos: string[]; commits: CommitInfo[]; mergedPRs: PRInfo[]
  closedIssues: IssueInfo[]; openIssues: IssueInfo[]
  projectVision: string  // injected from ROADMAP.md
  previousArticles: Array<{ date: string; excerpt: string }>  // 7-day window
}
interface GeneratedArticle { title: string; date: string; tags: string[]; summary: string; body: string }
```

## Environment variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ANTHROPIC_API_KEY` | yes | — | Claude API access |
| `GITHUB_TOKEN` | yes | auto in CI | GitHub API access |
| `OJFBOT_ORG` | no | `ojfbot` | GitHub org to scan |
| `DATE_OVERRIDE` | no | today UTC | ISO date, for backfills |
| `DRY_RUN` | no | false | Print only, no writes |
| `SKIP_COUNCIL` | no | false | Skip Phase 3 (faster, lower quality) |
| `BLOGENGINE_API_URL` | no | — | POST article to BlogEngine on complete |

## Invariants

1. **No duplicate articles** — check `_articles/<date>.md` before running
2. **Fallback on parse failure** — if synthesis JSON fails to parse, fall back to original draft
3. **7-day window** — `previousArticles` only includes the last 7 days (not all history)
4. **Council is always optional** — `SKIP_COUNCIL=true` produces a valid (lower quality) article
5. **No article on empty context** — if 0 commits and 0 PRs, log and skip

## Scripts

```bash
pnpm generate          # full pipeline (live)
pnpm generate:dry      # full pipeline (print only, no writes)
pnpm report            # generate on-demand persona report
pnpm report:dry        # dry run of report
```
