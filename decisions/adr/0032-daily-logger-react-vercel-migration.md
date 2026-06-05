# ADR-0032: Daily-Logger React + Vercel Migration
slug: daily-logger-react-vercel-migration
serial: 0032
domain: observation
type: infrastructure

Date: 2026-03-28
Status: Accepted
OKR: 2026-Q1 / O1 / KR1 (fleet alignment)
Commands affected: /scaffold-frame-app, /sweep, /validate
Repos affected: daily-logger, shell, core, landing
Linked: ADR-0031 (universal code reference popovers — defines the data model this renders)

---

## Context

Daily-logger's frontend has grown from a static Jekyll blog into an interactive engineering dashboard with filters, search, theme switching, commit popovers (ADR-0031), and related-article recommendations. All of this is implemented in vanilla TypeScript with manual DOM manipulation, bundled by esbuild into a single 21KB `app.js`.

Three forces are pushing toward a migration:

1. **Complexity ceiling.** The popover system, filter bar, and search are hand-rolled reimplementations of React patterns (state → render, event delegation, conditional DOM updates). Each new feature requires more manual DOM bookkeeping. ADR-0031's universal popovers will add 9 content renderers with type-specific templates — this is component work that vanilla TS handles poorly.

2. **Fleet isolation.** Every other Frame sub-app uses Vite + React 18 + Redux + Carbon + Module Federation + Vercel CDN (ADR-0001). Daily-logger is the only app that:
   - Cannot consume `@ojfbot/frame-ui-components` (ADR-0030) — requires React
   - Cannot be loaded as a Shell remote via Module Federation
   - Requires Ruby + Jekyll in CI instead of a zero-config Vite build
   - Uses GitHub Pages instead of Vercel CDN

3. **Shell integration blocked.** The Shell host (`frame.jim.software`) loads sub-apps as Module Federation remotes. Daily-logger can't participate without React — it's invisible to the Shell's navigation and context systems.

## Decision

Migrate daily-logger's frontend from Jekyll + vanilla TypeScript to Vite + React + Vercel, following the fleet's Module Federation remote pattern (ADR-0001, ADR-0030). GitHub Pages remains as a static fallback serving raw markdown articles. The static JSON API (`build-api.ts`) continues to be the data layer — React replaces only the rendering.

### Migration roadmap

#### Phase A: React SPA (standalone, Vercel)

1. Add `packages/frontend/` with Vite + React 18 + TypeScript.
2. Port existing 6 page types to React components:
   - `IndexPage` — metrics bar, filter bar, entry list, sidebar
   - `ArticlePage` — markdown rendering, related articles, code reference popovers (ADR-0031)
   - `DecisionsPage` — decision log table
   - `ActionsPage` — action items with status badges
   - `RepoDetailPage` — per-repo article list and commit stats
   - `SearchPage` — full-text search with highlighted results
3. Consume `@ojfbot/frame-ui-components` for DashboardLayout, MarkdownMessage, ErrorBoundary.
4. Redux Toolkit for global state: filters, theme, article cache (replaces vanilla `filter.ts`, `data.ts`, `theme.ts`).
5. React Router v6 for URL routes:
   - `/` → IndexPage
   - `/articles/:date` → ArticlePage
   - `/decisions` → DecisionsPage
   - `/actions` → ActionsPage
   - `/repo/:name` → RepoDetailPage
   - `/search` → SearchPage
6. Deploy to Vercel with `vercel.json` SPA routing (rewrites `/*` → `/index.html`).
7. Custom domain: `log.jim.software` (already referenced in landing portfolio).

#### Phase B: Module Federation Remote

1. Add `@originjs/vite-plugin-federation` to Vite config.
2. Expose `./Dashboard` (IndexPage) and `./ArticleView` (ArticlePage) as remote entry points.
3. Shell loads daily-logger at configured Vercel remote URL.
4. Shared singletons: `react`, `react-dom`, `@reduxjs/toolkit`, `@carbon/react`.

#### Phase C: GitHub Pages Fallback

