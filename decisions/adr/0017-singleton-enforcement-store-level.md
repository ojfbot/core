# ADR-0017: Store-level singleton enforcement for single-context app types

Date: 2026-03-09
Status: Proposed
OKR: 2026-Q1 / O1 / KR3 (cross-domain hero demo)
Commands affected: /scaffold, /gastown
Repos affected: shell

---

## Context

Some Frame app types are fundamentally single-context: they have one knowledge base, one metadata dashboard, or one persistent agent session. Running two instances simultaneously would produce no shared state between them, create two separate agent sessions with no awareness of each other, and leave the shell with no mechanism to resolve "which one is active?"

Prior to commit `e910836`, purefoy and core-reader were not in `DEFAULT_APP_TYPES` at all — they were unreachable from the UI. The fix that made them reachable also needed to enforce that exactly one instance exists.

The decision point: where does the constraint live?

- **UI option:** disable/hide the "+ New" button for singleton app types
- **Store option:** guard the `spawnInstance` reducer — if a singleton already has an instance, the dispatch is a no-op (or returns an error action)

---

## Decision

Enforce singleton constraints at the Redux store level (`spawnInstance` reducer), not at the UI level. A `singleton?: boolean` field on `AppConfig` marks which types are singletons. The store guards all launch paths. The UI separately hides the "+ New" button for singleton types as a secondary affordance, but the canonical constraint is the store.

**Reference implementation:** commit `e910836` in shell, merged [shell] #19 on 2026-03-09.

---

## Current singleton list

| App type | Reason |
|----------|--------|
| `purefoy` | Single knowledge base (Roger Deakins); two instances would run separate agent sessions against the same corpus with no shared context |
| `core-reader` | Single metadata dashboard; two instances display the same data with no differentiation |

**Trigger condition for adding new types:** an app type should be marked singleton if and only if: (a) two instances would share no meaningful state and (b) there is no user-facing reason to want two independent sessions. Both conditions must hold.

---

## Agent contract

When ShellAgent or any programmatic caller dispatches a launch request for a singleton type that already has an instance:
- The store dispatches an error action (not a silent no-op)
- The sidebar surfaces the error as a toast notification
- The existing instance is brought into focus
- The agent receives the error action directly — "open purefoy" when one is running returns an error, not a second instance

This means agents can detect the singleton constraint without inspecting `AppConfig` — the error action is the signal.

---

## Migration

Users whose persisted Redux state predates `e910836` may not have singleton instances bootstrapped. The commit includes a migration: on store load, if `DEFAULT_INSTANCES` includes a singleton type that is absent from the persisted registry, that instance is injected. This runs once on first load after the update.

---

## Consequences

### Gains
- All launch paths (UI button, agent command, programmatic dispatch, Module Federation remote) are subject to the same constraint — no bypass routes.
- ShellAgent's world model is accurate: if a singleton is running, the store says so, and the agent can act on that fact.
- Adding a new singleton type requires one field change in `AppConfig` — no UI changes beyond the "+ New" button hide.

### Costs
- The store now encodes product intent (which apps are singletons) as a schema-level constraint. If intent changes (e.g. purefoy gains multi-corpus support), the store schema must be updated, not just the UI.
- The migration adds load-time logic that runs indefinitely. It is safe to remove after one release cycle when all clients have migrated.

### Neutral
- The `+ New` button hide in `AppSwitcher` is a secondary, redundant constraint. It improves discoverability but is not the enforcement mechanism.

---

## Alternatives considered

| Alternative | Why rejected |
|-------------|--------------|
| UI-only enforcement (hide "+ New" button) | Module Federation remotes and agents can launch apps programmatically — they bypass any button. A hidden button is not a constraint. |
| Silent no-op in the reducer (no error action) | Agents would not know the launch was rejected. A silent no-op produces incorrect agent world models: the agent believes the app is now open. |
| Per-launch-path guards (check in each caller) | Requires every new launch path to reimplement the check. The store is the only surface all paths flow through. |
