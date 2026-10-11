# Article-pipeline reference

The generator collects fleet activity, drafts an article, optionally obtains
persona reviews and synthesis, and writes `_articles/<date>.md`. API generation
is a separate build step. Current source at the inspected revision defines behavior.

## Source contracts

Paths are relative to the daily-logger checkout.

| Stage | Source | Input | Output |
| --- | --- | --- | --- |
| Collect | `src/collect-context.ts`, `src/fleet.ts`, `src/activity-window.ts` | Date, discovered eligible repos, previous articles, telemetry | `BlogContext` |
| Run eligibility | `src/should-skip-run.ts`, `src/index.ts` | Collected context and override flags | Admit drafting or exit before drafting |
| Draft | `src/generate-article.ts`, `src/schema.ts` | `BlogContext` and article prompt | Validated `GeneratedArticle` |
| Council review | `src/council.ts`, `personas/` | Draft and each loaded `Persona` | One `CouncilNote` per persona |
| Synthesis | `src/council.ts` | Draft, council notes, context | Revised article or original-draft fallback |
| Write | `src/index.ts` | Article and publication configuration | Markdown, optional BlogEngine POST |
| API build | `src/build-api.ts` | Articles and action dispositions | Static `api/` JSON |

`src/types.ts` defines the shared interfaces. `src/schema.ts` defines article
validation and recovery. Persona files contain `slug` and `role` frontmatter
plus the review focus in their bodies. Repo membership and persona count are
runtime inputs, not fixed counts in this reference.

## Model-call accounting

For an admitted live run, let N be the number of loaded personas.

| Path | Nominal model calls | Qualification |
| --- | --- | --- |
| Council enabled, N > 0 | N+2 | One draft, N reviews, one synthesis |
| `SKIP_COUNCIL=true` or N = 0 | 1 | One draft, no review or synthesis |
| Gate exits before drafting | 0 | Collection can still make GitHub requests |
| `MOCK_LLM=true` | 0 | Fixtures replace generation, review, and synthesis calls |

Draft validation can cause one additional model call. Failed calls and retries
are separate from nominal totals. `DRY_RUN=true` suppresses article writes and
publication, not live model calls unless mock mode is also selected.

Use provider-neutral terms for stages and call counts. Preserve real API symbols,
environment variables, and provider attribution when citing the implementation.
The current integration uses `ANTHROPIC_API_KEY`. Neutral wording does not change it.

## Behavioral contracts

| Contract | Defining source |
| --- | --- |
| Generated activity is excluded from run eligibility, not collected context | `src/should-skip-run.ts` |
| `DRY_RUN=true` and `FORCE_RUN=true` bypass eligibility | `src/index.ts` |
| Previous-article context reads the five latest markdown files, with 600-character body excerpts | `src/collect-context.ts` |
| The generator writes the dated article directly. Schedule and publication safeguards belong to the workflow wrapper | `src/index.ts`, `.github/scripts/daily_blog_schedule.py`, `.github/workflows/daily-blog.yml` |
| Draft validation has schema recovery paths | `src/schema.ts`, `src/generate-article.ts` |
| Synthesis failure retains the original draft | `src/council.ts` |
| Action closure requires identity and an explicit resolution | `src/index.ts`, `src/schema.ts`, `src/build-api.ts` |

## Commands

```bash
pnpm generate
pnpm generate:dry
pnpm build:api
```

These are reference commands, not actions authorized by orientation.