1. Keep Jekyll build in `deploy-pages.yml` (fires on push to `main`).
2. Jekyll renders `_articles/*.md` as static HTML — no JavaScript required.
3. `_layouts/post.html` stays as minimal read-only template.
4. Add banner to Jekyll layout: "For the full interactive experience, visit log.jim.software".
5. `build-api.ts` continues to generate `api/*.json` — consumed by both React SPA and Jekyll includes.

### Project structure after migration

```
daily-logger/
├── packages/
│   └── frontend/              # React SPA
│       ├── src/
│       │   ├── components/    # React components (IndexPage, ArticlePage, etc.)
│       │   ├── store/         # Redux Toolkit slices
│       │   ├── hooks/         # Custom hooks (useEntries, useFilters, etc.)
│       │   └── main.tsx       # Entry point
│       ├── vite.config.ts
│       ├── tsconfig.json
│       └── package.json
├── src/                       # Backend pipeline (unchanged)
│   ├── index.ts
│   ├── collect-context.ts
│   ├── generate-article.ts
│   ├── build-api.ts
│   └── schema.ts
├── _articles/                 # Source of truth (markdown)
├── api/                       # Static JSON API (generated)
├── pnpm-workspace.yaml
├── vercel.json
└── package.json               # Workspace root
```

### Files created/modified

| File | Change |
|------|--------|
| `packages/frontend/` | **NEW** — React SPA (Vite, components, Redux store, hooks) |
| `packages/frontend/vite.config.ts` | **NEW** — Vite config with Module Federation plugin |
| `packages/frontend/package.json` | **NEW** — React deps, `@ojfbot/frame-ui-components`, Carbon |
| `vercel.json` | **NEW** — SPA routing, Vercel deployment config |
| `pnpm-workspace.yaml` | **NEW** — `packages: ["packages/*"]` |
| `package.json` | Convert to pnpm workspace root; keep backend scripts |
| `.github/workflows/deploy-vercel.yml` | **NEW** — Vercel deployment on push to `main` |
| `.github/workflows/deploy-pages.yml` | Keep as Jekyll fallback (no React build) |
| `_layouts/post.html` | Add "full experience" banner linking to `log.jim.software` |
| `CLAUDE.md` | Update architecture section, add frontend package docs |
| `core/domain-knowledge/daily-logger-architecture.md` | Update stack, add React + Vercel details |

## Consequences

### Gains
- Aligns with every other Frame sub-app's stack — one set of patterns, one set of tools
- Unlocks `@ojfbot/frame-ui-components` (DashboardLayout, MarkdownMessage, ChatShell)
- Shell integration via Module Federation — daily-logger appears in Shell navigation
- Vercel CDN deployment — faster, no Ruby/Jekyll in CI, preview deployments per PR
- React component model makes ADR-0031's 9 popover renderers straightforward
- Redux Toolkit replaces hand-rolled filter/theme/cache state management

### Costs
- Migration effort: 6 page types + state management + routing (estimated 2-3 focused sessions)
- Two deployment targets to maintain (Vercel primary + GitHub Pages fallback)
- `pnpm-workspace.yaml` adds workspace complexity to a previously standalone repo
- Existing vanilla TS frontend code (`src/frontend/`) becomes dead code after Phase A

### Neutral
- `build-api.ts` and the entire backend pipeline (`collect-context.ts`, `generate-article.ts`, `council.ts`) are completely unaffected — React only replaces the rendering layer
- Articles remain markdown files in `_articles/` — the source of truth doesn't change
- GitHub Pages fallback means articles are never inaccessible even if Vercel is down

## Alternatives considered

| Alternative | Why rejected |
|-------------|--------------|
| Next.js SSG | No other Frame app uses Next.js. Vite is the fleet standard. SSG adds build complexity for content that's already static JSON. |
| Keep Jekyll + enhance vanilla TS | Growing complexity (popovers, filters, search) keeps reimplementing React patterns manually. Can't use shared component library. |
| Astro | Good for content sites, but doesn't integrate with Module Federation or `@ojfbot/frame-ui-components`. No other Frame app uses it. |
| Server-side rendering (any framework) | Fleet explicitly chose CDN-only (ADR-0014). No SSR infrastructure exists. |
| Move articles to a database | Markdown files in git are the correct source of truth for a dev blog — reviewable, diffable, version-controlled. |
