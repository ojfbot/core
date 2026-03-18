# daily-logger architecture

**Repo:** `../daily-logger` (sibling of core, at `/Users/yuri/ojfbot/daily-logger`)
**Purpose:** Automated daily development blog for the Frame OS project. 4-phase pipeline → expert council review → GitHub Pages publish.
**Stack:** TypeScript, tsx, Anthropic SDK (`@anthropic-ai/sdk`), `gh` CLI, Jekyll (GitHub Pages)

---

## Pipeline overview

`pnpm generate` → `src/index.ts` — 4 phases:

```
Phase 1: Collect    src/collect-context.ts
         gh API sweep, 8 repos: shell, cv-builder, BlogEngine, TripPlanner,
           core, MrPlug, purefoy, daily-logger
         Window: 24h commits / 7d PRs+issues (7d prevents duplication across articles)
         Reads ROADMAP.md (first 2500 chars) → projectVision
         Returns BlogContext {
           commits: CommitInfo[]          (last 24h, deduped by URL)
           mergedPRs: PRInfo[]            (last 7d)
           closedIssues: IssueInfo[]      (last 7d)
           openIssues: IssueInfo[]        (top 25 currently open)
           projectVision: string          (ROADMAP.md first 2500 chars)
           previousArticles: {date,excerpt}[]  (last 5 for continuity)
         }

Phase 2: Draft      src/generate-article.ts
         Claude Sonnet call: SYSTEM_PROMPT (500-line constant) + formatted BlogContext
         JSON parse with fallback (strip markdown fences, return draft on failure)
         Returns GeneratedArticle { title, date, tags, summary, body }
         Mandatory body sections: ## What shipped, ## The decisions,
           ## Roadmap pulse, ## What's next

Phase 3: Council    src/council.ts  (bypass: SKIP_COUNCIL=true)
         loadPersonas() — reads ALL personas/*.md dynamically
         For each persona:
           reviewDraft(article, persona) → 1 Claude call
             system: "You are {persona.role}. {full persona markdown body}"
             returns CouncilNote { personaSlug, personaRole, critique }
             critique = questions they'd ask + gaps they'd flag + what lands
         synthesizeWithCouncil(draft, notes[], ctx) → 1 Claude call
           "Incorporate feedback: preemptively answer questions, acknowledge
            gaps honestly, sharpen framing, preserve structure"
           Fallback: returns draft unchanged if JSON parse fails

Phase 4: Write      src/index.ts
         toMarkdown() → YAML frontmatter + footer
         Writes _articles/{date}.md
         If BLOGENGINE_API_URL: POST to BlogEngine /api/v2/articles
```

**Cost:** 1 call (draft) + N calls (1 per persona) + 1 call (synthesize). With 2 personas = 4 calls total.

---

## Persona file format

`personas/<slug>.md`:

```yaml
---
slug: principal-cloud-architect
role: Principal Cloud Architect, Enterprise IT (25yr career — oil & gas, chemicals)
---

## Background
...

## Their lens
...

## What they typically challenge
...

## What lands for them
...
```

**Adding a persona:** drop a `.md` in `personas/`. `loadPersonas()` reads all files dynamically — nothing else changes.

### Current personas

| Slug | Role | Primary challenge |
|------|------|-------------------|
| `principal-cloud-architect` | Enterprise IT arch (25yr, oil & gas / finance) | ADRs before design reviews; cost story ($X at 100 vs 1000 users); live URLs, not localhost |
| `design-program-manager` | Platform DPM (Roblox) / ECD (HBO, Meta, Amazon) | Figma before engineering; "the moment" for demo; Roblox platform analogy (App→Instance→Thread) |

---

## Key files

| File | Purpose |
|------|---------|
| `src/index.ts` | Pipeline orchestrator (collect → draft → council → write) |
| `src/types.ts` | All interfaces: `BlogContext`, `GeneratedArticle`, `Persona`, `CouncilNote`, `GeneratedReport` |
| `src/collect-context.ts` | GitHub API sweep via `gh` CLI; reads ROADMAP.md |
| `src/generate-article.ts` | Claude call + SYSTEM_PROMPT constant + JSON parser + `toMarkdown()` |
| `src/council.ts` | `loadPersonas()`, `reviewDraft()`, `synthesizeWithCouncil()` |
| `src/report.ts` | Entry point for on-demand persona memos |
| `src/generate-report.ts` | Persona-addressed memos (not part of daily pipeline) |
| `ROADMAP.md` | Living roadmap injected into every prompt (~2500 chars); 4 Samir pillars + 9 phases |
| `personas/` | Expert reviewer definitions |
| `_articles/` | Jekyll collection → GitHub Pages |
| `_reports/` | On-demand persona memos |
| `.github/workflows/daily-blog.yml` | Cron + manual dispatch; generate → branch → draft PR |
| `.github/scripts/build_pr_body.py` | Extracts frontmatter → structured PR body |

---

## Environment variables

| Var | Required | Default | Purpose |
|-----|----------|---------|---------|
| `ANTHROPIC_API_KEY` | Yes | — | Claude API |
| `GITHUB_TOKEN` / `GH_PAT` | Yes | — | GitHub API (PAT required for private repos) |
| `OJFBOT_ORG` | No | `ojfbot` | GitHub org |
| `DATE_OVERRIDE` | No | today UTC | ISO date string |
| `DRY_RUN` | No | false | Print to stdout, no file writes |
| `SKIP_COUNCIL` | No | false | Skip Phase 3 (fast mode, 1 call total) |
| `BLOGENGINE_API_URL` | No | — | POST article to BlogEngine API |
| `PERSONA_SLUG` | No | — | `pnpm report` only: filter to one persona |

---

## CI/CD (`daily-blog.yml`)

- Cron: 09:00 UTC daily + manual dispatch (`date_override`, `dry_run` inputs)
- `concurrency: cancel-in-progress: false` — never cancels an in-flight generation
- Steps: `pnpm install --frozen-lockfile` → `pnpm generate` → branch `article/{date}` → draft PR
- `build_pr_body.py` extracts frontmatter to build structured PR body (title, tags, summary, first 1800 chars)
- Editorial gate: merge draft PR → `deploy-pages.yml` → Jekyll build → GitHub Pages

---

## Invariants — what not to break

- `loadPersonas()` is side-effect free — reads `personas/*.md`, no writes
- JSON fallback in `generateArticle` and `synthesizeWithCouncil` — preserve both fallbacks
- 7-day window on PRs/issues (not 24h) — prevents duplication across consecutive articles
- `SKIP_COUNCIL=true` is an intentional fast path — not a bug
- Deduplication by URL in Phase 1 — GitHub pagination produces duplicates
- Article tone: first-person plural ("we shipped"), technical, opinionated, honest (names tradeoffs)
- Mandatory body sections must survive council synthesis

---

## Secondary pipeline: persona reports

`pnpm report` → `src/report.ts` → `src/generate-report.ts`
Generates addressed memos per persona (separate from the daily article).
Writes `_reports/{date}-{persona-slug}.md`. Not synthesized — direct memo per persona.

---

## Shared skills pattern

`daily-logger/.claude/skills/` = 26 symlinks → `core/.claude/skills/`
`daily-logger/domain-knowledge/` = 6 symlinks → universal core knowledge files + this file
No daily-logger-specific commands — it uses the full core toolkit.
Propagate command changes: `./scripts/install-agents.sh daily-logger` from core.
