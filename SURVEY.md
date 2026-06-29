# Core + Shell Seam — Evidence Survey (Phase 1)

> **Artifact type: SURVEY, not a northstar.** This is the evidence/discovery phase of a migration-grade
> decomposition of `core`. It documents core and the core↔shell seam **as they actually are today**.
> **Out of scope (hard): any proposed decomposition, FTI/OTAV cuts, or target architecture.** Tempting
> fixes are quarantined in `decisions/northstar/offsite/phase2-candidates.md`, never here. Phase 2
> (decomposition proposal) and Phase 3 (per-unit northstars) come later, against this evidence.
>
> **Repo is ground truth; the Notion page mirrors it.** Generated 2026-06-28 from filesystem + git
> evidence (3 parallel read-only surveys). Every claim is path- or command-cited so it is auditable.
>
> **Success test:** could someone who has never seen core understand what it is, what it costs, what
> depends on it, and what is risky about changing it — *without being told what it should become?*

Repo facts: `/Users/yuri/ojfbot/core`, remote `github.com/ojfbot/core`, branch `main`, 268 commits,
HEAD `ff48008` (2026-06-27). 80 commits in the trailing 30 days — actively developed.

---

## 1. Inventory

### A. TypeScript engine — `packages/` (pnpm workspace; members: `packages/*` + `scripts/launcher/tests`)

| Package | Path | What | Size | Last commit | Tests |
|---|---|---|---|---|---|
| `@core/workflows` | `packages/workflows/` | The engine: slash-command workflow library + bead store + skill telemetry | 72 TS files, ~7,985 LOC | 2026-06-27 | **Yes** — 29 `*.test.ts` |
| `@core/read-model-contract` | `packages/read-model-contract/` | GraphQL read-model contract (schema + surface) | 3 files, 84 LOC | 2026-06-26 | Yes |
| `@core/cli` | `packages/cli/` | `core-workflow` binary | 1 file, 28 LOC | **2026-02-28 (stale)** | No |
| `core-vscode-extension` | `packages/vscode-extension/` | VS Code ext backing slash-skills | 1 file, 100 LOC | **2026-02-28 (stale)** | No |

`@core/workflows` is the dense core. Modules (`src/`): `runner.ts`, `registry.ts`, `parseCommand.ts`,
`subagent.ts`, `convoy.ts`, `event-bus.ts`, `llm.ts`, `mail.ts`, `maintenance-patrol.ts`,
`molecule-compiler.ts`, `formula-parser.ts`, `sling.ts`, `agent-lifecycle.ts`, `prime-node.ts`,
`fileBackedWorkflow.ts`. Subdirs: `bead-store/` (`DoltBeadStore.ts` 262 LOC, `FilesystemBeadStore.ts`,
`dolt-schema.sql`), `tracking/` (skill-telemetry pipeline: emit/ledger/projector/reconciler/
skill-acted*/expected-artifact/canvas-io), `workflows/` (summarize, techdebt), `utils/`, `types/`.
`cli` + `vscode-extension` are near-empty stubs, frozen since Feb.

