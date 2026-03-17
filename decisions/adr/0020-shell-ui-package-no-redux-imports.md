# ADR-0020: No Redux store imports inside @ojfbot/shell packages/ui components

Date: 2026-03-17
Status: Accepted
OKR: 2026-Q1 / O1 / KR1 (Shell renders)
Commands affected: /validate, /hardening, /setup-ci-cd
Repos affected: shell

---

## Context

Shell (`shell/packages/ui/`) is a shared component package consumed by Module Federation
remotes (cv-builder, BlogEngine, TripPlanner). Module Federation remotes run in separate
JavaScript scopes with their own Redux stores. A `packages/ui` component that imports
from the shell's Redux store (`../store`, `react-redux`, `@reduxjs/toolkit`) creates a
direct runtime dependency on the shell's store singleton.

When that component is imported by a remote, the import resolves against the remote's
scope where the shell store does not exist. This causes either a runtime error (store
undefined) or silent state isolation breakage (two Redux stores active, both receiving
dispatches).

The only safe contract at a Module Federation boundary is: props flow in, callbacks
flow out. No shared mutable state references cross the boundary.

## Decision

No component inside `shell/packages/ui/src/components/` may import from:
- `../store` or any path resolving to the shell Redux store
- `react-redux` (`useSelector`, `useDispatch`, `Provider`, `connect`)
- `@reduxjs/toolkit` (`createSlice`, `createAsyncThunk`, etc.)

Components in `packages/ui` must receive all data as props and communicate changes
via callback props only.

Shell-level state wiring (connecting Redux selectors to props) belongs in
`packages/shell-app/src/` — the application layer — not in `packages/ui`. The pattern
is: `FooConnected.tsx` in `shell-app` wraps `Foo.tsx` from `packages/ui`, threading
Redux state in as props.

**Violation definition:** Any import of `../store`, `react-redux`, or
`@reduxjs/toolkit` inside `shell/packages/ui/src/components/` is a violation.

**CI enforcement:** An ESLint import-boundary rule should fail the build on violation.
Until wired, PR review must check for this pattern explicitly.

## Consequences

### Gains

- Components in `packages/ui` are safely importable from any Module Federation remote
  without store resolution errors.
- UI components are independently testable without a Redux Provider wrapper.
- Clear ownership boundary: state management in the app layer, rendering in the
  component layer.

### Costs

- Components that currently read from the store directly must be refactored to accept
  data as props — the call site in `shell-app` must wire the selector.
- More prop-threading in intermediate components until a non-Redux context pattern is
  introduced for deeply nested trees.

### Neutral

- React context (not backed by Redux) is permitted inside `packages/ui` — it does not
  create a cross-scope singleton dependency.
- This rule applies only to `packages/ui`. Shell-app components (`packages/shell-app/`)
  may continue to use Redux directly.

## Alternatives considered

| Alternative | Why rejected |
|-------------|--------------|
| Allow Redux imports, document as "internal only" | Documentation-only guardrail; a future contributor adding a re-export silently breaks remote imports; not enforceable in CI |
| Expose shell store via MF shared scope | Shared scope requires exact version matching; introduces tight coupling between shell and remote release cycles; breaks remote autonomy |
| Move all UI components into shell-app | Defeats the purpose of a shared UI package; components become un-importable from remotes |
| Use Zustand or Jotai inside packages/ui | Viable long-term, but out of scope for current phase; this ADR establishes the boundary, not the state solution |
