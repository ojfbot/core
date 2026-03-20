# ADR-0029: Prop-only boundary for @ojfbot/shell UI components

Date: 2026-03-20
Status: Accepted
OKR: 2026-Q1 / O1 / KR2 (premium visual treatment)
Commands affected: /plan-feature, /scaffold, /validate
Repos affected: shell

---

## Context

The shell application's UI components were tightly coupled to Redux store state. Components like `SettingsModal`, `ApprovalQueue`, `ResumptionToast`, `AppSwitcher`, and `HomeScreen` directly imported `useAppSelector` and `useAppDispatch`, making them impossible to render in Storybook, test in isolation, or reuse outside the shell-app package.

This violated the monorepo's two-package structure: `packages/ui/` (pure components) and `packages/shell-app/` (app wiring). In practice, "pure" UI components were reaching into the store, defeating the separation.

## Decision

All components in `packages/ui/` accept **props only** — no Redux hooks, no store imports, no context consumers beyond React built-ins and Carbon Design System. Store wiring lives exclusively in `packages/shell-app/src/components/*Connected.tsx` wrapper components.

The pattern:

```
packages/ui/src/components/SettingsModal.tsx        ← pure, prop-driven
packages/shell-app/src/components/SettingsModalConnected.tsx  ← reads Redux, passes props
```

Each `*Connected.tsx` file:
1. Reads the required Redux slices via `useAppSelector`
2. Maps dispatch calls to callback props
3. Passes static config (labels, metadata, loaders) as props
4. Renders the pure component from `@ojfbot/shell`

## Consequences

**Positive:**
- Every UI component is Storybook-renderable with mock data — no store provider needed in stories
- Components are testable with `@testing-library/react` using plain props
- Clear ownership: UI team owns the presentation contract; app team owns the wiring
- Visual regression testing works without Redux infrastructure
- Components from `packages/ui/` are reusable by other Frame OS apps if needed

**Negative:**
- Slightly more files: each stateful component needs a `*Connected.tsx` counterpart
- Props interfaces grow larger for components with many store dependencies (e.g., `SettingsModalProps` has 7 props)
- Contributors must learn the convention and resist adding store imports to `packages/ui/`

**Enforced by:**
- Storybook stories import from `packages/ui/` directly — build failure if a component needs Redux
- PR review convention: no `useAppSelector` or `useAppDispatch` in `packages/ui/src/`

## Components decomposed (as of 2026-03-20)

| Component | Pure (ui/) | Connected (shell-app/) |
|-----------|-----------|----------------------|
| SettingsModal | SettingsModal.tsx | SettingsModalConnected.tsx |
| ApprovalQueue | ApprovalQueue.tsx | ApprovalQueueConnected.tsx |
| ResumptionToast | ResumptionToast.tsx | ResumptionToastConnected.tsx |
| AppSwitcher | AppSwitcher.tsx | AppSwitcherConnected.tsx |
| Header | Header.tsx | HeaderConnected.tsx |
| HomeScreen | HomeScreen.tsx | HomeScreenConnected.tsx |
| AppFrameDisplay | AppFrameDisplay/ | AppFrame.tsx |