### B. Shell scripts + Node utilities — `scripts/`
- **`install-agents.sh`** (29KB) — symlink-deploys core skills/knowledge/hooks into sibling repos (see §2.1).
- **Northstar (recently built):** `northstar-lint.mjs` (shadow-only, ADR-0089), `lib/northstar-fm.mjs` (the hand-rolled frontmatter parser — only file in `scripts/lib/`).
- **Ops/audit:** `audit-repos.sh` (27KB), `audit-ci-health.sh`, `check-provenance.sh`, `analyze-telemetry.sh`, `sync-telemetry.sh`, `generate-skill-report.sh`, `frame-dev.sh`, `setup-vercel-ci.sh`, `deploy-demo.sh`, `lint-federation-shared.js`.
- **Telemetry .mjs:** `skill-metrics.mjs` (23KB), `skill-acted-emit.mjs`, `gate-event.mjs`; `scripts/claude-md/footprint.mjs` (+tests).
- **launchd plists:** `dolt-beads-launchd.plist`, `sync-telemetry-launchd.plist`, `skill-architecture-audit-launchd.plist`.
- **`scripts/hooks/`** — the hook layer: `bead-emit.mjs` (39KB, largest single script, 19 verbs), `bead-session.sh`, `session-init.sh`, `claude-md-gate.sh` (+subdir+tests), `log-skill.sh`, `log-tool-use.sh`, `log-session.sh`, `lint-before/after-edit.sh`, `scan-after-write.sh`, `suggest-skill.sh`/`suggest-skills.mjs`, `standup-*.mjs`, `reconcile-*.mjs`, `skill-acted-detect.mjs`, `vault-session.sh`, `_lib.sh`. Has `__tests__/` (9 files).
- **`scripts/launcher/`** — fleet launcher: `scripts/{bootstrap,launch,lib,spotlight-launch}.sh`, `schema/registration.schema.json`, `registrations/` (7 rigs: core, core-reader, daily-logger, f1-pit-wall, f1-substrate, gastown-pilot, shell), `tmux/{builder,status}.sh`, `tests/` (own pnpm pkg, schema-validation only), README + REGISTRATION_GUIDE.

### C. Decision records — `decisions/`
- `adr/` — **95 ADRs**, last 2026-06-27 (very active).
- `northstar/` — 7 files (README registry, schema.md, template.md, l2-ojfbot, l3-shared, offsite/), last 2026-06-28.
- `okr/` — 2 files, last **2026-03-10 (stale)**. `orchestration/`, `research/` — 1 file each, 2026-05-04. `README.md`.

### D. Skills — `.claude/skills/`
**61 skill directories**; `.claude/commands` is a symlink → `skills`. Catalog at
`.claude/skills/skill-loader/knowledge/skill-catalog.json` (1,686 lines, 61 entries) — **no root-level
catalog**. Root `skills/` holds only `.gitkeep` (vestigial). `.claude/` also: `agents/`, `prompts/`,
`worktrees/` (gitignored), `.mcp.json`, `settings.json`, `settings.local.json` (35KB, gitignored).

### E. Knowledge docs
- `domain-knowledge/` — 24 `.md` (per-app arch notes + CONTEXT.md, GLOSSARY.md, frame-os-context.md, shared-stack.md, shell-mayor-spec.md, shell-mf-integration.md, selfco-vault.md), last 2026-06-10.
- `personal-knowledge/` — 11 files, **gitignored** (not in history).

### F. Root & other
`package.json` (workspace `core-workflow-framework`, pnpm@9.15.4), `tsconfig.base.json`, `eslint.config.mjs`,
`vitest.config.ts`, `CLAUDE.md` (22KB), `CLAUDE-MD-ROLLOUT.md`, standing reports (`TECHDEBT.md`,
`HARDENING-AUDIT-2026-03-30.md`, `DEEPSTACK-ARCHITECTURE-EVALUATION-2026-06-13.md`), `docs/`, `formulas/`
(`.toml`), `specs/`, `runs/` (gitignored), `.handoff/` (13 beads), `.github/workflows/` (5).

**Density:** dense/active — `@core/workflows`, `decisions/adr` (95), `.claude/skills` (61), `scripts/hooks`,
northstar tooling. Stale/vestigial — `packages/cli` + `vscode-extension` (Feb), `decisions/okr` (Mar), root `skills/`.

---

## 2. Inbound dependency map (the blast radius)

