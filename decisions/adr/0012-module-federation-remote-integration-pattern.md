# ADR-0012: Module Federation Remote Integration Pattern

Date: 2026-03-02
Status: Accepted
OKR: 2026-Q1 / O1 / KR1
Commands affected: /scaffold, /validate, /plan-feature
Repos affected: shell, cv-builder, blogengine, tripplanner, core-reader

---

## Context

As of 2026-03-02, four sub-apps (cv-builder, blogengine, tripplanner, core-reader) are
registered as Module Federation remotes consumed by the shell host. Each integration
required the same three steps, but the pattern existed only in code — in vite config
comments and the frame-dev.sh script — not in a canonical spec.

Without a written contract, each new remote was integrated ad-hoc. Two integration
problems have already been observed:

1. **Missing `vite-plugin-css-injected-by-js`**: Remotes that omit this plugin serve
   CSS as a separate `.css` asset. The shell host never loads it (the asset belongs to
   the remote origin), so the remote renders unstyled inside the shell.
2. **Unscoped CSS injection**: Remotes that apply `cssInjectedByJs` to all chunks inject
   styles into shared singletons (e.g. `react-dom`) that the shell provides. Those chunks
   are never evaluated in the shell runtime, so CSS is never applied.

Both failures are silent in dev (remotes run standalone) and only surface when the shell
loads the remote via Module Federation.

This ADR formalises the three-step checklist that all four existing remotes have
converged on.

## Decision

Any Frame OS sub-app that becomes a registered Module Federation remote **must complete
all three steps** before the shell can safely consume it.

### Step 1 — `shellMode` prop suppresses standalone chrome

The remote's `Dashboard` component (and any other MF-exposed component) must accept a
`shellMode: boolean` prop. When `shellMode={true}`, the component must suppress all
standalone chrome: title headings, standalone margins, top-level navigation, and any
other UI that the shell provides at the host layer.

```tsx
// Sub-app: src/components/Dashboard.tsx
interface DashboardProps {
  instanceId: string
  threadId: string | null
  shellMode: boolean
}

export function Dashboard({ shellMode, instanceId, threadId }: DashboardProps) {
  return (
    <div className={shellMode ? 'dashboard--embedded' : 'dashboard--standalone'}>
      {/* Never render <Header>, <SideNav>, or standalone page title when shellMode */}
      <AppPanel instanceId={instanceId} threadId={threadId} />
    </div>
  )
}
```

The shell always passes `shellMode={true}` from `AppFrame.tsx`. Standalone mode
(`shellMode={false}` or omitted) is used by local dev and QA.

**Relationship to ADR-0009:** ADR-0009 specifies the long-term dual-entry-point
architecture (`main.tsx` / `embedded.tsx`). `shellMode` is the currently implemented
mechanism — a prop-based toggle on the shared `Dashboard` entry point — used by all
four remotes pending the ADR-0009 migration.

### Step 2 — `vite-plugin-css-injected-by-js` scoped to exposed chunks

The remote's `vite.config.ts` must include `vite-plugin-css-injected-by-js` with a
`jsAssetsFilterFunction` that restricts injection to federation-exposed chunks only.

```ts
// Sub-app: vite.config.ts
import cssInjectedByJs from 'vite-plugin-css-injected-by-js'
import federation from '@originjs/vite-plugin-federation'

export default defineConfig({
  plugins: [
    react(),
    // cssInjectedByJs MUST come before federation in the plugins array.
    // The filter restricts CSS injection to exposed chunks only.
    // The '__federation_expose_' prefix is @originjs/vite-plugin-federation's
    // internal naming convention (verified at v1.4.x).
    cssInjectedByJs({
      jsAssetsFilterFunction: ({ fileName }) =>
        fileName.includes('__federation_expose_Dashboard') ||
        fileName.includes('__federation_expose_Settings'),
    }),
    federation({
      name: 'app_name',
      filename: 'remoteEntry.js',
      exposes: {
        './Dashboard': './src/components/Dashboard',
        './Settings':  './src/components/settings/SettingsPanel',  // if applicable
      },
      shared: { /* see shared singleton table below */ },
    }),
  ],
  build: {
    target: 'esnext',
    minify: false,  // required — federation mangles placeholder identifiers under minification
  },
})
```

**Why scoped:** Without `jsAssetsFilterFunction`, the plugin selects an arbitrary chunk
to inject styles — typically a shared singleton like `react-dom` that the shell already
provides and never re-evaluates. The remote's CSS executes in standalone mode but never
in embedded mode.

**Plugin order:** `cssInjectedByJs` must precede `federation` in the `plugins` array.
It intercepts Vite's CSS extraction phase; federation runs after and wraps the result.

