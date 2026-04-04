# ADR-0036: Lock-File Rebuild Protocol

Date: 2026-04-04
Status: Accepted
OKR: 2026-Q1 / O2 / KR2 (fleet hardening)
Commands affected: /hardening, /validate, /sweep
Repos affected: all fleet repos (13)

---

## Context

During the April 2026 fleet hardening sprint, lock file rebuilds across 13 repos exposed a recurring pattern: rebuilding `pnpm-lock.yaml` to remediate transitive dependency vulnerabilities can silently introduce type-breaking changes (e.g. `@types/express` 5.x changing route param types from `any` to `Record<string, string>`) or new vulnerabilities in unrelated subtrees.

TripPlanner #42 and BlogEngine #43 both required post-merge type fixes after lock file rebuilds pulled in Express 5 type changes. These were caught only after merge because no `tsc --noEmit` step existed in CI. Similarly, cv-builder's xmldom override fixed one CVE but left 35 high-severity `tar` findings unaddressed — discovered only by a manual audit.

## Decision

Lock file rebuilds that touch `@types/*` packages, framework packages (Express, React, Vite, LangChain), or security-sensitive transitive dependencies must pass two gates before merge:

1. **`pnpm exec tsc --noEmit`** — type-check all packages with no emit. Catches breaking type changes introduced by updated `@types/*` or framework packages.
2. **`pnpm audit --audit-level=high`** — verify zero high-severity findings. Catches cases where a rebuild fixes one CVE but introduces or exposes others.

Both gates run in CI as required steps that block merge on failure. They are separate from the build step — `pnpm build` succeeding does not imply type safety or security compliance.

## Consequences

### Gains
- Type-breaking changes from transitive dependency updates are caught pre-merge, not post-merge.
- Security remediation PRs are verified end-to-end: fixing one CVE cannot silently leave others unaddressed.
- The protocol is mechanical and CI-enforced — no human judgment required for the gate itself.

### Costs
- CI time increases by the duration of `tsc --noEmit` (typically 5-15s per package) and `pnpm audit` (~2s).
- Lock file rebuild PRs may be blocked by pre-existing audit findings unrelated to the current change. This is intentional — it forces triage.

### Neutral
- The protocol does not prescribe _how_ to fix audit findings (overrides, upgrades, or accept-risk). That decision remains per-repo and per-vulnerability.

## Alternatives considered

| Alternative | Why rejected |
|-------------|--------------|
| Run type-check only on packages whose deps changed | Too fragile — transitive type changes can break downstream packages that didn't directly change. Full workspace type-check is the only reliable gate. |
| Run audit only for the specific CVE being fixed | Misses the "fix one, expose another" pattern observed in cv-builder. Full audit is the correct scope. |
| Manual review instead of CI gate | The Express 5 type failures prove manual review missed the issue twice. CI enforcement is required. |