### 2.1 `install-agents.sh` — SYMLINK fan-out (largest blast vector)
Almost everything installed into a sibling is a **relative symlink back into core**, not a copy
(`link_file()` → `ln -s`). Editing a file in core instantly changes behavior in every installed repo.
Installed per target: `.claude/skills/<name>/` (symlink each), `.claude/commands→skills`, 10 universal
`domain-knowledge/*.md` (symlink each), a repo-specific arch file (symlink, auto-detected by name),
`decisions/core→core/decisions` (symlink), `personal-knowledge/tbcony-job-target.md` (symlink),
`scripts/hooks/*` (symlink each). **Copies (rare):** `.github/workflows/claude-skill-audit.yml`,
`.claude/standup.md` (heredoc template). Skill install is **catalog-driven** — `skill-catalog.json`
`status != active` ⇒ skipped (a control-plane input). The script also `jq`-mutates each target's
`.claude/settings.json` **and** the shared `~/.claude/settings.json`.

### 2.2 Hooks deployed to siblings — two scopes
**Per-repo** (`.claude/settings.json`): `log-skill.sh` (PostToolUse Skill → `~/.claude/skill-telemetry.jsonl`),
`bead-session.sh` (PostToolUse Skill+Bash → `bead-emit.mjs`, needs Dolt:3307), `claude-md-gate.sh`
(PreToolUse Write|Edit, **shadow/fail-open**). **User-level** (`~/.claude/settings.json`, once):
`session-init.sh` (UserPromptSubmit → agent bead + parallel-session context + opportunistic telemetry sync),
`suggest-skill.sh` (UserPromptSubmit → catalog trigger match → `~/.claude/suggestion-telemetry.jsonl`;
hardcoded fallback `CORE_DIR=/Users/yuri/ojfbot/core`), `reconcile-skill-acted.mjs` (Stop, async, all repos),
`vault-session.sh` (SessionEnd, opt-in `--with-selfco`). Telemetry sinks are **shared user-global
singletons** in `_lib.sh`: `~/.claude/{skill,tool,session,suggestion}-telemetry.jsonl`.

### 2.3 Launcher registrations — `scripts/launcher/registrations/`
Authoritative consumer is **core's own** `launch.sh` (the `/workbench` skill). Cross-repo reach-in:
**workstation-yuri** `hammerspoon/launcher.lua:20` hardcodes `~/ojfbot/core/scripts/launcher` and shells
out to `launch.sh` (its own comment flags the break-on-move, ADR-0001 §Costs); `telemetry.lua` tails
`~/.claude/skill-telemetry.jsonl`. **shell does NOT read registrations** — the relation is inverted:
`registrations/shell.json` describes how to *launch* shell, and its headless pane runs core's
`bead-emit.mjs agent-create`. Same for `f1-pit-wall.json`.

### 2.4 `bead-emit.mjs` / queue-claim — the verb interface
19 verbs (session/task/PR/convoy/agent/queue). Consumers: core hooks (agent-create etc.);
**morning-cockpit** `packages/server/src/queue-claim.ts` → `execFile`s `…/core/scripts/hooks/bead-emit.mjs
queue-claim` (ADR-0010; depends on the literal path + Dolt + the "one JSON line last" stdout contract);
**mc-perf/mc-motion** (worktrees, same coupling); **shell** `frame-agent/routes/beads.ts` does NOT shell
out — opens its own `mysql2` pool to the same Dolt; launcher registration panes embed `bead-emit.mjs`;
**f1-substrate** CLAUDE.md documents reliance + `BEAD_PREFIX_MAP` prefix `f1`.

### 2.5 Northstar registry
`decisions/northstar/README.md` frontmatter is the registry, parsed by `northstar-lint.mjs` +
frame-standup `read-northstar.mjs`. Registered L1s point into siblings via `path: ../<app>/.claude/northstar.md`
and `ladders_up_to` back to core's `l2-ojfbot.md`; `ns:<slug>#Pn` must resolve on disk (ADR-0087), enforced
by lint.

### 2.6 Other reach-ins
`skill-catalog.json` (read by suggest-skill from any repo + install-agents + symlinked everywhere); the
four `~/.claude/*-telemetry.jsonl` singletons (also tailed by workstation-yuri, synced by `sync-telemetry.sh`
into CI); the **shared Dolt store** `/Users/yuri/.beads-dolt`@3307 (launchd-managed; writer=core bead-emit,
readers=morning-cockpit ×3 + shell, all hardcoding 3307 + db `.beads-dolt`); daily-logger writing pipeline
(writing-* skills symlinked from core).

