# Shell MF Integration — Implementation Reference

Canonical patterns for embedding a Frame OS sub-app in the shell as a Module Federation
remote. Derived from: shell PR #9 (merged 2026-03-02), cv-builder PR #103, BlogEngine
PR #22, TripPlanner PR #13. All three client apps converged on identical patterns after
a multi-session debugging loop.

**Read this before scaffolding any new Frame OS sub-app `browser-app`, including CoreReader.**

---

## Required packages

```json
// packages/browser-app/package.json devDependencies
"@originjs/vite-plugin-federation": "^1.4.1",
"vite-plugin-css-injected-by-js": "^4.0.1"
```

`vite-plugin-css-injected-by-js` is non-optional. Without it, Vite emits a separate
`.css` file in dist. The shell host's `loadRemote()` only fetches `remoteEntry.js` —
it has no mechanism to load the CSS file. Result: the remote renders with no styles.

---

## vite.config.ts

```typescript
import federation from '@originjs/vite-plugin-federation'
import cssInjectedByJs from 'vite-plugin-css-injected-by-js'

export default defineConfig({
  plugins: [
    react(),
    // cssInjectedByJs MUST come before federation. It intercepts CSS extraction
    // and converts it to JS style-injection. The jsAssetsFilterFunction scopes
    // injection to our exposed chunks only — without it the plugin targets a shared
    // chunk (e.g. react-dom) that the shell never loads as a singleton, so CSS
    // would never execute.
    //
    // __federation_expose_ is @originjs/vite-plugin-federation's internal chunk
    // naming convention (verified at v1.4.x). If CSS stops loading after a plugin
    // upgrade, check dist/ chunk names and update these strings.
    cssInjectedByJs({
      jsAssetsFilterFunction: ({ fileName }) =>
        fileName.includes('__federation_expose_Dashboard') ||
        fileName.includes('__federation_expose_Settings'),
    }),
    federation({
      name: 'myapp',          // snake_case, matches shell vite.config.ts remote key
      filename: 'remoteEntry.js',
      exposes: {
        './Dashboard': './src/components/Dashboard',
        './Settings': './src/components/SettingsPanel',
      },
      shared: {
        // Object form required — string array does not support singleton config.
        // @carbon/react MUST be a singleton or Carbon CSS class resolution breaks
        // in the remote (duplicate class names from two Carbon instances).
        react: { singleton: true, requiredVersion: false },
        'react-dom': { singleton: true, requiredVersion: false },
        '@carbon/react': { singleton: true, requiredVersion: false },
      },
    }),
  ],
  build: {
    target: 'esnext',
    minify: false,            // required for MF module graph correctness
    cssCodeSplit: false,
  },
})
```

---

## Dashboard component

### Props

```typescript
interface DashboardProps {
  /** True when mounted inside the Frame shell host.
   *  Suppresses the internal app title heading and activates the flex height chain
   *  so tab content fills the shell frame instead of using standalone viewport-
   *  relative heights. Does NOT remove sidebar or chat controls. */
  shellMode?: boolean
}
```

### Structure

```tsx
// Inner content component — reads from Redux store
function DashboardContent({ shellMode }: DashboardProps) {
  const chatExpanded = useAppSelector(state => state.chat.displayState === 'expanded')
  const sidebarExpanded = useAppSelector(state => state.v2.sidebarExpanded)

  return (
    <div
      className={[
        'dashboard-wrapper',
        sidebarExpanded ? 'with-sidebar' : '',
        shellMode ? 'shell-mode' : '',
        shellMode && chatExpanded ? 'chat-expanded' : '',
      ].filter(Boolean).join(' ')}
      data-element="app-container"
    >
      <div className="dashboard-header">
        {/* Suppress app title in shell — shell header already shows app name */}
        {!shellMode && <Heading className="page-header">App Name Dashboard</Heading>}
        {/* Keep controls — sidebar toggle, settings toggle, etc. */}
      </div>
      {/* ... tabs, thread sidebar, condensed chat ... */}
    </div>
  )
}

// MF export — self-contained with its own Redux Provider.
// The shell mounts Dashboard under the shell's own Provider (no sub-app slices).
// Without the inner Provider every useAppSelector call reads undefined.
// Standalone App.tsx also wraps with the same store singleton — harmless double-wrap
// (inner Provider wins, same singleton). See docs/FEDERATION.md.
function Dashboard({ shellMode }: DashboardProps) {
  return (
    <Provider store={store}>
      <DashboardContent shellMode={shellMode} />
    </Provider>
  )
}

export default Dashboard
```

