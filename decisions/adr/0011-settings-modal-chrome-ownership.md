# ADR-0011: Settings Modal Chrome Ownership and ErrorBoundary Reset Contract

Date: 2026-03-02
Status: Accepted
OKR: 2026-Q1 / O1 / KR1
Commands affected: /validate, /scaffold, /plan-feature
Repos affected: shell, cv-builder, blogengine, tripplanner

---

## Context

Before shell PR [ojfbot/shell#6](https://github.com/ojfbot/shell/pull/6), sub-apps bundled their own settings modal chrome inside their standalone packages. When embedded in the shell as Module Federation remotes, this caused three problems:

1. **Duplicate modal chrome**: Carbon `<Modal>` rendered twice — once inside the remote, once potentially from the shell layer — producing z-index conflicts and focus-trap collisions.
2. **Inconsistent close mechanics**: Each sub-app implemented its own `onClose` handler, dismiss-on-backdrop logic, and keyboard escape handling with no shared contract.
3. **Error boundary gaps**: Sub-app error boundaries did not reset on modal close, leaving stale load errors visible on the next open of the same modal.

The shell already owns the `<Header>`, `<SideNav>`, and the settings icon trigger in `HeaderGlobalBar`. Owning the modal chrome is a natural extension of that responsibility.

## Decision

The **shell owns all modal chrome** for sub-app settings. Sub-apps expose only bare panel content.

### Ownership split

| Layer | Owns |
|-------|------|
| Shell (`SettingsModal.tsx`) | `<Modal>` wrapper, heading, close button, `Suspense` fallback, `SettingsEB` error boundary, z-index |
| Sub-app (`./Settings` MF export) | Form fields, status cards, Save/Cancel logic, `onClose` callback invocation |

### Sub-app MF contract

Each sub-app that supports settings must expose a `SettingsPanel` component via the `'./Settings'` Module Federation entry:

```tsx
// Sub-app: packages/browser-app/src/components/settings/SettingsPanel.tsx
interface SettingsPanelProps {
  onClose: () => void   // call on Save or Cancel to dismiss the modal
}
export function SettingsPanel({ onClose }: SettingsPanelProps) { … }

// Sub-app: vite.config.ts (federation.exposes)
exposes: {
  './Dashboard': './src/components/Dashboard',
  './Settings':  './src/components/settings/SettingsPanel',  // ← required
}
```

The panel must **not** render a `<Modal>` wrapper, a heading, or its own close button. It receives `onClose` and is responsible only for calling it.

Sub-apps that have no settings simply omit the `'./Settings'` MF export. `SettingsModal` handles the missing loader with a fallback message ("No settings available for this app.").

### `showSettings` gate

The shell settings icon and `SettingsModal` are rendered only when:

```tsx
const showSettings = !!activeInstanceId && !!activeAppType && activeAppType !== 'purefoy'
```

Sub-apps do not control whether their settings icon appears. `purefoy` is permanently excluded because it is a read-only reference browser with no configurable state.

### ErrorBoundary reset via `resetKey`

`SettingsModal` receives a `resetKey: number` prop. The shell increments `resetKey` on every modal close:

```tsx
onClose={() => { setSettingsOpen(false); setSettingsKey(k => k + 1) }}
```

`resetKey` is passed as the `key` prop to `SettingsEB`, remounting the error boundary and the inner `Suspense`/`Panel` on each close. This has two effects:

1. **Clears MF load errors**: A `SettingsEB` that caught a remote load failure is discarded; the next open triggers a fresh lazy load attempt.
2. **Resets form state**: The `SettingsPanel` component is fully unmounted and remounted, so dirty form fields do not persist across open/close cycles (intentional UX — "Cancel" means discard).

### z-index contract

`SettingsModal` adds `className="shell-settings-modal"` to the Carbon `<Modal>`. The shell's `index.css` overrides z-index to `10002` — above sub-app `ThreadSidebar` overlays that reach `9998`.

Sub-apps must not set z-index on their `SettingsPanel` content; z-index is the shell's responsibility.

## Consequences

### Gains
- One modal chrome implementation for all sub-apps — consistent heading, focus trap, keyboard dismiss, and z-index across every settings panel
- Error boundary is guaranteed to reset on close; sub-apps cannot accidentally leave `SettingsEB` in an error state across sessions
- Sub-apps are testable in isolation: `SettingsPanel` is a plain React component that takes `onClose`; no modal setup required in unit tests

### Costs
- Sub-apps lose the ability to customize their modal heading format; the shell always renders `"${appLabel} Settings"`
- Adding a settings panel requires an MF `'./Settings'` expose entry and a rebuild of the remote; live-reload is not possible for settings panels in dev

### Neutral
- `resetKey` remounts the panel on every open, not just on error. This means no lazy-loaded state is preserved across open/close cycles — which is the intended behavior for settings (always fresh), but teams should not rely on in-component state persisting.

## Alternatives considered

| Alternative | Why rejected |
|-------------|--------------|
| Sub-apps own their own `<Modal>` wrapper | Already in use pre-PR #6; caused z-index conflicts and duplicate Carbon Modal instances in embedded mode |
| Shell uses a single generic modal with slot injection | Equivalent complexity; Carbon `<Modal>` passiveModal already provides the correct slot model |
| Sub-apps manage `resetKey` themselves | Shell cannot guarantee reset behavior if sub-apps hold the key; centralizing in the shell enforces the invariant |

## Implementation checklist

- [x] Shell: `SettingsModal.tsx` — owns `<Modal>`, `SettingsEB`, `Suspense`, z-index override
- [x] Shell: `App.tsx` — `showSettings` gate + `resetKey` increment on close
- [x] cv-builder: `SettingsPanel` exposed via `'./Settings'` MF entry
- [ ] blogengine: `SettingsPanel` — not yet implemented (Phase 1)
- [ ] tripplanner: `SettingsPanel` — not yet implemented (Phase 1)
- [ ] purefoy: excluded by `showSettings` gate — no action needed
