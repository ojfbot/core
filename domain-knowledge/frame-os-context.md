# Frame OS — Agent Context Brief

**Read this before making any architectural decisions or writing any code in any ojfbot repo.**

---

## Who this is for

Jim Green, a software engineer targeting a Design Engineer role at The Browser Company (building Dia, the AI-native browser). This codebase is both a professional portfolio and a live product. Every decision is made through two lenses simultaneously: does this make Frame better, and does this demonstrate engineering excellence to a hiring panel.

**The one-sentence pitch:**
"I'm not an engineer who uses AI tools. I'm an engineer who builds them — and I've been building the application layer of what you're building at the browser layer."

**The structural analogy:** Frame shell : Dia :: application layer : browser layer

---

## What we're building — Frame OS

Frame is an AI-native application OS.

```
frame.jim.software (shell — port 4000)
  Vite Module Federation HOST
  Loads sub-apps as real React remotes (no iframes)
  Shared React/Redux/RTK singleton across all apps

  ├── cv-builder remote   (cv.jim.software        — ports 3000/3001)
  ├── blogengine remote   (blog.jim.software       — ports 3005/3006)
  ├── tripplanner remote  (trips.jim.software      — ports 3010/3011)
  ├── purefoy remote      (purefoy.jim.software)
  ├── core-reader remote  (core-reader.jim.software — ports 3015/3016)
  └── seh-study remote    (seh-study.jim.software  — ports 3030/3031)

frame-agent (port 4001)
  Single LLM gateway for the entire cluster
  ONE Anthropic API key
  MetaOrchestratorAgent — classifies NL intent → routes to domain
  ├── CvBuilderDomainAgent
  ├── BlogEngineDomainAgent
  └── TripPlannerDomainAgent
```

The shell is NOT an aggregator of iframes. It is a compositor — Module Federation remotes, shared Redux store, single AI gateway.

---

## The two demo tracks — critical framing

Every piece of work maps to one or both tracks. Never conflate them.

### Track A — Pitching Frame (the product)

AI experience design, not AI integration:

- **Routing as understanding** — `classify()` routes NL to the right domain silently, correctly. The user never thinks about routing.
- **Thread continuity as memory** — returning to a thread, the agent synthesizes "last time you were..." from actual history, not a template.
- **Cross-domain coordination as magic** — "I'm applying for Berlin jobs, how does this affect my trip plans and resume?" → cv-builder + tripplanner agents fan out, MetaOrchestrator synthesizes one coherent answer. This is the hero demo moment.
- **Earned badge suggestions** — surface suggestions only after ≥2 messages, referencing specific things said, not profile data.
- **NL instance spawning** — "new trip to Berlin, I have interviews there" → TripPlanner instance "Berlin Interviews" appears. The LLM signals intent; the shell acts.

What we are NOT doing: theme switching, CSS brand skins, visual design demos. That's "any LLM can do it" territory. We design delightful AI experiences.

### Track B — Pitching the engineer

- **Visual regression CI** — every UI change runs screenshot diffs against baseline. PRs block on regression. cv-builder has this live and passing.
- **MrPlug + /techdebt loop** — Chrome extension runs AI UI/UX analysis on live UIs → structured `/techdebt` payload → core `/techdebt propose` generates patches → `/techdebt apply` ships improvements.
- **daily-logger** — Claude auto-commits a dev log to `log.jim.software` daily, sweeping all ojfbot repos. Passive proof of sustained output.
- **core** — 30 slash commands systematizing the entire workflow. `/techdebt` is the keystone.

---

## Full repo inventory

