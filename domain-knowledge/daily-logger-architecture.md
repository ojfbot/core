# daily-logger architecture

**Repo:** `../daily-logger` (sibling of core, at `/Users/yuri/ojfbot/daily-logger`)
**Purpose:** Automated daily development blog for the Frame OS project. 4-phase pipeline → expert council review → static JSON API + React SPA on Vercel.
**Stack:** TypeScript, tsx, Anthropic SDK (`@anthropic-ai/sdk`), `gh` CLI, Zod (schema validation), React + Vite (frontend), Vercel (hosting), Jekyll (GitHub Pages fallback)

### Active ADRs

- **ADR-0031** — Universal code reference popovers. Extends commit popovers to all 9 inline code reference types (commits, components, files, packages, commands, config keys, env vars, endpoints, directories). Adds `CodeReferenceSchema` to the article schema, a backfill script, and unified popover component. **Implemented.**
- **ADR-0032** — React + Vercel migration. Frontend migrated from Jekyll + vanilla TS to Vite + React + Vercel at `log.jim.software`. GitHub Pages remains as static fallback. Phase A (React SPA) complete; Phase B (Module Federation remote) planned.
- **ADR-0035** — Article status lifecycle & auto-merge. Adds `status` field to article frontmatter (`draft` / `accepted` / `rejected`). Articles auto-merge overnight and publish as drafts; human review via inline section chat upgrades to `accepted`. Feedback files (`feedback/YYYY-MM-DD.json`) inject corrections into next day's generation.
- **ADR-0036** — Structured decision output. Decisions now stored as structured `DecisionEntry[]` array (title, summary, repo, pillar, relatedTags) rather than prose-only in the markdown body. Enables rich UI rendering.

---

## Pipeline overview

`pnpm generate` → `src/index.ts` — 4 phases:

