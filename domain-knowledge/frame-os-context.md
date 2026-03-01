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
  └── core-reader remote  (core-reader.jim.software — ports 3015/3016)

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
| cv-builder | React/Vite, Express, LangGraph, pnpm monorepo | 3000/3001 | Most active, CI green | Has GET /api/tools ✅; browser-app NOT a Module Federation remote ❌ |
| shell | Vite Module Federation host, K8s manifests, Redux | 4000/4001 | Phase 0 complete — shell renders, Carbon chrome, dark/light mode, HomeScreen | Shell visual language does not yet match sub-apps; ShellHeader uses bare input (not Carbon component) |
| BlogEngine | React/Vite, Express, LangGraph, Notion | 3005/3006 | Agent graph + JWT auth shipped (PR #17). Module Federation configured, exposes Dashboard ✅ | GET /api/tools exists ✅ but all tools route to POST /api/v2/chat (diverges from ADR-0007 contract) |
| TripPlanner | React/Vite, Express, LangGraph, SQLite | 3010/3011 | Partial | No Module Federation ❌, no GET /api/tools ❌ — both needed (Phase 1) |
| core-reader | React/Vite, Express, LangGraph, chokidar | 3015/3016 | Planned — ADR-0010 | Not scaffolded; reads core repo filesystem via CORE_REPO_PATH |
| daily-logger | Node/Jekyll → GitHub Pages | — | Running daily, articles publishing | Phase 9 POST pipeline to BlogEngine not yet built |
| core | TypeScript, 30 slash commands | — | Active, public | /techdebt not wired to MrPlug; ADR-0007 accepted 2026-02-27 |
| MrPlug | Chrome extension MV3, React, Vite/CRXJS | — | Functional, builds clean | AI call in content script (security — Phase 2B), no /techdebt integration (Phase 5), 906KB bundle |
| purefoy | Python, Roger Deakins cinematography RAG | — | Active, in-progress work on main | Not integrated into Frame yet; upstream tracking fixed 2026-02-27 |

---

## Shell-app — what exists vs what's missing

### EXISTS (built, committed to shell repo main):
- `packages/agent-core/` — `@ojfbot/agent-core`: BaseAgent, AgentManager<T>, middleware (validateBody, getRateLimiter, errorHandler)
- `packages/frame-agent/` — Express server port 4001, MetaOrchestratorAgent, CvBuilderDomainAgent, BlogEngineDomainAgent, TripPlannerDomainAgent, `/api/chat`, `/api/chat/stream` (SSE), `/api/tools`, `/health`
- `packages/shell-app/index.html` — HTML shell (class="cds--g100" for FOUC prevention)
- `packages/shell-app/src/main.tsx` — Vite entry point (imports carbon.scss → tokens.css → index.css)
- `packages/shell-app/src/App.tsx` — root layout: Carbon Header + SideNav + AppFrame; Redux themeSlice; useEffect syncs theme class to `<html>`
- `packages/shell-app/src/components/` — AppFrame.tsx, AppSwitcher.tsx, ShellHeader.tsx (⌘K focus, chat input), HomeScreen.tsx (instance-aware launcher)
- `packages/shell-app/src/store/` — index.ts, hooks.ts, slices/appRegistrySlice.ts, slices/chatSlice.ts, slices/themeSlice.ts (toggleTheme, selectIsDark)
- `packages/shell-app/src/api/` — frame-agent-client.ts
- `packages/shell-app/src/styles/carbon.scss` — selective Carbon SCSS imports (191KB vs 600KB monolith)
- `packages/shell-app/src/themes/tokens.css` — ojf-* custom property tokens; :root (light) + .cds--g100 (dark) overrides
- `packages/shell-app/vite.config.ts` — Module Federation host config (remotes: cv_builder, blogengine, tripplanner, purefoy)
- `k8s/` — all manifests (frame-agent deployment, ingress, namespace, deployment)
- `.github/workflows/` — Claude Code Review on PR; CI (type-check + build on PR and main push)

### MISSING / next gaps:
- CI: visual regression tests (shell not yet covered; cv-builder has this)
- **Shell visual**: ShellHeader uses bare `<input>` (not Carbon `<TextInput>`); light mode tokens incomplete; visual language does not match cv-builder
- **cv-builder Module Federation**: browser-app vite.config.ts has no federation config — shell cannot load it as a remote (Phase 1)
- **TripPlanner Module Federation + GET /api/tools**: neither configured (Phase 1)
- **MetaOrchestrator dynamic discovery**: currently hardcodes tool knowledge; should fetch from GET /api/tools at startup (Phase 2, per ADR-0007)
- `spawnInstance` wired to frame-agent NL signal (Phase 4)
- AppRegistry persistence to localStorage

---

## Key architectural decisions — do not revisit without context

**Conversation history isolation:** frame-agent routes accept `conversationHistory` in request body and call `setConversationHistory()` before each request. Server holds NO per-user state. Multi-tenant safe.

**SSE over POST:** EventSource only supports GET. Streaming uses `fetch()` + `response.body.getReader()`. See `packages/shell-app/src/api/frame-agent-client.ts`.

**`classify()` is a separate Anthropic call:** Does NOT add to conversation history. Lightweight classification call that runs before the main agent call. Fast-path: if `activeAppType` is set and message is <200 chars with no cross-domain signal, skip the classify call entirely.

**Sub-app APIs are CRUD-only (target state):** Domain intelligence lives in frame-agent. Sub-app APIs expose `GET /api/tools` capability manifest. cv-builder already has this. BlogEngine and TripPlanner need it added.

**`AgentManager<T extends object>`:** NOT `T extends Record<string, BaseAgent>` — that requires an index signature. The looser `object` constraint allows typed interface shapes like `interface FrameAgents { metaOrchestrator: MetaOrchestratorAgent }`.

**Module Federation:** shell `vite.config.ts` expects remotes at: cv_builder (port 3000), blogengine (port 3005), tripplanner (port 3010), purefoy (port 3020). Production URLs via `VITE_REMOTE_*` env vars.

**K8s namespace:** `frame`. Ingress routes `frame.jim.software` (not `app.jim.software` — that subdomain was changed). frame-agent endpoint: `frame.jim.software/frame-api`.

**Package manager:** pnpm everywhere. Node pinned at v24.11.1 via `.nvmrc`. Use `fnm use` to switch.

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

- **AppType:** `'cv-builder' | 'tripplanner' | 'blogengine' | 'purefoy'`
- **Instance:** named running context of an app type ("Tokyo 2025", "Berlin Interviews")
- **Thread:** named conversation within an instance ("Flights", "Accommodation")
- Multiple instances of same app type are fully supported
- `activeAppType` from appRegistry is passed to frame-agent as context on every message — enables domain routing

---

## The roadmap phases

| Phase | What | Repo(s) | Status |
|-------|------|---------|--------|
| 0 | App.tsx + main.tsx + index.html in shell-app | shell | ✅ Complete |
| 1A | CoreReader Phase 1 — scaffold repo, read-only Commands + ADRs tabs, Shell MF integration (**fast-tracked**) | core-reader, shell | Not started |
| 1B | Module Federation for cv-builder + TripPlanner; GET /api/tools on TripPlanner; BlogEngine tools fix | cv-builder, TripPlanner, BlogEngine | In progress — BlogEngine ✅, cv-builder ❌, TripPlanner ❌ |
| 1 ship | All 1A + 1B work ships together as a single milestone | — | Blocked on 1A + 1B |
| 1.5 | Shell visual foundations — ShellHeader Carbon component, light mode tokens, visual parity with sub-apps | shell | Not started |
| 2 | classify() quality audit + routing UX; thread resumption synthesis; MetaOrchestrator → dynamic GET /api/tools fetch | shell/frame-agent | Not started |
| 2B | MrPlug: AI → background service worker | MrPlug | Not started |
| 2C | CoreReader Phase 2 — OKRs, Roadmap, Docs tabs; cross-entity links | core-reader | Not started |
| 3 | Cross-domain coordination (hero demo) | shell/frame-agent | Not started |
| 3B | Earned badge threshold + conversation-aware suggestions | shell/frame-agent | Not started |
| 3C | CoreReader Phase 3 — git worktree-staged mutations; WebSocket live sync | core-reader | Not started |
| 4 | NL instance spawning — MetaOrchestrator spawn_instance + shell handler | shell/frame-agent | Not started |
| 4B | core: make public + CLAUDE.md + polish /techdebt | core | Not started |
| 4C | CoreReader Phase 4 — LangGraph chat agent via frame-agent; Cmd+K search | core-reader, frame-agent | Not started |
| 5 | MrPlug /techdebt integration | MrPlug + core | Not started |
| 6 | Deploy frame.jim.software via K8s | shell, K8s | Not started |
| 7 | cv-builder tailors the actual TBC application | cv-builder | Final step |

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
- Do not push to main without a PR unless fixing a CI workflow bug

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
| /techdebt command | `core/.claude/commands/techdebt.md` |
| MrPlug AI call (to migrate) | `MrPlug/src/content/index.tsx` + `MrPlug/src/background/index.ts` |
