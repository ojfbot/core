# ADR-0009 — Dual-Mode App Architecture

**Status:** Accepted
**Date:** 2026-02-28
**Deciders:** Jim Green

---

## Context

Each Frame OS sub-app (cv-builder, blogengine, tripplanner, …) must serve two distinct runtime configurations:

| Mode | Port offset | Consumer | What loads |
|------|-------------|----------|------------|
| **Standalone** | :3000, :3005, :3010 | Developer, QA, standalone demo | Full mock shell (header + app-switcher sidebar) + app content |
| **Embedded** | :3001, :3006, :3011 | Shell MF host at :4000 | Headless app content only: threads sidebar, main panel, condensed chat |

Currently sub-apps run only in standalone mode, exposing one Vite entry point that bundles their own shell chrome (header, app-switcher sidebar). When the shell loads the MF remote, this chrome renders inside the real shell — producing doubled navigation, CSS conflicts, and layout breakage.

The session `feat/skill-directories` (2026-02-28) proved Module Federation connectivity for cv-builder, blogengine, and tripplanner, but surfaced serious styling clashes that require mode-aware CSS and entry point separation before a production-quality embedded experience is possible.

---

## Decision

Each sub-app will expose **two Vite entry points** built from the same source, controlled by a `VITE_EMBED_MODE` boolean env var:

```
packages/browser-app/
  src/
    main.tsx          ← standalone: mounts <StandaloneShell><Dashboard/></StandaloneShell>
    embedded.tsx      ← embedded:   mounts <EmbeddedApp> (no shell chrome)
    components/
      Dashboard.tsx   ← pure content, no shell assumptions
      StandaloneShell.tsx  ← mock header + app-switcher (replica of real shell)
      EmbeddedApp.tsx      ← threads sidebar + main panel + condensed chat only
```

The Module Federation `exposes` entry points to `./Dashboard` which renders `<EmbeddedApp>` (headless). The standalone Vite entry uses `<StandaloneShell>` for local dev/QA.

### CSS isolation strategy

- **Standalone CSS** (`standalone.css`): includes full Carbon shell styles (ui-shell, header, side-nav).
- **Embedded CSS** (`embedded.css`): scoped to content-area tokens only; no shell-scope rules (no `.cds--header`, `.cds--side-nav`, etc.). Injected via the MF `__federation_expose_Dashboard-*.css` chunk.
- CSS custom properties (`--cds-*`) continue to cascade from the shell's `<Theme>` wrapper — sub-apps do not re-declare theme tokens in embedded mode.

### Redux Provider isolation

Each sub-app's `Dashboard` export wraps its own `<Provider store={appStore}>` inside the component (established in this session). The shell's store remains at the outer Provider. This pattern is confirmed working for cv-builder, blogengine, and tripplanner as of 2026-02-28.

### `frame-dev.sh` port convention

| App | Standalone preview | Embedded preview |
|-----|--------------------|-----------------|
| cv-builder | :3000 | :3001 |
| blogengine | :3005 | :3006 |
| tripplanner | :3010 | :3011 |

Shell (MF host) remotes point to the `:X001` ports in local dev. The `:X000` ports serve the full standalone mode for independent QA.

---

## Consequences

### Positive
- Clean separation of concerns: shell chrome vs. app content
- Sub-apps remain fully testable in isolation via standalone mode
- Embedded CSS chunk is scoped — no shell-style pollution
- Enables true parallel development: sub-app teams work against `:X000`; shell integration always uses `:X001`

### Negative / Risks
- Two entry points per app means ~2× build artifacts; CI build time increases
- `StandaloneShell` must stay in sync with the real shell's API surface (Carbon version, theme tokens) — becomes tech debt if they diverge
- `VITE_EMBED_MODE` flag means embedded mode must be tested explicitly — standalone CI won't catch embedded CSS regressions

### Migration path for existing apps
1. Refactor `Dashboard.tsx` to pure content (already done for MF compatibility, 2026-02-28)
2. Extract `StandaloneShell.tsx` from `App.tsx` in each sub-app
3. Add `embedded.tsx` entry + Vite config second build
4. Update `frame-dev.sh` to start both standalone and embedded preview servers
5. Update shell's `vite.config.ts` remotes to target `:X001`

---

## Alternatives Considered

**A — Single entry, CSS class toggle:** Add a `.frame-embedded` class to `<body>` and use CSS `display: none` to hide shell chrome in embedded mode.
Rejected: Bloated bundle; screen readers still see hidden elements; fragile.

**B — iframes:** Sub-apps served in `<iframe>` sandboxes.
Rejected: Violates ADR-0001 (no iframes); blocks shared auth, Redux, event bus.

**C — Separate repos for embedded vs. standalone:**
Rejected: Maintenance burden, version skew.
