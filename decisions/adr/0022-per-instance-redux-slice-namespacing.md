# ADR-0022: Per-instance Redux slice namespacing for multi-instance spawning

Date: 2026-03-18
Status: Accepted
OKR: 2026-Q1 / O1 / KR1 (Shell renders — multi-instance readiness)
Repos affected: shell
Blocks: [shell] #5 (Redux store isolation under multi-instance spawning)

---

## Context

[shell] #37 merged NL instance spawning (2026-03-18): a user can now say "open a new TripPlanner
for Paris" and ShellAgent instantiates a fresh app window with a new Redux thread slice. This
works for the first instance. The behaviour when a second instance of the same app type is
spawned is undefined.

The current Redux store structure uses the app type as the primary key for thread slices (e.g.
`state.threads.tripplanner`). Two TripPlanner instances would write to the same key. The likely
failure mode is **silent state collision**: the second instance overwrites the first instance's
slice, producing subtly wrong state in both — no crash, no thrown error, wrong behaviour. This
is the hardest class of bug to diagnose in production and the hardest to write a regression test
for after the fact.

**Hard stop:** no second-instance integration test is written until this ADR is reviewed and
[shell] #5 is implemented. Writing tests against the current architecture would validate
incorrect behaviour and give false confidence.

## Decision

Each spawned app instance is assigned a **unique instance ID** at spawn time (e.g.
`tripplanner-paris-1748f3`). Redux thread slices are keyed by instance ID, not app type:

```
state.threads.<instanceId>        // per-instance thread state
state.instances.<instanceId>      // instance metadata: appType, displayName, createdAt
state.instancesByType.<appType>   // index: appType → [instanceId, ...]
```

ShellAgent constructs the instance ID at spawn time (deterministic: slugified intent + short
UUID). The Module Federation remote load, Redux slice initialisation, and UI focus all reference
the instance ID as the primary key from that point forward.

Ambiguity resolution (two existing TripPlanner instances when a third is requested) is handled
by the G3 Approval Queue: ShellAgent surfaces the candidate instances in the plan object, the
user confirms which context to use or approves a new spawn. The queue is the ambiguity resolver;
this ADR defines the data model that makes the queue's plan object accurate.

## Consequences

### Gains
- Two instances of the same app type can coexist in the Redux store without collision.
- The instance ID is the single key that ties together the Redux slice, the MF remote, the
  thread history, and the Approval Queue plan object.
- `instancesByType` index makes it cheap to enumerate running instances without a full store
  scan — used by ShellAgent for resumption and the Approval Queue for blast-radius display.
- Second-instance integration tests can now be written against a deterministic data model.

### Costs
- All existing selectors that key on app type (`state.threads.tripplanner`) must be migrated
  to key on instance ID. This is a breaking change to the Redux schema — requires a migration
  for any persisted state (localStorage / sessionStorage).
- ShellAgent prompt must be updated to emit the instance ID as part of the intent object, not
  just the app type.
- The `instancesByType` index must be kept in sync with slice creation and destruction —
  a Redux middleware or reducer invariant is needed to prevent drift.

### Neutral
- MrPlug relay context re-injection ([shell] #24) is a separate concern. Thread resumption
  with relay context depends on the instance ID being stable across a suspend/resume cycle.
  This ADR defines the stable key; #24 defines how relay context is re-associated with it.

## Alternatives considered

| Alternative | Why rejected |
|-------------|--------------|
| Key slices by appType + index (e.g. `tripplanner-0`, `tripplanner-1`) | Sequential index is not stable across suspend/resume. ShellAgent cannot reconstruct the index from natural language intent. Instance ID must be content-addressable (tied to the spawn intent), not position-addressable. |
| Separate Redux store per instance | Breaks the shared-singleton constraint (ADR-0001 analogue). Module Federation remotes depend on a shared Redux context. Separate stores would require separate React trees — effectively iframes. |
| Key by displayName (e.g. `state.threads['Berlin Interviews']`) | Display names are mutable (user can rename). Mutable keys in a Redux store cause reference drift across selectors and history. Instance ID must be immutable. |
