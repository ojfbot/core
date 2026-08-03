# Blast-radius guide

Loaded during `/deploy` Step 3. Answer three questions for the change being shipped: **who is affected, what contracts move, and how bad is the worst case.** Every blast-radius item found here must map to a monitoring target in Step 6.

## 1. Affected services

Walk outward from the diff, one hop at a time:

- **The app itself** — which routes, pipelines, or background jobs execute the changed code?
- **Module Federation seams** — if a remote's exposed modules or the shell's remote map changed, the shell and every sibling remote loading it are in the radius. A remote that fails to load degrades the whole shell surface.
- **Shared packages** — a change under a workspace package (`frame-ui-components`, `@core/workflows`, shared configs) radiates to every consumer in the workspace. List them (`pnpm why <pkg>` / grep imports); each consumer is affected even if its own code didn't change.
- **LLM gateway path** — changes to `frame-agent`, `switchboard`, or provider adapters affect every sub-app that routes AI calls through them.
- **Data stores** — migrations, schema changes, seed scripts: anything else reading the same store is in the radius, including jobs that run on a schedule and won't hit the change until later.

## 2. API contract changes

For each surface, classify the change:

| Change | Compatibility | Note |
|---|---|---|
| Additive (new endpoint/field, optional param) | Safe | Old clients unaffected |
| Widening (accept more, e.g. optional → nullable) | Usually safe | Verify validators downstream |
| Narrowing (require more, remove/rename field, status-code change) | **Breaking** | Needs coordinated rollout or versioning |
| Semantic (same shape, different meaning/units/ordering) | **Breaking and invisible** | The worst kind — call it out explicitly |

Contracts include: HTTP/SSE endpoints, event payloads, MF exposed-module signatures, env var expectations, DB schema read by other code, and file formats consumed by scripts or CI.

## 3. Risk level

Assign one level, justified by the radius above:

- **Low** — single app, additive change, no contract movement, no migration. Rollback = revert.
- **Medium** — crosses one seam (shared package bump, additive contract change, backwards-compatible migration). Rollback documented and tested.
- **High** — breaking contract change, irreversible migration, auth/session/payment paths, or radius spanning 3+ services. Requires a staged rollout plan or explicit operator sign-off, plus named monitoring per affected surface.

Anything touching auth, secrets, data deletion, or money is High regardless of diff size.