| Repo | Tech | Port(s) | Status | Key gap |
|------|------|---------|--------|---------|
| cv-builder (display: "Resume Builder") | React/Vite, Express, LangGraph, pnpm monorepo | 3000/3001 | Most active, CI green | Has GET /api/tools ✅; Module Federation remote ✅ (Dashboard + Settings exposed) |
| shell | Vite Module Federation host, K8s manifests, Redux | 4000/4001 | Phase 1 shipped — shell renders, Carbon chrome, dark/light mode, HomeScreen, SettingsModal (ADR-0011), Vercel live at frame.jim.software | ShellHeader uses bare input (not Carbon component); light mode tokens incomplete |
| BlogEngine | React/Vite, Express, LangGraph, Notion | 3005/3006 | Agent graph + JWT auth shipped. Module Federation configured, exposes Dashboard + Settings ✅ | GET /api/tools exists ✅ but all tools route to POST /api/v2/chat (diverges from ADR-0007 contract) |
| TripPlanner | React/Vite, Express, LangGraph, SQLite | 3010/3011 | Module Federation remote ✅ (Dashboard + Settings exposed) | GET /api/tools ✅ — PR #27 open (Phase 1) |
| lean-canvas | React/Vite, Express, LangGraph, Carbon DS | 3025/3026 | Scaffolded 2026-03-17 — MF remote, 9-section AI canvas, frame-agent routing | shell registration in progress |
| core-reader | React/Vite, Express, LangGraph, chokidar | 3015/3016 | Planned — ADR-0010 | Not scaffolded; reads core repo filesystem via CORE_REPO_PATH |
| daily-logger | Node/Jekyll → GitHub Pages | — | Running daily, articles publishing | Phase 9 POST pipeline to BlogEngine not yet built |
| core | TypeScript, 30 slash commands | — | Active, public | /techdebt not wired to MrPlug; ADR-0007 accepted 2026-02-27 |
| MrPlug | Chrome extension MV3, React, Vite/CRXJS | — | Functional, builds clean | AI call in content script (security — Phase 2B), no /techdebt integration (Phase 5), 906KB bundle |
| gastown-pilot | React/Vite, Express, LangGraph, Carbon DS, React Query | 3017/3018 | Scaffolded 2026-03-18 — MF remote, 6-tab Gas Town dashboard, 12 panel stubs, 3 data adapters (ADR-0027/0028) | All data sources stubbed; shell registration pending; gt CLI + Dolt not wired |
| seh-study | React/Vite, Express, Carbon DS, Leitner SR | 3030/3031 | Scaffolded 2026-03-22 — MF remote, 3-tab dashboard (Study/Browse/Progress), 238 NASA SEH glossary terms, Leitner 5-box spaced repetition | Shell registration complete; content + SR engine pending |
| purefoy | Python, Roger Deakins cinematography RAG | — | Active, in-progress work on main | Not integrated into Frame yet; upstream tracking fixed 2026-02-27 |
| frame-ui-components | Shared React component library (Carbon DS) | — | All 9 sub-apps consuming | Storybook stories for 4 of 7 components missing (ADR-0030) |

---

## Shell-app — what exists vs what's missing

### EXISTS (built, committed to shell repo main):
- `packages/agent-core/` — `@ojfbot/agent-core`: BaseAgent, AgentManager<T>, middleware (validateBody, getRateLimiter, errorHandler)
- `packages/frame-agent/` — Express server port 4001, MetaOrchestratorAgent, CvBuilderDomainAgent, BlogEngineDomainAgent, TripPlannerDomainAgent, `/api/chat`, `/api/chat/stream` (SSE), `/api/tools`, `/health`
- `packages/shell-app/index.html` — HTML shell (class="cds--g100" for FOUC prevention)
- `packages/shell-app/src/main.tsx` — Vite entry point (imports carbon.scss → tokens.css → index.css)
- `packages/shell-app/src/App.tsx` — root layout: Carbon Header + SideNav + AppFrame; Redux themeSlice; useEffect syncs theme class to `<html>`
- `packages/shell-app/src/components/` — AppFrame.tsx, AppSwitcher.tsx, ShellHeader.tsx (⌘K focus, chat input), HomeScreen.tsx (instance-aware launcher)
- `packages/shell-app/src/store/` — index.ts, hooks.ts, slices/appRegistrySlice.ts, slices/chatSlice.ts, slices/themeSlice.ts (toggleTheme, selectIsDark), slices/settingsSlice.ts (typed per-app settings + AppCapabilityManifest isolation — ADR-0011)
- `packages/shell-app/src/components/SettingsModal.tsx` — multi-panel settings (ADR-0011): tab bar with auto-jump to active app, search bar, Carbon ComposedModal, localStorage persistence
- `packages/shell-app/src/remotes/settings-loaders.ts` — MF lazy loaders for sub-app Settings panels + SETTINGS_META search registry
- `packages/shell-app/src/api/` — frame-agent-client.ts
- `packages/shell-app/src/styles/carbon.scss` — selective Carbon SCSS imports (191KB vs 600KB monolith)
- `packages/shell-app/src/themes/tokens.css` — ojf-* custom property tokens; :root (light) + .cds--g100 (dark) overrides
- `packages/shell-app/vite.config.ts` — Module Federation host config (remotes: cv_builder, blogengine, tripplanner, purefoy)
- `k8s/` — all manifests (frame-agent deployment, ingress, namespace, deployment)
- `.github/workflows/` — Claude Code Review on PR; CI (type-check + build on PR and main push); Deploy to Vercel on push to main