---

## Dashboard CSS

### dashboard-wrapper — full rule set

```css
/* Base: flex column that fills the parent */
.dashboard-wrapper {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  margin: 0 72px;           /* standalone horizontal rhythm */
  transition: margin-right 0.3s ease;
}

/* Sidebar open: push content away from right-side thread sidebar.
 * Formula: sidebar width (320px) + sidebar right inset (1rem) + gap (1rem) = 320px + 2rem.
 * CondensedChat must use calc(320px + 3rem) to overhang 1rem past this edge. */
.dashboard-wrapper.with-sidebar {
  margin-right: calc(320px + 2rem);
}

/* Shell-mode: replace viewport-relative heights with a flex chain.
 *
 * Carbon v11 DOM (from inspection — do not assume without verifying):
 *   <Tabs>        → NO DOM element (context provider only)
 *   <TabList>     → <div class="cds--tabs cds--tabs--contained">   (the tab BAR)
 *   <TabPanels>   → <div class="cds--tab-panels">                  (tab content)
 *
 * Direct children of dashboard-wrapper (flex-col):
 *   .dashboard-header   — auto height
 *   .cds--tabs          — tab BAR only (must stay at natural height, not grow)
 *   .cds--tab-panels    — fills remaining space
 */
.dashboard-wrapper.shell-mode {
  /* Visual rhythm: top gap matches horizontal margin (72px = 4.5rem). */
  margin-top: 4.5rem;
}

/* When CondensedChat is expanded, give the dashboard bottom breathing room.
 * CondensedChat is position:fixed bottom:1rem — this margin prevents it overlapping content. */
.dashboard-wrapper.shell-mode.chat-expanded {
  margin-bottom: 4.5rem;
}

/* Tab bar: must NOT grow — if it grows it steals space from panels.
 * flex-direction:column is Carbon's own rule for .cds--tabs--contained;
 * in MF context Carbon's shared chunk is replaced by the host singleton so
 * this rule may be absent from the remote bundle. Declare it here. */
.dashboard-wrapper.shell-mode .cds--tabs {
  flex-shrink: 0;
  flex-direction: column;
}

/* Contained tab bar background + equal-width tabs.
 * Same origin as flex-direction — must be self-declared in MF remotes.
 * Scoped to .dashboard-wrapper (not .shell-mode) so standalone mode also gets
 * equal-width tabs if Carbon's chunk is absent. Adjust if this causes issues. */
.dashboard-wrapper .cds--tabs--contained .cds--tab--list {
  display: flex;
  background-color: var(--cds-layer-accent-01, #393939);
}
.dashboard-wrapper .cds--tabs--contained .cds--tabs__nav-item {
  flex: 1 0 auto;
}

/* Panels fill remaining space after header + tab bar */
.dashboard-wrapper.shell-mode .cds--tab-panels {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.dashboard-wrapper.shell-mode .cds--tab-content {
  max-height: none;
  height: 100%;
  overflow-y: auto;
}

/* Standalone: viewport-relative height constraint */
.dashboard-wrapper:not(.shell-mode) .cds--tab-content {
  overflow-y: auto;
  padding: 24px;
  max-height: calc(100vh - 48px - 72px - 48px); /* viewport - header - margins - tab bar */
}
```

---