---

## 3. Outbound dependency map (what core depends on)

**npm:** `@anthropic-ai/sdk ^0.30.0` (sole LLM gateway, `src/llm.ts`, `ANTHROPIC_API_KEY`, default
`claude-sonnet-4-5`); `mysql2 ^3.22` (Dolt wire driver — declared in **both** root and workflows
package.json); `smol-toml` (formula `.toml`); `graphql` (read-model-contract); dev: typescript5.5/eslint9/
vitest2/@types/node22; launcher tests vendor `ajv`.

**External services / infra:** **Dolt sql-server TCP :3307** db `.beads-dolt` (pervasive — DoltBeadStore,
bead-emit, port probes in bead-session/session-init, frame-dev; launchd `dolt-beads-launchd.plist` →
`/Users/yuri/.beads-dolt`; bead tests require a live instance). **Anthropic API** (SDK + `.mcp.json` →
`mcp.anthropic.com/{notion,github}`). **GitHub via `gh` CLI** (13+ `gh pr`/`gh api` sites). **Vercel**
(setup/deploy scripts). **Sibling repos at `../<name>`** (install-agents resolves `$OJFBOT_ROOT/<name>`).

**Runtime assumptions:** Node 22 (CI + @types), pnpm 9.15.4, macOS/launchd (3 plists, `lsof`, `tmux`, `jq`),
a running Dolt server, `gh` authed, and sibling repos present at `../`.

### Hooks invoked (`.claude/settings.json`)
PreToolUse Write|Edit → `claude-md-gate.sh`; PostToolUse Write|Edit → inline `npx prettier --write`;
PostToolUse Skill → `log-skill.sh` (async) + `bead-session.sh`; PostToolUse Bash → `bead-session.sh`.

---

## 4. Implicit contracts & coupling (undocumented assumptions)

- **Telemetry JSONL schemas** exist only as the `jq -nc` emit shape in hooks (no schema file). The
  skill-suggestion **funnel** joins `skill-telemetry.jsonl` ↔ `suggestion-telemetry.jsonl` on
  `(session_id, skill, suggestion_id)` — any field rename silently breaks it.
- **Bead frontmatter shape** (`.claude/skills/bead/references/bead-schemas.md`) is doc-defined; the Dolt
  `beads` table is a separate machine shape (`dolt-schema.sql`).
- **Launcher registration JSON** (`schema/registration.schema.json`, `schema_version const 1.0.0`,
  `additionalProperties:false`) — `bead_prefix` description hardcodes coupling to
  `BEAD_PREFIX_MAP` at `packages/workflows/src/types/bead.ts:95-105`.
- **`skill-catalog.json`** — `status` absent ≡ active, `scope` absent ≡ not-user-scoped: an implicit-default
  contract documented only in install-agents.sh comments.
- **Northstar frontmatter — the fragile parser.** `scripts/lib/northstar-fm.mjs` is a no-dependency,
  regex, line-oriented YAML *subset* parser (`LIST_KEYS = {properties, registry}` only; hand-rolled
  scalar coercion; silently `continue`s on unrecognized lines). Every consumer (lint, read-northstar,
  future rollup) and the entire `ns:<slug>#Pn` reference graph depend on this exact subset; an
  out-of-subset construct mis-parses with no error.
- **`status.jsonl`** (movement log) — absence tolerated ("staleness unchecked"), no schema file.
- **Shared singletons:** the four `~/.claude/*-telemetry.jsonl` (appended by every installed repo, only
  concurrency guarantee = "single echo below PIPE_BUF", no locking); `~/.claude/settings.json` (jq-merged);
  the Dolt store. The queue-label contract (TTLs, lease windows) lives inline in `bead-emit.mjs`
  `RESERVED_QUEUE_LABELS` and is **manually mirrored**, dated, into
  `morning-cockpit/packages/shared/src/dolt-bead.ts` ("we deliberately do NOT import @core/workflows") —
  drift between the two copies is undetected.
