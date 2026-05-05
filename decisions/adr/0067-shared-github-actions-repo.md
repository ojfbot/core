# ADR-0067: Shared GitHub Actions repo (`ojfbot/github-actions`)

Date: 2026-05-04
Status: Accepted
OKR: 2026-Q2 / O2 — engineering-platform durability
Commands affected: none (CI infrastructure)
Repos affected: github-actions (new), landing, core, cv-builder, blogengine, TripPlanner, lean-canvas, gastown-pilot, seh-study, core-reader, purefoy, shell, daily-logger, beaverGame, asset-foundry, mrplug, GroupThink, frame-ui-components

---

## Context

Two compounding problems forced this decision:

1. **`claude-skill-audit.yml` was broken on every consumer repo.** The workflow YAML is copied into consumers by `install-agents.sh`, but the script it executes (`pr-skill-audit.sh`) lives in `ojfbot/core/scripts/hooks/` and is *symlinked* into consumers. Symlinks pointing outside the repo are gitignored, so CI runners cloning a consumer repo never had the script. Every PR comment from the workflow read: *"Skill audit skipped: this repo does not ship `scripts/hooks/pr-skill-audit.sh` directly."* The audit was useless.

2. **Workflow-YAML duplication across the fleet is severe.** A survey of 17 ojfbot repos found:

| Workflow | # repos with it |
|---|---|
| `ci.yml` | 14 |
| `security-scan.yml` | 11 |
| `claude-code-review.yml` | 9 |
| `claude.yml` (Claude Code action) | 8 |
| `browser-automation-tests.yml` | 8 |
| `deploy.yml` (Vercel) | 8 |
| `claude-skill-audit.yml` | 7 |

Updates to any of these required N edits across N repos. Drift was inevitable; some consumers had stale workflows.

Three migration options were considered (see Alternatives). The shared-actions-repo pattern was chosen for durability and to avoid PAT-management overhead.

## Decision

Create a new public repo **`ojfbot/github-actions`** to host shared GitHub Actions and reusable workflows. Consumer repos reference them via `uses: ojfbot/github-actions/<path>@v1`.

Two patterns coexist:
- **Composite actions** at the repo root (e.g. `skill-audit/`) — for single-job workflows or steps that embed inside an existing consumer workflow.
- **Reusable workflows** under `.github/workflows/` (e.g. `security-scan.yml`) — for multi-job workflows consumed via `uses: ojfbot/github-actions/.github/workflows/<name>.yml@v1`.

Versioning uses major-version moving tags (`@v1`); breaking changes get a new major (`@v2`). Specific-version pins (`@v1.2.0`) are allowed but discouraged — most consumers should track `@v1`.

The first migrations:
- `skill-audit` composite action — replaces the broken pattern; landing's `claude-skill-audit.yml` migrates first as proof.
- `security-scan` reusable workflow — eliminates the 11-way duplication; core migrates first as proof.

`pr-skill-audit.sh` is REMOVED from `core/scripts/hooks/` and lives only in `github-actions/skill-audit/`. The symlink layer in `install-agents.sh` for that script is dropped.

## Consequences

### Gains
- Skill-audit actually runs on consumer PRs (was broken).
- Single source of truth for shared CI logic — fixes the drift problem.
- Versioned via tags — consumers can pin or float.
- New workflow patterns are easy to add: drop into the actions repo, tag, done.
- Public repo means no PAT management for consumers.
- Aligns with ADR-0066 ("always-green CI policy") — fewer moving parts means fewer drift-induced failures.

### Costs
- One more repo to maintain.
- Public repo means anyone can read the action source — acceptable for non-secret CI logic but worth knowing.
- Existing consumers must be migrated one-by-one (PRs in this session: landing for skill-audit, core for security-scan; rest follow in their own PRs).
- Tag/release discipline becomes load-bearing — a bad merge to `main` that gets re-tagged as `v1` would propagate to all consumers immediately. Mitigation: keep `@v1` pointing to a specific tested commit; only re-tag after a verified release.

### Neutral
- Consumer workflows shrink dramatically (a 100-line security-scan.yml becomes 5 lines that `uses:` the reusable workflow).
- Per-app variants (e.g. Vercel deploy with different project IDs) are handled via workflow inputs, not by forking the workflow.

## Alternatives considered

| Alternative | Why rejected |
|---|---|
| **Copy script on install** — extend `install-agents.sh` to copy `pr-skill-audit.sh` into each consumer repo (similar to how the workflow YAML is already handled). | Solves the immediate skill-audit issue but does NOTHING for the broader workflow-duplication problem. Pragmatic short-term fix; not the durable answer. |
| **Cross-repo checkout via PAT** — workflow does a second `actions/checkout` of `ojfbot/core`, runs the script from there. | Requires a `CROSS_REPO_PAT` secret in every consumer repo. PAT rotation overhead, secret-management burden across 14+ repos, and `core` is private so the auth complexity is real. Worse fit than a public actions repo. |
| **Inline the script into every consumer's workflow YAML** | Worse drift than the current symlink — script body would diverge across repos with no force toward consolidation. |
| **Big-bang migration of all 7 duplicated workflows in one PR set** | Too large a blast radius to validate; better to migrate one workflow at a time and confirm each works before the next. |

## Migration plan

This session ships:
1. `ojfbot/github-actions` repo with `skill-audit/` composite action and `.github/workflows/security-scan.yml` reusable workflow.
2. Tag `v1` (alongside `v1.0.0`).
3. Update `landing/.github/workflows/claude-skill-audit.yml` to use the new action — PR + merge + verify on a real PR.
4. Update `core/.github/workflows/security-scan.yml` to call the new reusable workflow — PR + merge + verify.
5. Register `github-actions` with daily-logger (REPOS list, KNOWN_REPOS, TAG_TYPE_MAP, backfill-tags) — separate PR.
6. Add to core's `CLAUDE.md` Ecosystem table.
7. Drop `pr-skill-audit.sh` from `core/scripts/hooks/` and remove its symlink in `install-agents.sh` — separate PR.

Subsequent PRs (NOT in this session) migrate the other duplicated workflows in priority order: `ci.yml`, `claude-code-review.yml`, `claude.yml`, `browser-automation-tests.yml`, `deploy.yml`. Each is independent and can be done one-at-a-time.
