# Decisions

This directory is the written record of architectural and product decisions made in this project. It exists so that the reasoning behind how things are built is explicit, searchable, and can be challenged when circumstances change.

```
decisions/
  adr/     Architecture Decision Records — why the system is built the way it is
  okr/     Objectives and Key Results — what we are trying to achieve
```

---

## ADR index

Grouped by `domain` (the six bounded contexts + `meta`). Identity is the `slug`; the number is a non-load-bearing serial (ADR-0087). Regenerate with `/adr publish`.

### Shell + Host Composition (`shell-host-composition`)
| Serial | Title | Type | Status |
|--------|-------|------|--------|
| 0001 | [Module Federation over iframes for shell composition](adr/0001-module-federation-not-iframes.md) | architecture | Accepted |
| 0002 | [Single LLM gateway (frame-agent) for all sub-apps](adr/0002-single-llm-gateway.md) | architecture | Accepted |
| 0006 | [GraphQL Federation for Frame OS domain data layer](adr/0006-graphql-federation-domain-data-layer.md) | architecture | Proposed |
| 0007 | [GET /api/tools capability manifest contract for all Frame sub-apps](adr/0007-get-api-tools-capability-manifest.md) | convention | Accepted |
| 0008 | [ShellAgent Routing Protocol and MetaOrchestrator Dynamic Discovery](adr/0008-shell-agent-routing-protocol.md) | architecture | Accepted |
| 0009 | [Dual-Mode App Architecture](adr/0009-dual-mode-app-architecture.md) | architecture | Accepted |
| 0012 | [Module Federation Remote Integration Pattern](adr/0012-module-federation-remote-integration-pattern.md) | architecture | Accepted |
| 0017 | [Store-level singleton enforcement for single-context app types](adr/0017-singleton-enforcement-store-level.md) | architecture | Proposed |
| 0022 | [Per-instance Redux slice namespacing for multi-instance spawning](adr/0022-per-instance-redux-slice-namespacing.md) | architecture | Accepted |
| 0023 | [NL instance spawning via ShellAgent, not a sidebar affordance](adr/0023-nl-spawning-via-shell-agent-not-sidebar.md) | architecture | Accepted |
| 0034 | [Isolated Redux stores with pub/sub message-passing boundary](adr/0034-frame-wide-redux-store-strategy.md) | architecture | Proposed |
| 0058 | [Sub-app registration schema](adr/0058-sub-app-registration-schema.md) | convention | Accepted |

### Agent Graph (`agent-graph`)
| Serial | Title | Type | Status |
|--------|-------|------|--------|
| 0019 | [Isolated context windows per domain agent — synthesis at output layer only](adr/0019-isolated-synthesis-context-windows.md) | architecture | Accepted |

### Workflow Engine (`workflow-engine`)
| Serial | Title | Type | Status |
|--------|-------|------|--------|
| 0003 | [Skill directories over flat command files](adr/0003-skill-directories-over-flat-files.md) | convention | Superseded by ADR-0021 |
| 0021 | [Rename .claude/commands/ → .claude/skills/](adr/0021-skills-directory-rename-from-commands.md) | convention | Accepted |
| 0038 | [Morning Workflow Progressive Agent Orchestration](adr/0038-morning-workflow-orchestration.md) | process | Accepted |
| 0045 | [Skill /grill-with-docs for pre-planning Socratic alignment](adr/0045-grill-with-docs-skill.md) | tooling | Accepted |
| 0046 | [Skill /tdd for red-green-refactor enforcement](adr/0046-tdd-skill.md) | tooling | Accepted |
| 0047 | [Skill /deepen for Ousterhout-style module depth audits](adr/0047-deepen-skill.md) | tooling | Accepted |
| 0048 | [Skill /triage and the severity/effort/domain/type rubric](adr/0048-triage-skill.md) | tooling | Accepted |
| 0049 | [Pocock-style mode extensions on /plan-feature and /orchestrate](adr/0049-pocock-mode-extensions.md) | tooling | Accepted |
| 0055 | [User-scope baseline for Pocock skills + principles](adr/0055-user-scope-baseline.md) | convention | Proposed |
| 0068 | [Agent must follow skill suggestions](adr/0068-follow-skill-suggestions.md) | policy | Accepted |
| 0082 | [Subagent strategy — default to skills + native delegation; `.claude/agents/` deferred](adr/0082-subagent-strategy.md) | process | Accepted |
| 0083 | [Adopt Pocock-style skill conventions; add /prototype, /caveman, /zoom-out, and the writing pipeline](adr/0083-pocock-skill-conventions-and-new-skills.md) | convention | Accepted |
| 0084 | [SKILL.md is the canonical skill body filename (fleet-wide Skill-tool callability)](adr/0084-skill-md-canonical-filename.md) | convention | Accepted |