- **Consumers bound to current behavior:** morning-cockpit parses bead-emit's "last JSON line"; both
  morning-cockpit and workstation-yuri hardcode the literal core path; the funnel depends on field-name
  agreement; `claude-md-gate.sh` consumers rely on it *not* blocking (shadow) today.
- **Fused concerns (described, not split):** `install-agents.sh` (skills + knowledge + arch-detect +
  decisions-migrate + hooks + two settings-merges + workflow-copy + standup-template + Pocock baseline +
  vault scaffold); `bead-emit.mjs` (19 verbs across session/task/convoy/agent/queue + inline label
  contract on one Dolt conn); `session-init.sh` (bead-create + session-awareness + telemetry-sync fork);
  `northstar/README.md` (doc **and** machine registry); `_lib.sh` (stdin + repo-detect + formatters +
  telemetry paths + append primitive).

---

## 5. Pain points & risk zones (honest, not tidy)

- **Dormant zones inside an active repo:** `packages/cli` + `packages/vscode-extension` frozen since
  2026-02-28 while CLAUDE.md still advertises them as the "supporting TS engine"; `scripts/launcher`
  executor untouched since May (1 commit/30d); `decisions/okr` stale since March.
- **Untested where it matters most:** `northstar-lint.mjs` (the only enforcement of ref integrity — itself
  unverified), `skill-metrics.mjs` (23KB), `gate-event.mjs`, top-level `skill-acted-emit.mjs`,
  `install-agents.sh` (the symlink installer) — **no tests.** The launcher executor (`launch.sh`,
  `lib.sh`, `tmux/builder.sh`, `spotlight-launch.sh`) has **zero** bash-level tests (only registration-JSON
  schema validation). `bead-emit.test.mjs` **requires a live Dolt:3307** — dormant coverage in clean/CI.
- **Fragile contracts:** the hand-rolled `northstar-fm.mjs` parser; the launcher's shell-out-and-text-parse
  (`jq -r` per field, `tmux` string-matching, `set -euo pipefail` aborts whole bring-up on any hiccup);
  `spotlight-launch.sh` AppleScript-injection surface defended by one regex.
- **"Remove this and the fleet breaks" zones:** `~/.claude/settings.json` wires **7 hooks that fire on
  every Claude session on this Mac**, six pointing into core (session-init, suggest-skill, log-tool-use,
  log-session, reconcile-skill-acted) — *plus a SECOND `reconcile-skill-acted.mjs` from a separate repo
  `core-tracking`* (a forked/duplicated hook). `~/.claude/skills/` is **14 symlinks into
  `core/.claude/skills/`** — moving core silently breaks `/adr`, `/bead`, `/frame-standup`, etc. everywhere;
  `install-agents.sh` is the only repair tool and is untested. The Dolt store is a single shared instance
  with no backup noted.
- **TECHDEBT.md (updated 2026-05-12)** tracks debt *outside* core (e.g. TD-002 = shell's untested
  `meta-orchestrator.ts:269 hasCrossDomainSignal()`) and is **itself a runtime write target from shell**
  (see §6) — a doc that is also a live sink.
- **0 inline TODO/FIXME/HACK** markers in scripts (debt lives in TECHDEBT.md instead).

---

## 6. The core↔shell seam (focused)

### What shell actually calls in core
**Verdict: shell does NOT reach into core's launcher, registrations, bead-emit, or any core script.**
(`grep -rniIE "\.\./core|/core/|launcher|registrations|bead-emit" shell --exclude-dir=node_modules` →
only `.gitignore` + one ADR.) The only live couplings:
1. **`/api/beads` — a shared Dolt store, not a call into core.** `shell/packages/frame-agent/src/routes/beads.ts`
   opens its **own** `mysql2` pool to `127.0.0.1:3307` db `.beads-dolt` and `SELECT * FROM beads`. Core's
   `bead-emit.mjs` writes to that same instance. Coupling = shared database; shell never knows core exists.
   Filesystem fallback reads `~/.beads/<prefix>/*.json` when Dolt is down.
