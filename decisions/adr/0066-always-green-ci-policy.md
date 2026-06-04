# ADR-0066: Always-green CI policy

Date: 2026-05-05
Status: Proposed
OKR: 2026-Q2 / O2 (developer ergonomics) / KR3 (post-task quality discipline closes the feedback loop)
Commands affected: /validate, /deploy, /push-all
Repos affected: all 24 cluster repos (16 documented in core/CLAUDE.md ecosystem table + 8 ancillary)

---

## Context

A CI-health audit (run `core/scripts/audit-ci-health.sh`) on 2026-05-05 across 24 sibling repos revealed three patterns that have systematically eroded the trust-value of green CI:

| Finding | Count | Examples |
|---------|-------|----------|
| Non-blocking test or audit steps (`continue-on-error: true`, `\|\| true`) | 16 of 24 (67%) | `browser-automation-tests.yml` in 9 repos has `pnpm test:visual \|\| true` plus 3× `continue-on-error: true`; `security-scan.yml` in core/blogengine/etc. has `continue-on-error: true` on the SAST step; `claude-skill-audit.yml` has `continue-on-error: true` on the telemetry-fetch step. |
| Workflow → script drift (workflow references a script that isn't tracked in git) | 2 of 24 | `asset-foundry/.github/workflows/claude-skill-audit.yml` and `beaverGame/.github/workflows/claude-skill-audit.yml` referenced `scripts/hooks/pr-skill-audit.sh` which was a local symlink, never tracked. The job exited 127 on every PR for weeks. (Fixed in PRs ojfbot/beaverGame#36, ojfbot/asset-foundry#22, ojfbot/core#108.) |
| Repos with no CI test gate at all | 9 of 24 | shell, daily-logger, cv-builder, blogengine, TripPlanner, lean-canvas, purefoy, core-reader, landing — `pnpm test` does not run on PR. |

The user's framing:
> *"I've trained myself to ignore CI red because most red is noise."*

That's the core failure mode. **Green CI must mean "the change is safe to merge." Anything else is theater.** Mixed in with real signal, theatrical greens (or ignorable reds) train every reviewer — human or AI — to stop reading the badge.

This ADR is the first deliverable in the post-task discipline pillar of the Pocock-book-structured SDLC plan (see `~/.claude/plans/with-a-browser-agent-compressed-castle.md`). Books in scope: *Refactoring* (Fowler — keep code runnable) and *The Pragmatic Programmer* (Hunt & Thomas — feedback rate is your speed limit).

## Decision

**Every CI workflow in every active cluster repo must be one of three things, and nothing else:**

1. **Required and blocking** — the step runs on every PR, and red blocks merge. This is the default.
2. **Required and informational, with explicit job separation** — for genuinely advisory checks (e.g., visual diffs, performance benchmarks), split into a separate workflow that posts a PR comment but is *not* in the required-checks list. No `continue-on-error: true` inside an otherwise-required job.
3. **Removed** — if a step is neither blocking nor delivering signal anyone reads, it is deleted.

**No `|| true` on test/lint/build/typecheck/audit commands. No `continue-on-error: true` inside required workflows.** The script-drift pattern is treated as a P0 bug class: any workflow referencing a script must have that script committed to the repo (not as an untracked symlink).

**Required checks per active repo, at minimum:**
- `lint` (project-appropriate linter)
- `typecheck` (`tsc --noEmit` for TS repos; `mypy` or `pyright` for Python)
- `test` (the project's primary test command, exit-code blocking)

These are configured via GitHub branch protection on `main`.

A daily cluster canary (`core/scripts/audit-ci-health.sh`, scheduled in core's `claude-skill-audit.yml` workflow's daily branch) reports drift, opens an issue when a regression appears.

## Consequences

### Gains
- **Green CI regains meaning.** Reviewers (human and AI) can trust the badge again as a merge-safety signal.
- **The skill-audit drift class is structurally prevented** — the script-drift detection in `audit-ci-health.sh` would have caught the beaverGame/asset-foundry pattern within a day.
- **Forces honest conversations about flaky tests.** A test that's currently `|| true` either gets fixed or admits it doesn't work; either is better than the current limbo.
- **Aligns post-task discipline with pre-task discipline.** `/grill-with-docs` and `/tdd` only pay off if the post-task signal is trustworthy.

### Costs
- **Many existing PRs may suddenly fail** when non-blocking-to-blocking conversions land. Stage by repo; allow 2 weeks of warning-only operation before flipping each blocking gate.
- **Visual-regression workflow needs restructuring.** Currently it's a single workflow with `|| true` mixed throughout. Splitting it into "blocking smoke test" + "informational visual diff" requires per-repo work in the 9 repos that have it.
- **Branch-protection setup is per-repo manual work** unless we script it via `gh api`. Estimate: 30 minutes per repo × 13 repos with main branches = ~6 hours.
- **Daily canary runs cost CI minutes.** Worth measuring after a month.

### Neutral
- Some repos (foundry-recipes, gcgcca, GroupThink, hailstone, todo-todo, virtualLight) may be archived or inactive — exclude from required-check enforcement on a case-by-case basis. The audit script reports them; classification is a one-time decision per repo.

## Alternatives considered

| Alternative | Why rejected |
|-------------|--------------|
| **Soft policy: write a coding-standard line, no enforcement** | The current state is already "soft policy" — `coding-standards.md` references CI; people ignore it. The skill-audit drift wasn't caught by any soft signal. Soft policy is the disease; enforcement is the cure. |
| **Branch-protection only, no `\|\| true` rule** | Branch protection only enforces that a check *ran*, not that it *meant* anything. A workflow with `pnpm test \|\| true` will pass the check while silently swallowing failures. Need both the gate AND the integrity rule. |
| **Replace all CI with a single core orchestrator** | Tempting (one place to edit, no drift) but creates a single point of failure and forces all repos through one CI path. Per-repo workflows with a *common policy* preserves repo independence; cross-cutting drift is solved by the canary instead. |
| **Defer enforcement to manual review (relying on `/validate`)** | `/validate` is a skill the user invokes deliberately; not every PR will run it. Required CI checks fire on every PR by definition. The two layers complement each other (this ADR is Pillar 1; a future ADR makes `/validate` a CI gate as Pillar 3). |

## Implementation

Tracked in the SDLC plan at `~/.claude/plans/with-a-browser-agent-compressed-castle.md` (Phase A).

Order:
1. **This ADR + audit script merged to core** — establishes the policy and the data tool.
2. **Per-repo cleanup PRs** — remove `|| true` and `continue-on-error: true` from required jobs; split visual-regression into separate workflow; commit drifted scripts. One PR per repo, same pattern as the 12-PR install-agents-tracking sweep on 2026-05-04.
3. **Branch-protection setup** — `gh api` script to apply required checks across cluster.
4. **Canary scheduling** — daily run of `audit-ci-health.sh` posts a cluster-health issue when regression detected.

Phase B (*Cluster minimum test bar*) and Phase C (*/validate as CI gate*) follow this one. Without Phase A, those would be theater.