### Gas Town Governance (`gas-town-governance`)
| Serial | Title | Type | Status |
|--------|-------|------|--------|
| 0015 | [Gas Town + Paperclip + Wasteland as the multi-agent coordination layer](adr/0015-gas-town-paperclip-wasteland-adoption.md) | architecture | Accepted |
| 0016 | [FrameBead — foundational work primitive for Frame Gas Town adoption](adr/0016-framebead-work-primitive.md) | architecture | Proposed |
| 0024 | [G3 Approval Queue as security primitive, not a permission dialog](adr/0024-g3-approval-queue-as-security-primitive.md) | architecture | Accepted |
| 0025 | [Gas Town execution + governance primitives in @core/workflows before shell/cv-builder adoption](adr/0025-gas-town-primitives-in-core-workflows-before-adoption.md) | architecture | Accepted |
| 0027 | [GasTownPilot as first direct @core/workflows consumer sub-app](adr/0027-gastown-pilot-direct-core-workflows-consumer.md) | architecture | Accepted |
| 0028 | [React Query for server state in GasTownPilot](adr/0028-react-query-for-gastown-pilot-server-state.md) | architecture | Accepted |
| 0039 | [Dolt as BeadStore backend](adr/0039-dolt-bead-store.md) | infrastructure | Accepted |
| 0040 | [Claude session beads for meta-coordination](adr/0040-session-beads-meta-coordination.md) | process | Accepted |
| 0041 | [Convoy orchestration via bead-emit.mjs](adr/0041-convoy-orchestration.md) | process | Accepted |
| 0042 | [Two-tier session initializer](adr/0042-session-initializer.md) | process | Accepted |
| 0043 | [AgentBead Bridge](adr/0043-agent-bead-bridge.md) | architecture | Accepted |
| 0052 | [Bead prefix reservations for non-Frame rigs](adr/0052-bead-prefix-reservations-non-frame.md) | convention | Proposed |
| 0061 | [gastown-pilot Intake tab](adr/0061-gastown-pilot-intake-tab.md) | architecture | Proposed |
| 0062 | [Reserved FrameBead label keys](adr/0062-reserved-framebead-label-keys.md) | convention | Proposed |