2. **`/api/techdebt` — hardcoded filesystem reach into core's working tree.**
   `shell/packages/frame-agent/src/routes/techdebt.ts` defaults to `$HOME/ojfbot/core/TECHDEBT.md` and
   `appendFile`s incidents. Shell **writes into core's repo on disk by convention path** — no API, no
   path validation; only a Zod body schema.
3. **Doc symlinks** (gitignored): `shell/decisions/core → ../../core/decisions`, `shell/domain-knowledge →
   ../core/domain-knowledge/`. Shell consumes core's *docs* by symlink (this is how it "sees" the northstar).

**MF host wiring** composes sub-apps as Vite MF remotes (`AppFrame.tsx import('core_reader/Dashboard')`);
`core-reader` is a separate repo/port, unrelated to `/core` the engine.

### Blurred responsibility line
- Bead **emission** is in core (`bead-emit.mjs` write verbs); bead **aggregation** is in shell (`beads.ts`
  read endpoint). Neither imports the other — the `beads` table shape is the only shared contract. Core
  just shipped `packages/read-model-contract` (a canonical query-only SDL) which **shell does not consume**
  (shell uses ad-hoc `SELECT *` + `JSON.parse` of `labels`/`refs`).
- `TECHDEBT.md` is owned by core but **written by shell's frame-agent**.

### The DRIFT — stated leg-5 division vs. current code
Stated on record (leg-5 confirmed block): *shell = authorizing surface (insight + authorized mechanism,
zero-trust at the boundary); core = the spawn mechanism; shell routes/authorizes, core executes.* Against
the code:
1. **Shell authorizes nothing.** `frame-agent/src/server.ts` has `helmet` + `cors` allowlist + a rate
   limiter, and **no authentication/authorization at all** (`grep -niE "authoriz|authenticat|jwt|bearer|
   zero-trust|permission" packages/frame-agent/src packages/agent-core/src` → empty). "Zero-trust auth at
   the boundary" exists in zero lines. The only "boundary" concept is "one Anthropic key for the cluster" —
   a secret-holder, not an authorizer.
2. **There is no boundary between shell and the launcher because they never touch.** Shell does not route
   to the launcher (no `launch.sh`/`tmux`/spawn-into-core anywhere in `shell/packages/**`). The launcher is
   invoked by humans/Spotlight/workstation-yuri. "shell routes/authorizes → core executes" describes a
   path that does not exist.
3. **core's launcher does not execute spawns shell routes to it** — it creates `tmux` windows for local
   rigs, run via `/workbench` or Spotlight/Hammerspoon. No shell involvement.
4. **"spawn" is overloaded across the seam.** Shell's `spawnInstance` (`meta-orchestrator.ts`,
   `appRegistrySlice.ts`) is an **LLM-emitted Redux action that mounts an MF React Dashboard in the
   browser**. Core's launcher "spawn" is **creating an OS tmux pane**. Same verb, no connecting code path.

**Net:** the leg-5 architecture (authorizing shell over an executing core launcher) is **entirely
aspirational** relative to current code. The repos are coupled only by (a) a shared Dolt table, (b) one
hardcoded `TECHDEBT.md` path, (c) doc symlinks. There is no routing channel and no authorization layer.
Shell is, if anything, a *launch target* of core's launcher, not a surface above it.

### The dangling reference (noted, not resolved)
Shell's leg-5 northstar P2 forward-references `ns:l1-core#P-launcher`. It does not resolve: core has **no
`l1-core` northstar** and no `P-launcher` (registry slugs are l1-cv-builder, l1-morning-cockpit,
l1-f1-pit-wall, l1-f1-substrate, buddy-check, l2-ojfbot, l3-shared). Core is itinerary leg-6 #22, status
`queued` — its northstar is unauthored. Shell is leg-5 #15, `briefed`, with no own `northstar.md` on disk
yet. Existence recorded per spec; left unresolved for Phase 2.

