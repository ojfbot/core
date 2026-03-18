---
name: scaffold-frame-app
description: >
  Scaffold a new Frame OS client application with full architecture patterns pre-wired:
  4-package monorepo, Module Federation remote, Carbon tabbed dashboard, side panel with
  sessions/chat, shell integration (app registry, frame-agent domain, frame-dev.sh), and
  deterministic build+test validation. Use when creating any new Frame client app.
---

You are a senior engineer scaffolding a new Frame OS client application. You generate a
production-ready, shell-integrated project skeleton that looks and behaves like the mature
apps (cv-builder, lean-canvas, gastown-pilot) from day one.

**Tier:** 3 — Complex multi-step procedure with validation
**Phase:** Project inception

## Input

Parse `$ARGUMENTS` for:
- `--name=<slug>` — required: kebab-case project name (e.g. `fleet-monitor`)
- `--display=<text>` — required: human-readable display name (e.g. `Fleet Monitor`)
- `--port=<browser-port>` — required: browser-app port (e.g. `3030`)
- `--api-port=<api-port>` — required: API port (e.g. `3031`)
- `--tabs=<comma-list>` — required: tab slugs (e.g. `overview,agents,logs,settings`)
- `--tab-labels=<comma-list>` — optional: tab display labels (defaults to Title Case of slugs)
- `--org=<github-org>` — optional (default: `ojfbot`)
- `--dir=<path>` — optional: parent directory (default: `/Users/yuri/ojfbot/`)
- `--singleton` — optional flag: app is singleton in shell (default: false)
- `--description=<text>` — optional: one-line purpose

If any required param is missing: list what's needed and stop.

## Steps

### Step 1 — Load references

Read these files (JIT — do not embed their contents in this skill):
- `domain-knowledge/app-templates.md` — canonical file list, deps, UI patterns
- `domain-knowledge/shared-stack.md` — Carbon patterns, auth, SSE
- `domain-knowledge/frame-os-context.md` — repo inventory, port map, constraints

### Step 2 — Validate inputs

Before writing any files:
1. Confirm port is not already in use by another app (check frame-os-context.md repo inventory)
2. Confirm name doesn't collide with existing repos
3. Confirm target directory doesn't already exist or is empty
4. Output the full plan: directory, ports, tabs, display name, singleton status

### Step 3 — Create the 4-package monorepo

Write all files per `app-templates.md` langgraph-app template, with these **mandatory** patterns:

#### 3a. Root config
- `package.json` with `build`, `dev:all`, `test`, `lint` scripts + `concurrently` dep
- `pnpm-workspace.yaml`
- `tsconfig.base.json` with `module: "ES2022"` + `moduleResolution: "bundler"` (NOT NodeNext)
- `vitest.config.ts`, `biome.json`, `.github/workflows/ci.yml`, `.gitignore`, `.env.example`

#### 3b. `packages/shared`
- `types.ts`: tab type union, `TAB_SLUGS` array, `PANEL_TABS` array, settings interface, domain types
- `index.ts`: re-exports
- Smoke test: `src/__tests__/types.test.ts` (validates TAB_SLUGS length + PANEL_TABS coverage)

#### 3c. `packages/agent-graph`
- State schema with Annotation pattern
- Stub prime node
- Graph with conditional edges

#### 3d. `packages/api`
- `tsconfig.json` with `declaration: false, declarationMap: false` (avoids Express TS2742)
- Express server on `<api-port>` with MOCK_AUTH, CORS
- `routes/health.ts`, `routes/tools.ts` (ADR-0007 manifest), domain routes (one per tab)
- Auth middleware, logger utility

#### 3e. `packages/browser-app`
- `package.json` with ALL deps: `@carbon/react`, `@carbon/icons-react`, `@carbon/styles`, `sass`,
  `@tanstack/react-query`, `@reduxjs/toolkit`, `react-redux`, `vite-plugin-css-injected-by-js`,
  `@originjs/vite-plugin-federation`
- `vite.config.ts`: `cssInjectedByJs` BEFORE `federation`, singleton shared map including `@carbon/react`
- `main.tsx`: imports `@carbon/styles/css/styles.css`
- `store/store.ts`: configureStore with threadsSlice + chatSlice, typed hooks
- `store/threadsSlice.ts`: threads, activeThreadId, sidebarExpanded, activePanelTab
- `store/chatSlice.ts`: messages, draftInput, isLoading, streamingContent
- `Dashboard.tsx`: MF export, wraps in `<Provider store={store}><QueryClientProvider>` (double-Provider)
- `DashboardContent.tsx`: Heading + contained Tabs + sidebar toggle (Menu/Close icons)
- `Dashboard.css`: full shell-mode flex chain (wrapper, with-sidebar, tab overrides — copy from template)
- `<Name>SidePanel.tsx`: right-rail 320px panel with Sessions + Chat tabs, inert when collapsed
- `<Name>SidePanel.css`: fixed positioning, slide transition, session list, chat messages, input area
- `panels/`: one stub component per tab
- `App.tsx`: standalone dev wrapper
- `pages/Settings.tsx`: MF-exported settings page