## ThreadSidebar

### Positioning constants

```
right: 1rem              — inset from viewport right edge (not flush)
top: calc(48px + 0.5rem) — minimal clearance from shell header (48px)
height: calc(100vh - 48px - 1rem)
width: 320px
```

### Collapsed/expanded transform

```css
/* Collapsed — translate beyond viewport + inset, so no edge peeking */
transform: translateX(calc(100% + 1rem));
visibility: hidden;
/* visibility:hidden removes from a11y tree; delay 0.3s so slide-out finishes first */
transition: transform 0.3s ease, visibility 0s 0.3s;

/* Expanded */
transform: translateX(0);
visibility: visible;
/* visibility:visible immediately so slide-in is visible */
transition: transform 0.3s ease, visibility 0s;
```

### Carbon SideNav containing-block fix

When `ThreadSidebar` uses Carbon `<SideNav>`, the sidebar div has a CSS `transform`
(slide animation). Per CSS spec §9.3, `transform` creates a new containing block for
fixed-position descendants. Carbon's `<SideNav>` renders:
```
<nav class="cds--side-nav__navigation" style="position:fixed; top:48px">
```
With the parent's `transform` containing block, `top:48px` is measured from the
**sidebar top**, not the viewport — producing a blank gap above the sidebar content.

Fix:
```css
.thread-sidebar .cds--side-nav__navigation {
  top: 0 !important;       /* reset: containing block is sidebar, not viewport */
  height: 100% !important;
  width: 100% !important;
}
.thread-sidebar .cds--side-nav__items {
  padding-top: 0 !important;
}
```

### `inert` pattern

`inert=""` removes the element and all descendants from the tab order, pointer events,
and the accessibility tree simultaneously. `visibility:hidden` alone does not reliably
remove Carbon components from keyboard focus (Carbon sets explicit `tabindex` values).

**For non-Carbon thread sidebars (TripPlanner, BlogEngine CSS-only pattern):**
```tsx
<div
  className={`thread-sidebar ${isExpanded ? 'expanded' : 'collapsed'}`}
  {...(!isExpanded ? { inert: '' } : {})}
>
```

**For Carbon `<SideNav>` (cv-builder pattern):**
```tsx
{/* Zero-footprint wrapper: SideNav is position:fixed, wrapper has no layout impact */}
<div {...(!isExpanded ? { inert: '' } : {})}>
  <SideNav expanded={isExpanded} aria-label="Thread navigation" ...>
```
Do NOT put `inert` directly on the Carbon `<SideNav>` component — its TypeScript props
do not declare `inert`, causing a type error.

---

## CondensedChat positioning

CondensedChat is `position: fixed; bottom: 1rem`.

```
Right edge when sidebar closed:  right: calc(72px - 1rem)
  → overhangs 1rem past the dashboard's 72px right margin
  → creates visual separation consistent with the sidebar gap formula

Right edge when sidebar open:    right: calc(320px + 3rem)
  → dashboard margin-right is calc(320px + 2rem)
  → CondensedChat overhangs 1rem past that edge

Previous value (with-sidebar: 320px + 1rem) was 16px too far left — this is
the alignment bug fixed in all three client-app PRs.
```

For apps that pass sidebar state as a prop (BlogEngine pattern — inline styles):
```tsx
style={{ right: sidebarExpanded ? 'calc(320px + 3rem)' : 'calc(72px - 1rem)' }}
```

---

## Shell z-index hierarchy

| Layer | z-index | Note |
|-------|---------|------|
| `.main-content` | (stacking context) | `isolation: isolate` — all sub-app z-indices are scoped within |
| Client-app thread sidebars | 9998 | Relative to `.main-content` stacking context |
| Shell sidenav | 10000 | Root stacking context |
| Shell header (`cds--header`) | 10001 | Root stacking context |
| Shell chat overlay | 10002 | Root stacking context |
| Shell settings modal | 10003 | Root stacking context |

