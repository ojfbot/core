# ADR-0004: pnpm workspaces as the package manager for all monorepos

Date: 2026-01
Status: Accepted
OKR: 2026-Q1 / O1 / KR3
Commands affected: /setup-ci-cd, /scaffold-app, /deploy
Repos affected: node-template, cv-builder, shell, blogengine, tripplanner, MrPlug

---

## Context

Multiple repos in the Frame OS cluster are monorepos with multiple packages. We needed a consistent package manager that handles workspace dependencies well, works reliably in CI, and supports the pnpm filter (`--filter @ojf/workflows`) pattern for building individual packages. Node version consistency across machines and CI also needed to be enforced.

## Decision

Use pnpm for all package management across all repos. Node version is pinned at v24.11.1 via `.nvmrc` in each repo. `fnm` is the recommended version manager (`fnm use` to switch). All CI workflows use pnpm.

## Consequences

### Gains
- pnpm's strict mode prevents phantom dependencies — packages can only import what they explicitly declare.
- `--filter` flag enables building/testing a single package without touching the others.
- Consistent package manager across all repos means one mental model for the workbench.
- `.nvmrc` + fnm is lightweight and reliable; no need for nvm's shell hooks.

### Costs
- Engineers who default to npm or yarn need to consciously switch. Using the wrong package manager produces a second lockfile and broken installs.
- pnpm strict mode occasionally surfaces issues when a dependency assumes it can access transitive packages.

### Neutral
- pnpm install is generally faster than npm install for the repo sizes we're working with. This is a benefit but not the reason for the decision.

## Alternatives considered

| Alternative | Why rejected |
|-------------|--------------|
| npm workspaces | Slower, no strict mode, phantom dependency risk. npm is the fallback baseline but not good enough for monorepo management. |
| yarn (classic or berry) | Adds another tool to the stack without a clear benefit over pnpm. yarn berry's PnP mode introduces its own compatibility friction. |
| Mix of package managers per repo | No. Consistency across the cluster is worth the small migration cost. |