```
Phase 1: Collect    src/collect-context.ts
         gh API sweep, 13 repos: shell, cv-builder, BlogEngine, TripPlanner,
           core, MrPlug, purefoy, daily-logger, landing, core-reader,
           lean-canvas, seh-study, + others in REPOS array
         Window: 24h commits / 7d PRs+issues (7d prevents duplication across articles)
         Reads ROADMAP.md (first 2500 chars) → projectVision
         Returns BlogContext {
           commits: CommitInfo[]          (last 24h, deduped by URL)
           mergedPRs: PRInfo[]            (last 7d)
           openPRs: OpenPRInfo[]          (currently open)
           recentPRs: RecentPRInfo[]      (all states, 24h)
           closedIssues: IssueInfo[]      (last 7d)
           openIssues: IssueInfo[]        (top 40, sorted by isNew flag)
           openActions: ActionItem[]      (from previous articles, filtered against done-actions.json)
           projectVision: string          (ROADMAP.md first 2500 chars)
           previousArticles: {date,excerpt}[]  (last 5 for continuity)
         }

Phase 2: Draft      src/generate-article.ts
         Claude Sonnet call via tool_use: SYSTEM_PROMPT + formatted BlogContext
         Uses write_article tool for structured output (ArticleDataV2 schema)
         Validation ladder: v2 → v1 fallback → partial v2 salvage → stub article
         Returns GeneratedArticle {
           title, date, tags: TypedTag[], summary, body,
           closedActions?: ClosedAction[]
         }
         Structured output (ArticleDataV2) includes:
           whatShipped: ShipmentEntry[]   (repo, description, commits[], prs[])
           decisions: DecisionEntry[]     (title, summary, repo, pillar?, relatedTags)
           suggestedActions: ActionItem[] (command, description, repo, status, sourceDate)
           closedActions: ClosedAction[]  (resolved actions with resolution field)
           codeReferences: CodeReference[] (9 types: commit, component, file, etc.)
           activityType: 'build'|'rest'|'audit'|'hardening'|'cleanup'|'sprint'
           status: 'draft'|'accepted'|'rejected'
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

**Cost:** 1 call (draft) + N calls (1 per persona) + 1 call (synthesize). With 4 personas = 6 calls total.

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

### Current personas (4)

| Slug | Role | Primary challenge |
|------|------|-------------------|
| `principal-cloud-architect` | Enterprise IT arch (25yr, oil & gas / finance) | ADRs before design reviews; cost story ($X at 100 vs 1000 users); live URLs, not localhost |
| `design-program-manager` | Platform DPM (Roblox) / ECD (HBO, Meta, Amazon) | Figma before engineering; "the moment" for demo; Roblox platform analogy (App→Instance→Thread) |
| `cognitive-load-manager` | Cognitive load specialist | Cognitive overhead; onboarding friction; decision fatigue |
| `technical-educator` | Technical educator | Teaching clarity; didactic depth; "explain as if returning after 2 weeks" |

---

## Key files

| File | Purpose |
|------|---------|
| `src/index.ts` | Pipeline orchestrator (collect → draft → council → write) |
| `src/types.ts` | All interfaces: `BlogContext`, `GeneratedArticle`, `Persona`, `CouncilNote`, `GeneratedReport` |
| `src/collect-context.ts` | GitHub API sweep via `gh` CLI; reads ROADMAP.md |
| `src/generate-article.ts` | Claude call + SYSTEM_PROMPT constant + JSON parser + `toMarkdown()` |
| `src/council.ts` | `loadPersonas()`, `reviewDraft()`, `synthesizeWithCouncil()` |
| `src/schema.ts` | Zod schemas: `ArticleDataV2`, `TypedTagSchema`, `ShipmentEntrySchema`, `DecisionEntrySchema`, `ActionItemSchema`, `CodeReferenceSchema` |
| `src/build-api.ts` | Static JSON API generator — reads `_articles/*.md`, outputs `api/*.json` |
| `src/report.ts` | Entry point for on-demand persona memos |
| `src/generate-report.ts` | Persona-addressed memos (not part of daily pipeline) |
| `ROADMAP.md` | Living roadmap injected into every prompt (~2500 chars); 4 Samir pillars + 9 phases |
| `personas/` | Expert reviewer definitions |
| `_articles/` | Markdown articles with YAML frontmatter |
| `_reports/` | On-demand persona memos |
| `api/` | Generated static JSON API (see API layer section below) |
| `packages/frontend/` | React SPA (Vite + React Router + Redux Toolkit) |
| `.github/workflows/daily-blog.yml` | Cron + manual dispatch; generate → auto-merge → deploy |
| `.github/scripts/build_pr_body.py` | Extracts frontmatter → structured PR body |
| `vercel.json` | Vercel SPA routing + API cache headers |

---

## Static JSON API layer

`src/build-api.ts` reads all `_articles/*.md`, parses YAML frontmatter + body, and outputs aggregated JSON to `api/`:

| File | Content |
|------|---------|
| `entries.json` | Complete article index (newest first). Each entry: date, title, summary, typed tags, reposActive, commitCount, activityType, schemaVersion, status, decisions[], actions[] |
| `articles/<date>.json` | Per-article detail with bodyHtml (rendered markdown) |
| `actions.json` | All open action items across all articles, filtered against `done-actions.json` |
| `done-actions.json` | Closed/resolved action items with `resolution` field and `closedDate` |
| `tags.json` | Deduplicated tag vocabulary with occurrence counts and types |
| `repos.json` | Per-repo statistics: articleCount, totalCommits, relatedTags |
| `code-refs.json` | Backfilled code reference index keyed by date (ADR-0031) |

**Build:** `pnpm build:api` or automatically during `pnpm dev` and Vercel CI.

### Action item lifecycle

1. Articles generate `suggestedActions[]` — structured items with command, description, repo
2. Open actions carry forward: `collect-context.ts` reads `api/actions.json` and injects `openActions` into the next day's `BlogContext`
3. When an action is resolved, it appears in the article's `closedActions[]` with a `resolution` field
4. `done-actions.json` is the resolution ledger — `build-api.ts` filters `actions.json` against it
5. `/frame-standup` reads both files to present the open backlog and avoid re-suggesting closed items

### Article status lifecycle (ADR-0035)

- `draft` — AI-generated, auto-published overnight, not yet reviewed
- `accepted` — Human-reviewed via inline section chat, approved
- `rejected` — Inaccurate, hidden from index

Pre-status articles default to `accepted`. Status changes via GitHub Contents API.

---

## ArticleDataV2 schema (`src/schema.ts`)

The v2 schema is the structured output format from the Claude `write_article` tool call:

```typescript
{
  schemaVersion: 2,
  title: string,
  summary: string,                    // 15-25 words
  lede?: string,                      // 1-3 sentence opening
  tags: TypedTag[],                   // { name, type } — 7 types: repo, arch, practice, phase, activity, concept, infra
  whatShipped: ShipmentEntry[],       // { repo, description, commits[], prs[]? }
  decisions: DecisionEntry[],         // { title, summary, repo, pillar?, relatedTags }
  roadmapPulse: string,              // GFM markdown, must reference every open PR
  whatsNext: string,                  // GFM markdown, 1-2 actionable items
  suggestedActions: ActionItem[],     // { command, description, repo, status: "open", sourceDate }
  closedActions?: ClosedAction[],     // { command, description, repo, sourceDate, resolution }
  codeReferences?: CodeReference[],   // { text, type, repo?, path?, url?, meta? }
  commitCount: number,
  reposActive: string[],
  activityType: 'build' | 'rest' | 'audit' | 'hardening' | 'cleanup' | 'sprint',
  status?: 'draft' | 'accepted' | 'rejected'
}
```

**Validation ladder:** v2 → v1 (backward compat) → partial v2 salvage → stub article (last resort). Ensures zero-crash overnight runs.

**Code reference types (9):** commit, component, file, package, command, config, env, endpoint, directory. Each has a classification regex pattern and optional URL resolution.

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
- Steps: `pnpm install --frozen-lockfile` → `pnpm generate` → branch `article/{date}` → PR → auto-merge (ADR-0035)
- `build_pr_body.py` extracts frontmatter to build structured PR body
- Articles publish immediately as `status: draft`; human review upgrades to `accepted`
- Vercel deployment triggered on merge; GitHub Pages serves Jekyll fallback

---

## Invariants — what not to break

- `loadPersonas()` is side-effect free — reads `personas/*.md`, no writes
- JSON fallback in `generateArticle` and `synthesizeWithCouncil` — preserve both fallbacks
- 7-day window on PRs/issues (not 24h) — prevents duplication across consecutive articles
- `SKIP_COUNCIL=true` is an intentional fast path — not a bug
- Deduplication by URL in Phase 1 — GitHub pagination produces duplicates
- Article tone: first-person plural ("we shipped"), technical, opinionated, honest (names tradeoffs)
- Mandatory body sections must survive council synthesis
- Action lifecycle is cross-article — open actions carry forward, closed actions need explicit resolution
- v2 schema validation falls back to v1 then stub — overnight runs must never crash

---

## Secondary pipeline: persona reports

`pnpm report` → `src/report.ts` → `src/generate-report.ts`
Generates addressed memos per persona (separate from the daily article).
Writes `_reports/{date}-{persona-slug}.md`. Not synthesized — direct memo per persona.

---

## Frontend (React SPA — ADR-0032)

**Primary:** `packages/frontend/` — React + Vite + Redux Toolkit, deployed to Vercel at `log.jim.software`.
**Fallback:** `src/frontend/` — vanilla TypeScript + esbuild → Jekyll/GitHub Pages.

### React SPA (`packages/frontend/`)

```
packages/frontend/src/
├── components/     # 16+ React components
├── hooks/          # 8 custom hooks
├── store/          # Redux Toolkit slices
├── styles/
├── utils/
├── App.tsx
└── main.tsx
```

Consumes the static JSON API (`api/*.json`). Features: article list with filters, per-article detail view, tag/type filtering, full-text search, dark/light theme, universal code reference popovers (ADR-0031), inline section chat (ADR-0033), article status badges.

**Build:** `pnpm build:frontend` (from workspace root) or `cd packages/frontend && pnpm build`.
**Dev:** `pnpm dev` starts Vite dev server.

### Legacy vanilla TS frontend (`src/frontend/`)

Hydrates Jekyll HTML with client-side data. Bundled by esbuild → `assets/js/app.js` (21KB). Still serves as GitHub Pages fallback.

---

## Shared skills pattern

`daily-logger/.claude/skills/` = 26 symlinks → `core/.claude/skills/`
`daily-logger/domain-knowledge/` = 6 symlinks → universal core knowledge files + this file
No daily-logger-specific commands — it uses the full core toolkit.
Propagate command changes: `./scripts/install-agents.sh daily-logger` from core.