### Step 4 — Write CLAUDE.md

Include: commands, 4-package architecture table, tab/panel table, data architecture,
MF integration notes, key conventions, Frame vocabulary.

### Step 5 — Shell integration

Edit files in the **shell repo** (`/Users/yuri/ojfbot/shell/`):

| File | Change |
|------|--------|
| `packages/shell-app/src/store/slices/appRegistrySlice.ts` | Add to `AppType` union, `APP_CONFIG`, `DEFAULT_APP_TYPES` |
| `packages/shell-app/src/components/AppFrame.tsx` | Add to `REMOTE_LOADERS` |
| `packages/shell-app/src/remotes/settings-loaders.ts` | Add to `SETTINGS_LOADERS` + `SETTINGS_META` |
| `packages/shell-app/vite.config.ts` | Add MF remote entry |
| `packages/frame-agent/src/domain-registry.ts` | Add domain keywords |
| `packages/frame-agent/src/domain-agents/<name>-agent.ts` | **Create** domain agent stub |
| `packages/frame-agent/src/meta-orchestrator.ts` | Add to DomainType, constructor, route/routeStream, classify, spawn, history, fanOut, stubs, manifest |
| `packages/frame-agent/src/services/frame-agent-manager.ts` | Add API URL env var |

### Step 6 — frame-dev.sh integration

Edit `scripts/frame-dev.sh` in the **core repo** to add:
- `start_subapp` call for browser-app
- API dev server start block
- `stop_port` entries for both ports
- `status_port` entries for both ports

### Step 7 — Update frame-os-context.md

Add the new app to the repo inventory table in `domain-knowledge/frame-os-context.md`.

### Step 8 — Initialize git + install + build

```bash
cd <project-dir>
git init -b main
pnpm install
pnpm build
pnpm test
```

### Step 9 — Deterministic validation

> **Load `knowledge/validation-checklist.md`** for the full 30-item checklist.

Run ALL of the following checks. Report each as PASS/FAIL. If ANY fail, fix before proceeding.

**Build gate:**
1. `pnpm install --frozen-lockfile` exits 0
2. `pnpm build` exits 0 (all 4 packages compile)
3. `pnpm test` exits 0 (at least 1 test passes)
4. `dist/assets/remoteEntry.js` exists in browser-app build output

**Port gate:**
5. `vite preview` serves on `<browser-port>` (verify with `curl localhost:<port>/assets/remoteEntry.js`)
6. API serves on `<api-port>` (verify with `curl localhost:<api-port>/health`)
7. API tools manifest responds (verify with `curl localhost:<api-port>/api/tools`)

**UI structure gate (grep the built Dashboard chunk):**
8. Dashboard.css contains `.shell-mode` class
9. Dashboard.css contains `.with-sidebar` class
10. Dashboard.css contains `.cds--tabs--contained` override
11. DashboardContent.tsx uses `<TabList ... contained>`
12. DashboardContent.tsx renders `<Heading>` (always visible, not gated by shellMode)
13. SidePanel component uses `inert` attribute pattern
14. `store/store.ts` exports `useAppDispatch` and `useAppSelector`
15. `Dashboard.tsx` wraps with both `<Provider>` and `<QueryClientProvider>`

**Shell integration gate (grep shell repo files):**
16. `AppType` union includes `'<name>'`
17. `APP_CONFIG` has entry for `'<name>'`
18. `DEFAULT_APP_TYPES` array includes `'<name>'`
19. `REMOTE_LOADERS` has entry for `'<name>'`
20. `SETTINGS_LOADERS` has entry for `'<name>'`
21. `DOMAIN_REGISTRY` has entry with `id: '<name>'`
22. `DomainType` union includes `'<name>'`
23. Shell `vite.config.ts` has MF remote for `<name>`
24. `frame-agent-manager.ts` has env var for the API URL

**Infrastructure gate:**
25. `frame-dev.sh` start section includes both ports
26. `frame-dev.sh` stop section includes both ports
27. `frame-dev.sh` status section includes both ports
28. `frame-os-context.md` repo inventory includes the new app

### Step 10 — Output summary

Report validation results table (28 items), then output:
- GitHub create repo command: `gh repo create ojfbot/<name> --private --source=. --push`
- Next steps checklist (wire real data adapters, implement panel content, etc.)

## Constraints

- Do not implement business logic in panels — stubs only.
- Do not run `git push` or create GitHub repo without user confirmation.
- Do not modify files outside the new project directory AND shell repo AND core repo.
- If `domain-knowledge/app-templates.md` and this skill conflict: prefer this skill (it's newer).
- All CSS class names must be prefixed with the app name to avoid collisions in shell.

---

$ARGUMENTS
