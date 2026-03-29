# ADR-0034: Isolated Redux stores with pub/sub message-passing boundary

Date: 2026-03-29
Status: Proposed
OKR: 2026-Q1 / O1 / KR2 (premium visual treatment), O1 / KR3 (cross-domain hero demo)
Commands affected: /scaffold-frame-app, /validate, /plan-feature
Repos affected: shell, cv-builder, blogengine, TripPlanner, gastown-pilot, lean-canvas, seh-study, core-reader

---

## Context

Shell issue [ojfbot/shell#5](https://github.com/ojfbot/shell/issues/5) has been open since 2026-02-28, tracking the question: how should Redux stores be composed across Frame OS when sub-apps are Module Federation remotes?

The current state: each sub-app wraps its own `<Provider store={localStore}>` when mounted as a remote. The shell has its own store (`packages/shell-app/src/store/index.ts`) with five slices: `appRegistry`, `chat`, `theme`, `settings`, `approvalQueue`. Sub-apps cannot read shell state and the shell cannot read sub-app state. This was an intentional workaround (cv-builder PR #98) that has held up, but it sidesteps the coordination question.

The deferral was justified during Phase 1 (frame-ui-components fleet adoption). Phase 1 is now complete (ADR-0030 accepted). The next work that needs this decision is shell #21 (Gas Town Mayor/Deacon adoption), where the shell must coordinate cross-app work dispatch, activity aggregation, and agent health monitoring. Without a defined state boundary contract, shell #21 cannot proceed safely.

Prior art: ADR-0029 established prop-only boundaries for shell UI components. ADR-0030 extended that pattern fleet-wide via `@ojfbot/frame-ui-components`. This ADR completes the trilogy by defining the state management boundary between the shell host and all remotes.

## Decision

Each Frame OS application (shell and every sub-app remote) owns a fully isolated Redux store. Cross-app coordination uses a typed pub/sub message bus -- not shared state, not store injection, not direct selector access.

### Store isolation rule

- The shell store is the only store at the host level. It contains shell-domain slices only (appRegistry, chat, theme, settings, approvalQueue).
- Each sub-app remote creates its own store inside its own `<Provider>`. The shell never imports, reads, or writes sub-app store state.
- Sub-apps never import `useAppSelector` or `useAppDispatch` from the shell. They have their own typed hooks.
- No dynamic reducer injection. No `reducerRegistry` singleton. No shared store reference.

### Message bus contract

Cross-app coordination uses a `FrameBus` -- a thin typed wrapper around `BroadcastChannel` (with `CustomEvent` fallback for same-window communication):

```typescript
// @ojfbot/frame-bus (new package in shell or frame-ui-components)
interface FrameBusMessage<T = unknown> {
  type: string          // namespaced: 'shell:theme-changed', 'gastown:bead-slung'
  source: string        // app identifier: 'shell', 'cv-builder', 'blogengine'
  payload: T
  timestamp: number
}

// Shell publishes
frameBus.publish({ type: 'shell:theme-changed', source: 'shell', payload: { theme: 'g100' } })

// Sub-app subscribes
frameBus.subscribe('shell:theme-changed', (msg) => {
  dispatch(setTheme(msg.payload.theme))
})
```

Message types are defined in a shared schema (co-located with `@ojfbot/frame-bus`) so both publisher and subscriber have type safety. Adding a new message type requires updating the schema -- this is intentional friction that prevents ad-hoc coupling.

### Gas Town Mayor/Deacon coordination pattern

Shell #21 requires the shell (Mayor) to dispatch work to sub-app agents (Deacons/Witnesses). Under this architecture:

1. User types "review all my blog drafts" in shell chat.
2. Shell Mayor creates a `hq-` prefixed bead and publishes `gastown:bead-slung` on the bus with the bead ID and target app.
3. BlogEngine's bus subscriber receives the message, fetches the bead via API, and dispatches into its local store.
4. BlogEngine publishes `gastown:bead-status-changed` when work completes.
5. Shell subscribes to status changes and updates its `approvalQueue` slice.

At no point does the shell read BlogEngine's Redux state or vice versa. The bead is the shared primitive; the bus is the transport; each app's store is private.

### Shared state that feels shared

For state that must appear synchronized (theme, active instance context), the pattern is:

1. Shell is the source of truth. It dispatches to its own store AND publishes on the bus.
2. Sub-apps subscribe and mirror the value into their own local slice.
3. If a sub-app needs to request a change (e.g., "spawn a new instance"), it publishes a request message. The shell decides whether to honor it.

This is eventually consistent within a single event loop tick (synchronous `BroadcastChannel` in same-origin same-window context).

## Consequences

### Gains

- **No hydration mismatches.** Each store hydrates independently from its own persistence layer. A sub-app's localStorage schema change cannot corrupt the shell store or other sub-apps.
- **No state collisions.** Slice name conflicts are impossible -- stores are completely separate. Adding a `theme` slice to a sub-app does not collide with the shell's `theme` slice.
- **Sub-apps remain standalone-runnable.** Any sub-app can render outside the shell with zero store changes. The bus subscriber simply receives no messages.
- **Testable in isolation.** Sub-app tests need no shell store provider. Bus messages can be mocked with a simple event emitter.
- **Module Federation alignment.** MF remotes are designed to be independently deployed. Shared stores create implicit deployment coupling (a store shape change requires coordinated deploys). Isolated stores with a message contract avoid this.
- **Gas Town ready.** The bead-sling pattern maps directly to pub/sub messages. No store surgery needed to support Mayor/Deacon/Witness coordination.
- **DevTools clarity.** Each app's Redux DevTools instance shows only its own state -- no confusion about which slice belongs to which app.

### Costs

- **Message schema maintenance.** The `FrameBusMessage` type registry must be kept in sync across shell and sub-apps. Schema drift is the new failure mode (replacing state collision).
- **No cross-app selectors.** You cannot write `useSelector(state => state.blogengine.drafts)` from the shell. If the shell needs sub-app data, it must go through the bus or an API call.
- **Eventual consistency overhead.** Theme changes propagate via message, not via shared reference. In practice this is sub-millisecond for same-window `BroadcastChannel`, but it is a conceptual shift from "one store, one truth."
- **More boilerplate for synchronized state.** Each piece of shared state requires: shell dispatch + bus publish on the source side, bus subscribe + local dispatch on the consumer side.

### Neutral

- The existing cv-builder self-contained `<Provider>` workaround (shell #5) is now the canonical pattern, not a workaround. No migration needed for existing sub-apps.
- `@ojfbot/frame-bus` is small (~100 lines). It can live in `frame-ui-components` or as a standalone package. The location decision is not load-bearing.

## Failure modes addressed

| Failure mode | How this architecture prevents it |
|---|---|
| **Hydration mismatch** -- sub-app store shape changes break shell rehydration | Stores are separate; each hydrates from its own `localStorage` key. A sub-app schema migration is invisible to the shell. |
| **State collision** -- two apps define a slice with the same name | Impossible. Separate `configureStore()` calls with separate reducer maps. |
| **Stale shared singleton** -- MF shared `react-redux` resolves to different versions causing context mismatch | Already mitigated by MF `singleton: true` config (ADR-0012). Isolated stores add defense-in-depth: even if context leaks, stores are separate objects. |
| **Deployment coupling** -- sub-app store shape change requires shell redeploy | Bus messages are the contract, not store shape. Sub-apps can change internal state freely as long as they honor the message schema. |
| **Race condition on dynamic reducer injection** -- sub-app registers reducer before shell store is ready | Not applicable. No dynamic injection exists in this architecture. |

## Alternatives considered

| Alternative | Why rejected |
|---|---|
| **A: Shell owns shared slices; sub-apps inject reducers** (shell #5 Option A) | Tight coupling. Sub-app reducer changes require shell awareness. Race conditions on mount order. DevTools become unreadable at scale. Violates MF independent-deploy principle. |
| **C: Dynamic reducer injection via reducerRegistry singleton** (shell #5 Option C) | Complex implementation. Race conditions between `store.replaceReducer()` and component renders. HMR breaks reducer registry state. No clear ownership of the singleton lifecycle. |
| **D: Separate stores, shell reads sub-app store ref via exposed MF module** (shell #5 Option D) | Breaks `useSelector` composability. Shell would need to subscribe to a foreign store and re-dispatch into its own -- this is the pub/sub pattern with extra steps and no type safety. |
| **Single global store with namespace conventions** | Scales poorly beyond 3-4 apps. Namespace discipline is unenforced at the type level. Every sub-app deploy must be compatible with the global store schema. |

## References

- [ojfbot/shell#5](https://github.com/ojfbot/shell/issues/5) -- Frame-wide Redux store strategy
- [ojfbot/shell#21](https://github.com/ojfbot/shell/issues/21) -- Gas Town adoption: shell as Mayor host + activity aggregator
- ADR-0029: Prop-only boundary for shell UI components
- ADR-0030: Shared Frame UI Components Library
- ADR-0012: Module Federation remote integration pattern
- [cv-builder PR #98](https://github.com/ojfbot/cv-builder/pull/98) -- original self-contained Provider workaround