### MISSING / next gaps:
- CI: visual regression tests (shell not yet covered; cv-builder has this)
- **Shell visual**: ShellHeader uses bare `<input>` (not Carbon `<TextInput>`); light mode tokens incomplete; visual language does not match cv-builder
- **TripPlanner GET /api/tools**: not yet implemented (Phase 1)
- **BlogEngine GET /api/tools**: exists but routes all tools to `POST /api/v2/chat` — diverges from ADR-0007 contract (Phase 1 fix needed)
- **MetaOrchestrator dynamic discovery**: currently hardcodes tool knowledge; should fetch from GET /api/tools at startup (Phase 2, per ADR-0007)
- `spawnInstance` wired to frame-agent NL signal (Phase 4)
- AppRegistry persistence to localStorage
- core-reader remote: not yet scaffolded (Phase 1A)

---

## Key architectural decisions — do not revisit without context

**Conversation history isolation:** frame-agent routes accept `conversationHistory` in request body and call `setConversationHistory()` before each request. Server holds NO per-user state. Multi-tenant safe.

**SSE over POST:** EventSource only supports GET. Streaming uses `fetch()` + `response.body.getReader()`. See `packages/shell-app/src/api/frame-agent-client.ts`.

**`classify()` is a separate Anthropic call:** Does NOT add to conversation history. Lightweight classification call that runs before the main agent call. Fast-path: if `activeAppType` is set and message is <200 chars with no cross-domain signal, skip the classify call entirely.

**Sub-app APIs are CRUD-only (target state):** Domain intelligence lives in frame-agent. Sub-app APIs expose `GET /api/tools` capability manifest. cv-builder already has this. BlogEngine and TripPlanner need it added.

**`AgentManager<T extends object>`:** NOT `T extends Record<string, BaseAgent>` — that requires an index signature. The looser `object` constraint allows typed interface shapes like `interface FrameAgents { metaOrchestrator: MetaOrchestratorAgent }`.

**Module Federation:** shell `vite.config.ts` expects remotes at: cv_builder (port 3000), blogengine (port 3005), tripplanner (port 3010), purefoy (port 3020). Production URLs via `VITE_REMOTE_*` env vars.

**Module Federation shared singletons:** All sub-apps must include `@carbon/react: { singleton: true, requiredVersion: '^1.67.0' }` in their MF `shared` config alongside react, react-dom, RTK, react-redux. Missing `@carbon/react` causes duplicate instances and broken CSS class resolution. The `singleton`/`requiredVersion` options require `as any` cast — type gap in `@originjs/vite-plugin-federation` v1.4.x types. See ADR-0012.

**`remoteEntry.js` must use `Cache-Control: no-store`:** It is the MF index file mapping chunk hashes — caching it causes the shell to reference stale asset paths after a redeploy. All sub-app `vercel.json` files have a specific rule for `/assets/remoteEntry.js`. Content-hashed assets use `max-age=31536000, immutable`.

**MF local dev:** `@originjs/vite-plugin-federation` only generates `remoteEntry.js` on `vite build`, NOT `vite dev`. Run `vite build && vite preview` for sub-apps in local MF development. Shell can use `vite dev`.

**Settings isolation (ADR-0011):** Shell owns all settings state via `settingsSlice`. Sub-apps expose `./Settings` via MF and use scoped selectors only (`selectAppSettings(state, appType)`). Cross-namespace reads require explicit `setCapabilities()` dispatch from shell. Shell's `SETTINGS_META` registry powers search without inspecting lazy-loaded panel components.

**K8s namespace:** `frame`. Ingress routes `frame.jim.software` (not `app.jim.software` — that subdomain was changed). frame-agent endpoint: `frame.jim.software/frame-api`. NOTE: K8s is Layer 2 (future) — see ADR-0014. Current live deployment is Vercel (Layer 1 CDN).

**Package manager:** pnpm everywhere. Node pinned at v24.11.1 via `.nvmrc`. Use `fnm use` to switch.