**Critical:** `.main-content` has `isolation: isolate` which creates an explicit
stacking context boundary. Do not add `position + z-index` or `transform` to
`.main-content` itself — that would turn it into a positioned stacking context with a
numeric z-index and may lose compositing priority vs. the shell chrome.

---

## Architectural invariants — do not regress

These were hard-won from a multi-session debugging loop. Violating any of them
re-introduces regressions that were already fixed.

### 1 — `isolation: isolate` on `.main-content` is load-bearing

`frame-fade-in` CSS animation creates a GPU compositor layer for every loaded sub-app.
Browsers can mis-order compositor layers relative to sibling `position:fixed` shell
chrome. Symptom: sidenav is applied the correct CSS class but painted _behind_ app
content; a DOM repaint (e.g. switching Carbon tabs) temporarily fixes the order.

`isolation: isolate` creates an explicit stacking context boundary. Shell chrome
(z:10000+) always composites above it. Never remove this rule.

### 2 — Shell sidenav: hamburger-only toggle, no document-level click listener

A `document.addEventListener('click', ...)` bubble-phase handler to close the sidenav
on outside clicks was tried and reverted. It intercepted clicks on client-app thread
sidebar toggle buttons (which live in `.main-content`, outside `.shell-sidenav`),
closing the sidenav on every client-app sidebar interaction. After the compositor bug
(#1) prevented reopening, the sidenav appeared permanently dead.

If "click outside to close" is ever needed: use a `position:fixed` overlay div
constrained to the `main-content` area (below header, right of sidenav), not a
document listener.

### 3 — Tooltip direction: use Carbon `align` prop, not CSS on `.cds--popover`

Overriding `.cds--popover` position with raw CSS creates invisible interactive regions
that intercept pointer events on other elements (including the shell hamburger button).
Use `align="bottom"` (or `"bottom-right"` etc.) on `IconButton`/`Button`/`Tooltip`.

### 4 — Off-screen sidebars: `inert` is required, not optional

`visibility: hidden` is a visual complement (delayed so slide-out animation finishes),
but it does not reliably remove all Carbon components from keyboard focus. `inert`
removes everything simultaneously. See §ThreadSidebar above.

### 5 — `@carbon/react` must be shared as a singleton

Without `@carbon/react` in the shared map, the remote loads a duplicate Carbon instance.
CSS class names from two instances don't match — tab bar rendering breaks, and the
contained tab bar loses its background color. Must use object form (not string array)
to set `singleton: true`.

---

## Common failure signatures

| Symptom | Root cause | Fix |
|---------|-----------|-----|
| Remote renders with no styles | CSS file not bundled into remote JS | Add `vite-plugin-css-injected-by-js` with `jsAssetsFilterFunction` |
| Tab bar has no background, tabs don't fill width | `@carbon/react` not shared as singleton | Add to `shared` map with `singleton: true` |
| Shell sidenav painted behind app content | Missing `isolation: isolate` on `.main-content` | Restore rule; never add `position + z-index` to `.main-content` |
| Blank gap above "Conversations" in thread sidebar | Carbon `cds--side-nav__navigation` `top: 48px` relative to transform containing block | Add `top: 0 !important` to `.thread-sidebar .cds--side-nav__navigation` |
| Thread sidebar keyboard-accessible when closed | Missing `inert=""` on sidebar wrapper | Add `{...(!isExpanded ? { inert: '' } : {})}` to wrapper `<div>` |
| CondensedChat misaligned with dashboard edge | `with-sidebar` margin formula was `+1rem` not `+2rem` | Use `right: calc(320px + 3rem)` for sidebar-open state |
| Shell sidenav closes when clicking thread sidebar | Document-level click listener capturing `.main-content` clicks | Remove global listener; toggle sidenav only from hamburger |
| White flash on first paint before JS | `background-color` not set on `html, body` | Add `html, body { background-color: var(--cds-background, #0a0a0a) }` |