---

## 7. Known unknowns (the most important section — generous and honest)

Things we genuinely do not understand yet about core's current state:

1. **What is `core-tracking`?** `~/.claude/settings.json` wires a *second* `reconcile-skill-acted.mjs`
   from `/Users/yuri/ojfbot/core-tracking` alongside core's. Is it a fork, a successor, an experiment? Its
   relationship to core and whether both hooks double-write telemetry is unknown.
2. **Is the Dolt store backed up / recoverable?** A single shared `/Users/yuri/.beads-dolt`@3307 is the
   write target for all bead state and the read source for shell + cockpit. No backup, replication, or
   corruption-recovery path was found. Blast radius of its loss is unknown.
3. **Do the bead/launcher tests ever run?** `bead-emit.test.mjs` requires a live Dolt; the launcher bash
   has no tests. Whether CI has a Dolt instance (and thus whether this coverage executes at all, vs. being
   dormant) is unverified.
4. **How many siblings are currently install-agents'd, and are their symlinks intact?** The symlink web is
   the primary coupling and the only repair tool (`install-agents.sh`) is untested. No audit of broken/stale
   links across the fleet exists.
5. **What consumes the dormant `packages/cli` + `packages/vscode-extension`?** Frozen since Feb but still
   advertised as the engine. Whether anything (CI, a docs path, a human workflow) still depends on them, or
   they are effectively dead, is unknown.
6. **Are `convoy` / `sling` / `mail` / `event-bus` / `agent-lifecycle` / `molecule-compiler` /
   `formula-parser` live or speculative?** `@core/workflows` carries substantial code for these; how much
   is exercised at runtime vs. built-ahead-of-use is undetermined.
7. **What exercises the `formulas/*.toml` + `prime-node` / formula machinery?** Present in the repo; the
   live trigger path is unclear.
8. **Is `northstar-lint` wired to any CI gate, or only run by hand?** It is shadow-only by design; whether
   anything runs it automatically (so the dangling ref would ever be caught) is unknown.
9. **What's in the 35KB gitignored `.claude/settings.local.json`?** Potentially load-bearing,
   unversioned configuration with no record of its contents or who depends on them.
10. **Where is `personal-knowledge/` sourced/backed up?** Gitignored, not in history; its provenance and
    durability are unknown.
11. **How is the manual `core ↔ morning-cockpit` bead-type mirror kept in sync?** It is dated 2026-06-07
    and explicitly *not* imported; there is no drift detector. How far the two copies have already diverged
    is unknown.
12. **What happens when shell `appendFile`s `TECHDEBT.md` while core is on a different branch / dirty / mid-rebase?**
    The cross-seam write assumes a clean conventional checkout; the failure mode is unexamined.
13. **Who/what owns `read-model-contract`'s intended consumer?** It exists, is recent, and is unused by the
    obvious consumer (shell `/api/beads`). What it was built to serve is unclear.
14. **Are `mc-perf` / `mc-motion` intentional worktrees or abandoned scratch?** They duplicate the
    queue-claim coupling into core; their lifecycle/ownership is undetermined.
15. **Full inventory of what fires on every session globally.** Seven hooks in `~/.claude/settings.json`
    were found; whether that list is complete and what each costs per-session (latency, Dolt round-trips)
    is not fully characterized.

---

*Phase-2 candidates (tempting fixes spotted during the survey) are quarantined in
`decisions/northstar/offsite/phase2-candidates.md` — deliberately kept out of this evidence record.
Next: James + chat pressure-test this survey by voice for honesty and completeness (especially §7), then
Phase 2 applies FTI/OTAV (definitions to be pulled from the selfco vault) against this evidence.*