**Shared UI component library (ADR-0030):** `@ojfbot/frame-ui-components` is the single source of truth for 7 shared components used by all 9 sub-apps: DashboardLayout, ChatShell, ChatMessage, ThreadSidebar, MarkdownMessage, BadgeButton, ErrorBoundary. Consumed as a source-dependency (`file:../../../frame-ui-components`). Components are pure/prop-driven — no Redux. Each app creates `*Connected.tsx` wrappers that wire Redux state to props (extends ADR-0029 pattern). Styles imported per-component: `import '@ojfbot/frame-ui-components/styles/chat-shell'`. Also exports action type system (`BadgeAction`, `Action` union, factory functions like `createSimpleBadge`, `getChatMessage`). Canonical export list: `frame-ui-components/src/index.ts`.

---

## CI status — cv-builder (the most mature repo)

All gates currently passing on main:
- Browser Automation Tests (visual regression + UI tests) ✅
- Security Scan (TruffleHog + API key scan + dist check) ✅
- Audit Dependencies ✅
- Verify Clean Install + type-check + build ✅
- Claude Code Review — runs on PRs
- blog-post-proposer workflow — only fires on actual PR events (fixed false-trigger bug)

---

## Data model — App → Instance → Thread

Defined in `packages/shell-app/src/store/slices/appRegistrySlice.ts`:

- **AppType:** `'cv-builder' | 'tripplanner' | 'blogengine' | 'purefoy' | 'core-reader'`
- **Instance:** named running context of an app type ("Tokyo 2025", "Berlin Interviews")
- **Thread:** named conversation within an instance ("Flights", "Accommodation")
- Multiple instances of same app type are fully supported
- `activeAppType` from appRegistry is passed to frame-agent as context on every message — enables domain routing

---

## The roadmap phases

| Phase | What | Repo(s) | Status |
|-------|------|---------|--------|
| 0 | App.tsx + main.tsx + index.html in shell-app | shell | ✅ Complete |
| 1A | CoreReader Phase 1 — scaffold repo, read-only Commands + ADRs tabs, Shell MF integration (**fast-tracked**) | core-reader, shell | ✅ Complete — repo live, Commands + ADRs tabs serving, Shell MF singleton ✅, Vercel deployed (ADR-0014) |
| 1B | Module Federation for cv-builder + TripPlanner; GET /api/tools on TripPlanner; BlogEngine tools fix | cv-builder, TripPlanner, BlogEngine | MF ✅ all three; GET /api/tools: cv-builder ✅, blogengine ⚠️ (partial), tripplanner ❌ |
| 1 ship | All 1A + 1B work ships together as a single milestone | — | Partial — MF live, tools/CoreReader gap remains |
| 1.5 | Shell visual foundations — ShellHeader Carbon component, light mode tokens, visual parity with sub-apps | shell | Partial — ShellHeader Carbon TextInput ✅; `@ojfbot/shell` Phase 1 extraction scaffold ✅; light mode tokens + full visual parity pending |
| 2 | classify() quality audit + routing UX; thread resumption synthesis; MetaOrchestrator → dynamic GET /api/tools fetch | shell/frame-agent | Partial — cross-domain keyword co-presence detection fixed ✅; thread resumption + dynamic `/api/tools` fetch pending |
| 2B | MrPlug: AI → background service worker | MrPlug | Not started |
| 2C | CoreReader Phase 2 — OKRs, Roadmap, Docs tabs; cross-entity links | core-reader | Not started |
| 3 | Cross-domain coordination (hero demo) | shell/frame-agent | Not started |
| 3B | Earned badge threshold + conversation-aware suggestions | shell/frame-agent | Not started |
| 3C | CoreReader Phase 3 — git worktree-staged mutations; WebSocket live sync | core-reader | Not started |
| 4 | NL instance spawning — MetaOrchestrator spawn_instance + shell handler | shell/frame-agent | Not started |
| 4B | core: make public + CLAUDE.md + polish /techdebt | core | Not started |
| 4C | CoreReader Phase 4 — LangGraph chat agent via frame-agent; Cmd+K search | core-reader, frame-agent | Not started |
| 5 | MrPlug /techdebt integration | MrPlug + core | Not started |
| 6 | Deploy frame.jim.software via K8s (Layer 2) | shell, K8s | Layer 1 (Vercel static) ✅ live — ADR-0013/0014; Layer 2 (APIs + frame-agent) not yet deployed |
| 7 | cv-builder tailors the actual TBC application | cv-builder | Final step |

> **Gas Town (ADR-0015/0016/0017) — cross-cutting:** FrameBead universal work primitive defined; `FrameBeadLike` interface + `FilesystemBeadStore` in core-reader ✅; cv-builder `/api/beads` ✅; shell `/api/beads` aggregation pending. Not a numbered phase — runs alongside 1B–3.

