# OJF Workflow Framework

> Portable Claude Code workflow framework: 40+ slash commands for the full development lifecycle, backed by a TypeScript engine for CLI and CI use. Includes `/bead` for session-handoff across repos, `/vault` for personal knowledge management, `/fleet-onboard` for drift reconciliation, and `/wayfinder` for decision maps.

Part of [Frame OS](https://github.com/ojfbot/shell) — an AI-native application OS built as both a live product and an engineering portfolio. This repo is the shared development infrastructure that powers all Frame OS projects.

### Why this exists

Every repo in the Frame OS ecosystem needs the same development workflows — planning, scaffolding, validating, deploying, investigating. Instead of duplicating scripts or publishing packages, this is a portable framework that installs into any sibling repo via symlink. One `install-agents.sh` call gives any project the full lifecycle toolkit with zero build step and instant propagation.

### Design decisions

- **Skill directories over flat scripts** — each command is self-contained with its own orchestration prompt, knowledge files, and utility scripts
- **Symlink installation over package publishing** — zero build step, instant propagation across all ecosystem repos (shared UI components use [npm publishing](https://github.com/ojfbot/frame-ui-components) with Vite alias for local dev)
- **100+ ADRs** — every significant decision documented with context, alternatives considered, and rationale (see [ADR-0036](decisions/adr/ADR-0036.md) for the lock-file-rebuild protocol, [ADR-0037](decisions/adr/ADR-0037.md) for JSONL truncation, [ADR-0043](decisions/adr/ADR-0043.md) for the AgentBead bridge, [ADR-0085](decisions/adr/ADR-0085.md)/[ADR-0070](decisions/adr/ADR-0070.md) for vault reachability, [ADR-0098](decisions/adr/ADR-0098.md) for two-track telemetry, [ADR-0102](decisions/adr/ADR-0102.md) for OPM inspectability)
- **Self-improvement loop** — `/techdebt` proposes patches to the framework itself, never production code

## Features

- **40+ slash commands** — plan, scaffold, validate, deploy, investigate, harden, sweep, suggest-skills, vault, fleet-onboard, wayfinder, opm, and more
- **Skill-directory architecture** — each command is a self-contained directory with orchestration prompt, knowledge files, and scripts
- **TypeScript engine** — `@core/workflows` backs the same commands for CI and programmatic use
- **Cross-repo installation** — `install-agents.sh` and `session-init.sh` symlinks skills + domain knowledge into sibling repos (symlinks tracked in git to survive clone and branch-switch)
- **Self-improvement loop** — `/techdebt` records patterns and proposes patches to the framework itself
- **Architecture Decision Records** — 100+ ADRs documenting every significant decision across the ecosystem
## Tech Stack

| Layer | Technology |
|-------|-----------|
| Engine | TypeScript, Anthropic SDK |
| Testing | Vitest |
| Build | pnpm workspaces, TypeScript compiler (`tsc --noEmit` CI gate) |

---

## For humans

| I want to... | Start here |
|---|---|
| Understand what this project is and how it's structured | [docs/architecture.md](docs/architecture.md) |
| See why decisions were made the way they were | [decisions/adr/](decisions/adr/) |
| Understand current priorities | [decisions/okr/2026-q3.md](decisions/okr/2026-q3.md) |
| Set up and start using commands | [docs/getting-started.md](docs/getting-started.md) |
| Find the right command for a task | [docs/commands.md](docs/commands.md) |

## For Claude Code

| I need... | Read |
|---|---|
| Agent context before cross-repo work | [domain-knowledge/frame-os-context.md](domain-knowledge/frame-os-context.md) |
| Available commands and architecture | [CLAUDE.md](CLAUDE.md) |
| Skill reference material | `.claude/skills/<name>/knowledge/` |
| ADR for a specific decision | [decisions/adr/](decisions/adr/) |

---

## Quick start

```bash
pnpm install && pnpm build
```

Commands are available immediately in Claude Code — no build step required:

```
/plan-feature add auth to the API
/validate
/investigate why is the LangGraph node failing
/push-all
/adr new "server-side session storage over JWT"
```

Install into a sibling repo:

```bash
./scripts/install-agents.sh lean-canvas

# user-scope baseline (Pocock skills + ~/.claude/CLAUDE.md):
./scripts/install-agents.sh --user-scope
# ...plus the /vault skill, the ~/selfco knowledge vault, and the opt-in vault-session hook:
./scripts/install-agents.sh --user-scope --with-selfco
```

---

## What's in here

```
.claude/skills/     slash commands (skill directories with knowledge/ and scripts/; catalog includes suggested_after and layer_affinity fields)
packages/
  workflows/          @core/workflows — TypeScript workflow engine
  read-model-contract/  shared read-model types
domain-knowledge/     Machine context corpus (loaded by commands at runtime)
decisions/
  adr/                Architecture Decision Records (ADR-0001 through ADR-0102+, including ADR-0037 JSONL truncation, ADR-0043 AgentBead bridge, ADR-0085/0070 vault reachability, ADR-0098 two-track telemetry, ADR-0102 OPM inspectability)
  okr/                Objectives and Key Results
docs/                 Human-readable documentation
docs/audits/          Dated audit + survey series (attic)
```

---

## The self-improvement loop

`/techdebt` is the meta-command. Other workflows trigger it when they encounter patterns worth recording. It proposes patches to `packages/workflows/**`, `domain-knowledge/**`, or `.claude/skills/**` — never production code.

When a mistake is caught, write it in 3 places:
1. Update or add the ADR in `decisions/adr/`
2. Update the relevant `knowledge/` file in the affected command
3. Update `memory/MEMORY.md`

See [decisions/README.md](decisions/README.md) for the full write-back protocol.

## Contributing

All changes go through pull requests — never push directly to main.

```bash
git checkout -b feat/my-change
# make changes
git add <files>
git commit -m "feat: description of change"
git push -u origin feat/my-change
gh pr create --draft
```

### Run the CI checks locally

Run the full `pnpm verify` before marking a PR ready, and paste its summary into the PR. Failures
then show up on your machine instead of as GitHub alerts after the PR is open
([#650](https://github.com/ojfbot/core/issues/650)).

```bash
pnpm verify                 # every job of every workflow that runs on pull_request: PASS / FAIL / SKIPPED / INCOMPLETE per job, then a summary
pnpm verify --quick         # the build and unit tests only (ci/build-test), on your working tree: for iterating
pnpm verify --job ci        # one workflow, or one job such as ci/build-test (repeatable); --list shows the names
pnpm verify --native        # run on this Mac and your working tree instead of in the Linux runner
pnpm verify --verbose       # also stream every step's output
pnpm verify --check         # check that the workflow files and verify still agree; runs nothing
```

`scripts/verify.mjs` reads the jobs, steps, environment variables and service containers from
`.github/workflows/*.yml`, so they cannot drift. A workflow key or action it does not understand
(for example `needs:`, `strategy:` or `shell:`) is reported by name, never skipped, and
`scripts/lib/__tests__/verify-ci.test.mjs` fails when a job has no verify entry.

- **Needs** Docker Desktop running (SKIPPED with the fix if not). Off Linux, every job runs in an
  Ubuntu 24.04 container (`scripts/verify-runner/`, built once per Node version) on a clean clone of
  `HEAD`, as GitHub runs on a fresh runner: **commit first**, since uncommitted files are not tested.
  `--quick` and `--native` run on your Mac and working tree.
- **Event.** Jobs run as a pull request would (`github.event_name` is `pull_request`). A workflow
  with `on.pull_request.paths` runs only when your branch changes one of its paths, as on GitHub,
  and `--job` runs it anyway. Workflows with no `pull_request` trigger (`claude.yml`,
  `claude-code-review.yml`) are not part of verify and are named in its notes.
- **Output.** Each job prints its steps, then `PASS`, `FAIL`, `SKIPPED` or `INCOMPLETE` with the
  reason and the fix. `INCOMPLETE` means a step was skipped by its own `if:` and nothing explains why
  GitHub would skip it too. The closing summary (one line per job, `HEAD`, wall-clock time, warnings)
  is what you paste into the PR. The exit code is non-zero on any FAIL, any INCOMPLETE, and any job
  skipped only because this machine was not ready (Docker off).
- **GitHub-only jobs.** A job that needs a secret, the GitHub API or an external action with no local
  stand-in is `SKIPPED` with the reason, never passed: today `claude-skill-audit/skill-audit` (posts a
  PR comment) and `security-scan/security` (a reusable workflow from another repository). They are
  checked by GitHub only.
- **The release image job is opt-in.** `fleet-runner-release/release-image` builds Docker images, so it
  needs a Docker engine, and the only one here is this machine's own: a modified release script could
  start containers that mount your folders or read other containers' secrets (GitHub runs it on a
  throwaway engine). So the default `pnpm verify` does not run it: it shows `SKIPPED ... opt-in, NOT RUN`
  and **exits non-zero when your branch triggers it** (changes under `packages/fleet-runner/**`, the root
  `package.json`, the lockfile and so on). Run it with `pnpm verify --job fleet-runner-release` once
  you have read the branch's changes to the scripts it runs; it prints a loud warning and takes about a
  minute. Every other job, including the Linux runner, gets no Docker socket. A nested Docker engine
  with no host socket is the alternative, not built yet.
- **What a job can see.** In the runner: a clean container with no host mounts but the pnpm download
  cache. On this machine (`--quick`, `--native`): an allowlist, never your shell's environment, so no API
  key, cloud credential or agent socket reaches the branch's code: only `PATH`, a scratch `HOME` and
  `TMPDIR`, the locale, the CI markers and what the workflow's own `env:` declares. A checkout of
  another ref (`with.ref`) only runs in the runner; verify never deletes the repository (it removes only
  its own scratch folders and `packages/*/dist`).
- **Steps that GitHub allows to fail or that only GitHub can do.** A failed `continue-on-error: true` step
  keeps the job green, as on GitHub, but the job is listed as `PASS (allowed failure)` with the step named,
  never a plain `PASS`. An artifact upload is reported as `SKIPPED, GitHub-only` and never counts as a
  check; a job in which no `run:` step passed is `INCOMPLETE`.
- **Output is redacted.** Everything printed or logged has the home folder, the repository root and the
  temp folder replaced (`~`, `<repo>`, `$TMPDIR`), including the output of the steps, so the summary is
  safe to paste into a public PR.
- **Cleanup.** Containers, the runner, the BuildKit builders this run created (in its own buildx store, never yours
  or another run's) and its scratch folders are removed when it ends, including on failure and Ctrl-C. Only the runner image, the pnpm download cache (a Docker volume) and pulled images
  stay. Logs are under `$TMPDIR/core-verify/`; `--verbose` streams them.
- **Flaky tests.** If `pnpm test` or `proof:local:test` fails on a FleetRunner test that passes on a
  re-run, that is the known flakiness tracked in [#649](https://github.com/ojfbot/core/issues/649);
  say so in the PR rather than weakening the check.

Differences from GitHub that remain: the runner is a container on Docker Desktop's Linux VM, not a
GitHub-hosted VM; on Apple silicon the `linux/amd64` release image runs under emulation; the runner
shares the machine's Docker engine; `concurrency:`, `permissions:` and the artifact upload are not
simulated; pushes to `main` and `workflow_dispatch` runs are not simulated (a pull request is).

## License

MIT

## Frame OS Ecosystem

Part of [Frame OS](https://github.com/ojfbot/shell) — an AI-native application OS.

| Repo | Description |
|------|-------------|
| [shell](https://github.com/ojfbot/shell) | Module Federation host + frame-agent LLM gateway |
| **core** | **Workflow framework — 40+ slash commands + TypeScript engine + skill suggestion/telemetry + /vault personal knowledge (this repo)** |
| [FrameBus](https://github.com/ojfbot/FrameBus) | Event bus with ADR-0013, Playwright e2e |
| [cv-builder](https://github.com/ojfbot/cv-builder) | AI-powered resume builder with LangGraph agents |
| [capture-agent](https://github.com/ojfbot/capture-agent) | Golf-course capture agent (formerly gcgcca; renamed 2026-07-30) — TX imagery → segmentation model → HF; Pydantic + TypeScript type bridge |
| [blogengine](https://github.com/ojfbot/BlogEngine) | AI blog content creation platform |
| [TripPlanner](https://github.com/ojfbot/TripPlanner) | AI trip planner with 11-phase pipeline |
| [core-reader](https://github.com/ojfbot/core-reader) | Documentation viewer for the core framework |
| [lean-canvas](https://github.com/ojfbot/lean-canvas) | AI-powered lean canvas business model tool |
| [gastown-pilot](https://github.com/ojfbot/gastown-pilot) | Multi-agent coordination dashboard |
| [seh-study](https://github.com/ojfbot/seh-study) | NASA SEH spaced repetition study tool |
| [daily-logger](https://github.com/ojfbot/daily-logger) | Automated daily dev blog pipeline (Vercel serverless) |
| [purefoy](https://github.com/ojfbot/purefoy) | Roger Deakins cinematography knowledge base |
| [MrPlug](https://github.com/ojfbot/MrPlug) | Chrome extension for AI UI feedback |
| [frame-ui-components](https://github.com/ojfbot/frame-ui-components) | Shared component library (Carbon DS) — published to npm as `@ojfbot/frame-ui-components` |
| [beaverGame](https://github.com/ojfbot/beaverGame) | Terrain-to-dam sandbox loop — water-as-highway game mechanic |
| [asset-foundry](https://github.com/ojfbot/asset-foundry) | AI-driven Blender asset pipeline |
| [silicon-empires](https://github.com/ojfbot/silicon-empires) | Claim-system strategy game — stacked-PR development pattern |
| [switchboard](https://github.com/ojfbot/switchboard) | FastAPI proxy — byte-for-byte SSE passthrough |
| [mirrorworld](https://github.com/ojfbot/mirrorworld) | Real USGS 3DEP terrain rendered as three.js heightfield |
| [virtualLight](https://github.com/ojfbot/virtualLight) | Book-to-cinema pipeline — passage extraction + cinematography-styled video prompts |
| [f1-doctrine](https://github.com/ojfbot/f1-doctrine) | RAQG question layer — suggests strategist questions bound to f1-substrate calls |
| [morning-cockpit](https://github.com/ojfbot/morning-cockpit) | Local-first morning dashboard — beads, reading, research pods |