### Observation (`observation`)
| Serial | Title | Type | Status |
|--------|-------|------|--------|
| 0010 | [CoreReader Metadata Dashboard](adr/0010-corereader-metadata-dashboard.md) | architecture | Proposed |
| 0026 | [CoreReader write-capability deferred to Phase 5, not Phase 1](adr/0026-corereader-write-capability-deferred-to-phase-5.md) | process | Accepted |
| 0032 | [Daily-Logger React + Vercel Migration](adr/0032-daily-logger-react-vercel-migration.md) | infrastructure | Accepted |
| 0033 | [Daily-Cleaner Confidence Threshold Policy](adr/0033-daily-cleaner-confidence-threshold-policy.md) | policy | Proposed |
| 0035 | [Daily-cleaner inference budget cap](adr/0035-daily-cleaner-inference-budget-cap.md) | policy | Proposed |
| 0037 | [Skill telemetry, intent matching, and PR audit](adr/0037-skill-telemetry-and-intent-matching.md) | tooling | Accepted |
| 0050 | [Skill metrics measurement system](adr/0050-skill-metrics-system.md) | tooling | Accepted |
| 0053 | [Bead-aware /frame-standup; informal-bead spine until A1 FrameBead is blocked](adr/0053-bead-aware-frame-standup-defer-a1.md) | process | Proposed |
| 0054 | [Standup funnel measurement (suggestion → closure)](adr/0054-standup-funnel-measurement.md) | tooling | Proposed |
| 0063 | [daily-logger perRig digest extension](adr/0063-daily-logger-perrig-digest-extension.md) | tooling | Proposed |
| 0070 | [Reaching the selfco vault from the Claude apps — GitHub mirror + connector now, locally-hosted obsidian-mcp later](adr/0070-vault-multi-surface-access.md) | architecture | Accepted |
| 0073 | [selfco ingest removes the `draft` gate — the box files all non-terminal Inbox rows](adr/0073-selfco-ingest-removes-draft-gate.md) | policy | Proposed |
| 0079 | [Vault page-lifecycle policy — promoter-side ingest gate + graph-aware staleness signal](adr/0079-vault-page-lifecycle-policy.md) | policy | Proposed |
| 0080 | [Vault staleness scanner — graph-aware signal, surface-only, layered on `/vault lint`](adr/0080-vault-staleness-scanner.md) | tooling | Proposed |
| 0085 | [The `selfco` LLM Wiki and the `/vault` skill](adr/0085-selfco-vault-and-skill.md) | tooling | Accepted |

### UI Components (`ui-components`)
| Serial | Title | Type | Status |
|--------|-------|------|--------|
| 0005 | [IBM Carbon Design System for sub-app UI components](adr/0005-carbon-design-system.md) | architecture | Accepted |
| 0011 | [Settings Modal Chrome Ownership and ErrorBoundary Reset Contract](adr/0011-settings-modal-chrome-ownership.md) | convention | Accepted |
| 0020 | [No Redux store imports inside @ojfbot/shell packages/ui components](adr/0020-shell-ui-package-no-redux-imports.md) | convention | Accepted |
| 0029 | [Prop-only boundary for @ojfbot/shell UI components](adr/0029-shell-prop-only-ui-boundary.md) | convention | Accepted |
| 0030 | [Shared Frame UI Components Library](adr/0030-shared-frame-ui-components-library.md) | architecture | Accepted |