**Time-sensitive:** daily-logger must start running daily NOW. Every day without an entry is lost shipping signal.

---

## Environment variables — what each service needs

**frame-agent (port 4001):**
```
ANTHROPIC_API_KEY=sk-ant-...
CV_BUILDER_API_URL=http://localhost:3001
BLOGENGINE_API_URL=http://localhost:3006
TRIPPLANNER_API_URL=http://localhost:3011
CORE_READER_API_URL=http://localhost:3016
CORS_ORIGIN=http://localhost:4000
PORT=4001
```

**shell-app (port 4000):**
```
VITE_FRAME_AGENT_URL=http://localhost:4001
VITE_REMOTE_CV_BUILDER=http://localhost:3000
VITE_REMOTE_BLOGENGINE=http://localhost:3005
VITE_REMOTE_TRIPPLANNER=http://localhost:3010
VITE_REMOTE_PUREFOY=http://localhost:3020
VITE_REMOTE_CORE_READER=http://localhost:3016
```

**core-reader api (port 3016):**
```
CORE_REPO_PATH=/path/to/ojfbot/core
PORT=3016
CORS_ORIGIN=http://localhost:4000
```

**cv-builder api (port 3001):** `ANTHROPIC_API_KEY` via `packages/agent-core/env.json`

---

## Things NOT to do

- Do not add theme switching / CSS brand skin demos to priority work — explicitly deprioritized
- Do not use iframes in the shell — Module Federation only
- Do not add direct Anthropic calls in sub-app APIs — frame-agent is the single LLM gateway
- Do not commit `env.json`, `.env.local`, `dist/`, `node_modules/` — TruffleHog will block the PR
- Do not create helpers or abstractions for one-time operations
- Do not add error handling for scenarios that can't happen — trust the framework
- Do not push to main without a PR — all 4 repos have GitHub Rulesets enforcing PR-required, rebase-only merge
- Do not use `vite dev` for sub-apps in MF local dev — `remoteEntry.js` only generates on `vite build`. Use `vite preview` for sub-apps.

---

## Live deployment state — 2026-03-03

Layer 1 (Vercel CDN) is live (ADR-0013/ADR-0014):

| Domain | Repo | Status |
|--------|------|--------|
| frame.jim.software | shell browser-app | ✅ Live |
| cv.jim.software | cv-builder browser-app | ✅ Live |
| blog.jim.software | blogengine browser-app | ✅ Live |
| trips.jim.software | tripplanner browser-app | ✅ Live |
| core-reader.jim.software (or /api route) | core-reader browser-app + API | ✅ Live (ADR-0014) |

Layer 2 (Express APIs + frame-agent) NOT YET deployed — all 4 apps run in UI wireframe mode (ADR-0013). LLM chat returns offline state gracefully.

Branch protection: All 4 repos (shell, cv-builder, blogengine, TripPlanner) have GitHub Rulesets — PR required, rebase-only merge on default branch.

---

## Files to read before working in a specific area

| Area | Read first |
|------|------------|
| frame-agent routing | `shell/packages/frame-agent/src/meta-orchestrator.ts` |
| Domain agents | `shell/packages/frame-agent/src/domain-agents/cv-builder-agent.ts` |
| Shell Redux store | `shell/packages/shell-app/src/store/slices/appRegistrySlice.ts` |
| CV builder agents | `cv-builder/packages/agent-core/src/agents/orchestrator-agent.ts` |
| Visual regression CI | `cv-builder/.github/workflows/browser-automation-tests.yml` |
| K8s topology | `shell/k8s/` (namespace, shell deployment, frame-agent deployment, ingress) |
| Settings modal | `shell/packages/shell-app/src/components/SettingsModal.tsx` + `settingsSlice.ts` + `settings-loaders.ts` |
| MF integration pattern | `core/decisions/adr/0012-module-federation-remote-integration-pattern.md` |
| Deployment topology | `core/decisions/adr/0013-safe-demo-deployment.md` + `0014-layered-deployment-architecture.md` |
| /techdebt command | `core/.claude/skills/techdebt.md` |
| MrPlug AI call (to migrate) | `MrPlug/src/content/index.tsx` + `MrPlug/src/background/index.ts` |
| Shared UI components | `frame-ui-components/src/index.ts` + `core/decisions/adr/0030-shared-frame-ui-components-library.md` |