**`minify: false` requirement:** `@originjs/vite-plugin-federation` v1.4.x mangles
internal placeholder identifiers (`__federation_expose_*`, `__federation_shared_*`)
under esbuild/terser. Keep `minify: false` until the plugin resolves this upstream.

### Step 3 — Registration in `frame-dev.sh` and `shell/vite.config.ts`

The remote must be registered in both the shell Vite config (for Module Federation
remote discovery) and in `frame-dev.sh` (for local dev orchestration).

**`shell/packages/shell-app/vite.config.ts` — add to `remoteBase`:**

```ts
const remoteBase = {
  cv_builder:  process.env.VITE_REMOTE_CV_BUILDER  ?? 'http://localhost:3000',
  blogengine:  process.env.VITE_REMOTE_BLOGENGINE  ?? 'http://localhost:3005',
  tripplanner: process.env.VITE_REMOTE_TRIPPLANNER ?? 'http://localhost:3010',
  core_reader: process.env.VITE_REMOTE_CORE_READER ?? 'http://localhost:3015',
  // new_app:  process.env.VITE_REMOTE_NEW_APP      ?? 'http://localhost:XXXX',
}
```

**`core/scripts/frame-dev.sh` — add a `start_subapp` call:**

```bash
start_subapp "new-app" "new-app" "@new-app/browser-app" XXXX
```

**`shell/packages/shell-app/src/components/AppFrame.tsx` — add to `REMOTE_LOADERS`:**

```ts
const REMOTE_LOADERS: Record<AppType, ...> = {
  'cv-builder':  () => import('cv_builder/Dashboard'  as string) as never,
  'blogengine':  () => import('blogengine/Dashboard'  as string) as never,
  'tripplanner': () => import('tripplanner/Dashboard' as string) as never,
  'core-reader': () => import('core_reader/Dashboard' as string) as never,
  // 'new-app':  () => import('new_app/Dashboard'     as string) as never,
}
```

### Shared singleton table

All remotes must declare the following shared singletons with `singleton: true`. Version
strings must be read from the remote's `package.json` (use the `dep()` helper from
cv-builder's vite config to prevent silent drift):

| Package | Source pkg.json |
|---------|-----------------|
| `react` | browser-app |
| `react-dom` | browser-app |
| `@reduxjs/toolkit` | workspace root |
| `react-redux` | workspace root |
| `@carbon/react` | browser-app |

Omitting `@carbon/react` from the shared list causes the remote to load a duplicate
Carbon instance, breaking CSS class resolution in the shell.

## Consequences

### Gains
- New remotes have a three-item checklist that is independently verifiable before a shell
  integration PR is opened
- The CSS injection scoping rule prevents the silent "styled in standalone, unstyled in
  shell" failure class
- Shell's `AppFrame.tsx` and `frame-dev.sh` are the single registration points — no other
  files need to change for a new remote

### Costs
- `minify: false` in all remote builds increases bundle sizes until upstream resolves
  federation + minifier incompatibility
- `shellMode` prop creates a prop-threading obligation in sub-apps; deeply nested
  components that need to suppress chrome must receive `shellMode` via prop or context
- Registration requires changes in two repos (sub-app and shell) — the integration is
  not self-contained

### Neutral
- The `__federation_expose_` chunk naming prefix is an `@originjs/vite-plugin-federation`
  internal convention. If CSS stops applying after a plugin upgrade, verify chunk names
  in the remote's `dist/assets/` and update the filter strings accordingly.

## Alternatives considered

| Alternative | Why rejected |
|-------------|--------------|
| CSS-in-JS (emotion/styled-components) for remote styles | Incompatible with Carbon Design System; Carbon is SCSS-based; replacing it is out of scope |
| Sub-apps serve CSS as a separate `/assets/styles.css` endpoint | CORS-correct but requires the shell to know each remote's CSS URL and load it dynamically — fragile and non-standard |
| Single MF entry point per remote, no `shellMode` | Chrome duplication when embedded; confirmed broken in the 2026-02-28 `feat/skill-directories` session |
| Turborepo shared Vite config for all remotes | Premature standardisation; each app has legitimate config differences (port, exposed modules, API proxies) |

## Evidence — pattern confirmed across four remotes

| Remote | `shellMode` prop | `cssInjectedByJs` scoped | `frame-dev.sh` registered | `shell/vite.config.ts` registered |
|--------|:---:|:---:|:---:|:---:|
| cv-builder (`:3000`) | ✓ | ✓ | ✓ | ✓ |
| blogengine (`:3005`) | ✓ | ✓ | ✓ | ✓ |
| tripplanner (`:3010`) | ✓ | partial | ✓ | ✓ |
| core-reader (`:3015`) | ✓ | pending | ✓ | ✓ |

tripplanner and core-reader CSS injection gaps are tracked as tech debt pending their
Phase 1 embedded-mode work.