### Meta / platform (`meta`)
| Serial | Title | Type | Status |
|--------|-------|------|--------|
| 0004 | [pnpm workspaces as the package manager for all monorepos](adr/0004-pnpm-workspaces.md) | infrastructure | Accepted |
| 0013 | [Safe Demo Deployment — Frame OS at frame.jim.software](adr/0013-safe-demo-deployment.md) | infrastructure | Accepted |
| 0014 | [Layered Deployment Architecture](adr/0014-layered-deployment-architecture.md) | infrastructure | Accepted |
| 0018 | [Separate cv-builder repo slug from Resume Builder display name](adr/0018-cv-builder-slug-resume-builder-display-name.md) | convention | Accepted |
| 0036 | [Lock-File Rebuild Protocol](adr/0036-lock-file-rebuild-protocol.md) | infrastructure | Accepted |
| 0044 | [Ubiquitous language layer (CONTEXT.md + GLOSSARY.md)](adr/0044-ubiquitous-language-layer.md) | convention | Accepted |
| 0051 | [RigProfile + workbench partition by profile](adr/0051-rigprofile-workbench-partition.md) | tooling | Proposed |
| 0056 | [Developer Day Orchestration — Master](adr/0056-developer-day-orchestration-master.md) | process | Accepted |
| 0057 | [Launcher mechanism under core/scripts/launcher](adr/0057-launcher-mechanism-core-scripts-launcher.md) | infrastructure | Accepted |
| 0059 | [tmux topology and visual status language](adr/0059-tmux-topology-and-visual-status-language.md) | infrastructure | Accepted |
| 0060 | [Dual Claude session model](adr/0060-dual-claude-session-model.md) | process | Accepted |
| 0064 | [Hammerspoon workspace orchestration](adr/0064-hammerspoon-workspace-orchestration.md) | infrastructure | Superseded by [workstation-yuri/ADR-0001](../../../workstation-yuri/decisions/adr/0001-workstation-orchestration.md) (2026-05-16) |
| 0065 | [Zero-point and provenance convention](adr/0065-zero-point-and-provenance-convention.md) | convention | Accepted |
| 0066 | [Always-green CI policy](adr/0066-always-green-ci-policy.md) | policy | Proposed |
| 0067 | [Shared GitHub Actions repo (`ojfbot/github-actions`)](adr/0067-shared-github-actions-repo.md) | infrastructure | Accepted |
| 0069 | [Cross-link asset-foundry's dual Blender transport contract for fleet visibility](adr/0069-asset-foundry-blender-transport-cross-link.md) | convention | Accepted |
| 0081 | [CLAUDE.md loading-discipline routing (rules/ as Layer 1)](adr/0081-path-scoped-rules-dir-adoption.md) | convention | Proposed |
| 0086 | [Control-Gated Slices — how we decompose and ship large agentic-harness work](adr/0086-control-gated-slices.md) | process | Accepted |
| 0087 | [Stable-identity + facet-tag ADRs — NASA Configuration Management applied to decision records](adr/0087-stable-identity-and-facet-tags.md) | convention | Accepted |

- For a flat chronological view: `/adr list --by-serial`.

### Proposed (unnumbered)

Drafts awaiting `/adr accept` — identity is the slug; the serial is assigned at accept (ADR-0087).

| Slug | Title | Domain | Type |
|------|-------|--------|------|
| `obsidian-bases-views` | [Obsidian Bases as the vault's dynamic browsing layer](adr/draft-obsidian-bases-views.md) | observation | tooling |
| `lint-shadow-to-gate` | [Promote vault lint from shadow mode to a commit gate](adr/draft-lint-shadow-to-gate.md) | observation | policy |
| `defuddle-ingest-fetch` | [defuddle as a reversible, shadow-mode ingest trial](adr/draft-defuddle-ingest-fetch.md) | observation | tooling |
| `semantic-link-suggester` | [Semantic link-suggester for cultivate](adr/draft-semantic-link-suggester.md) | observation | tooling |

---

## OKR index

| Period | File | Track |
|--------|------|-------|
| Q1 2026 | [okr/2026-q1.md](okr/2026-q1.md) | Technical |

Personal/career OKRs live in `personal-knowledge/okr/` (not tracked publicly).

---

## How to write an ADR

Use `/adr new "title of the decision"` to generate a stub from the template.

**Identity (ADR-0087).** The `slug` is each ADR's permanent identity; the 4-digit serial is a
non-load-bearing display number assigned at accept (never reused or renumbered). Drafts are
`draft-<slug>.md` (no number); `/adr accept <slug>` assigns the serial and renames to
`<serial>-<slug>.md`. Cross-reference ADRs as `adr:<slug>`. Evolve a decision with `/adr revise`
(bumps `rev:`) — never renumber.

**Status lifecycle:** `Proposed` → `Accepted` → `Superseded` / `Deprecated` (a `Superseded` ADR carries
`traces: superseded-by: <slug>`).

### When to write an ADR

Write one when you are making a decision that:
- Affects multiple repos or multiple commands
- Involves a trade-off (you rejected at least one alternative)
- Would be confusing to a future reader without context
- Is mentioned in a `/validate`, `/investigate`, or `/techdebt` output

### The "3 places" rule

When a mistake or pattern is caught and a decision is updated:
1. Update or add the ADR (here)
2. Update the relevant `knowledge/` file in the affected command
3. Update `memory/MEMORY.md` with the summary

This is the full write-back loop. Stopping at step 1 means the next session won't have the context loaded.

