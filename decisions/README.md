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
| 0008 | [0008-shell-agent-routing-protocol.md](adr/0008-shell-agent-routing-protocol.md) | architecture | Accepted |
| 0009 | [— Dual-Mode App Architecture](adr/0009-dual-mode-app-architecture.md) | architecture | Accepted |
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
| 0045 (rev A) | [Skill /grill-with-docs for pre-planning Socratic alignment](adr/0045-grill-with-docs-skill.md) | tooling | Accepted |
| 0046 (rev A) | [Skill /tdd for red-green-refactor enforcement](adr/0046-tdd-skill.md) | tooling | Accepted |
| 0047 | [Skill /deepen for Ousterhout-style module depth audits](adr/0047-deepen-skill.md) | tooling | Accepted |
| 0048 | [Skill /triage and the severity/effort/domain/type rubric](adr/0048-triage-skill.md) | tooling | Accepted |
| 0049 | [Pocock-style mode extensions on /plan-feature and /orchestrate](adr/0049-pocock-mode-extensions.md) | tooling | Accepted |
| 0055 | [User-scope baseline for Pocock skills + principles](adr/0055-user-scope-baseline.md) | convention | Proposed |
| 0068 | [Agent must follow skill suggestions](adr/0068-follow-skill-suggestions.md) | policy | Accepted |
| 0082 | [Subagent strategy — default to skills + native delegation; `.claude/agents/` deferred](adr/0082-subagent-strategy.md) | process | Accepted |
| 0083 | [Adopt Pocock-style skill conventions; add /prototype, /caveman, /zoom-out, and the writing pipeline](adr/0083-pocock-skill-conventions-and-new-skills.md) | convention | Accepted |
| 0084 | [SKILL.md is the canonical skill body filename (fleet-wide Skill-tool callability)](adr/0084-skill-md-canonical-filename.md) | convention | Accepted |
| 0093 | [Suggestion identity + denominator repair — the keystone for any skill-loop metric](adr/0093-suggestion-identity-and-denominator.md) | architecture | Accepted |
| 0094 | [Deliverable-tracking spine — gate-transition ledger → vault canvas projection (hook-audited)](adr/0094-deliverable-tracking-spine.md) | architecture | Accepted |
| 0095 (rev A) | [Skill-action instrumentation — a two-source, honesty-contracted `skill:acted` signal](adr/0095-skill-action-instrumentation.md) | architecture | Accepted |
| 0098 | [Two-track skill telemetry: the use-funnel and the evolution stream never blend](adr/0098-two-track-skill-telemetry.md) | architecture | Accepted |
| 0099 | [Harden the two-axis review — fixed-point pinning, parallel axes, Fowler smell baseline](adr/0099-two-axis-review-hardening.md) | tooling | Accepted |
| 0100 | [Absorb Pocock v1.1 lifecycle semantics into the existing mode surfaces](adr/0100-pocock-lifecycle-absorption.md) | tooling | Accepted |
| 0101 (rev A) | [/wayfinder — file-canonical decision maps upstream of the roadmap spine](adr/0101-wayfinder-decision-maps.md) | tooling | Accepted |

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
| 0010 | [— CoreReader Metadata Dashboard](adr/0010-corereader-metadata-dashboard.md) | architecture | Proposed |
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
| 0088 (rev B) | [Obsidian Bases as the vault's dynamic browsing layer](adr/0088-obsidian-bases-views.md) | tooling | Accepted |
| 0089 | [Promote vault lint from shadow mode to a commit gate](adr/0089-lint-shadow-to-gate.md) | policy | Accepted |
| 0090 | [defuddle as a reversible, shadow-mode ingest trial](adr/0090-defuddle-ingest-fetch.md) | tooling | Accepted |
| 0091 | [Semantic link-suggester for cultivate](adr/0091-semantic-link-suggester.md) | tooling | Accepted |
| 0102 | [OJF-OPL — a git-native Object-Process Methodology profile as the fleet's inspectability layer](adr/0102-opm-inspectability-layer.md) | architecture | Accepted |
| 0104 | [Behavioral misreports get their own ledger, and only an independent sweep may close one](adr/0104-defect-ledger-and-closure-loop.md) | architecture | Accepted |

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
| 0066 (rev A) | [Always-green CI policy](adr/0066-always-green-ci-policy.md) | policy | Proposed |
| 0067 | [Shared GitHub Actions repo (`ojfbot/github-actions`)](adr/0067-shared-github-actions-repo.md) | infrastructure | Accepted |
| 0069 | [Cross-link asset-foundry's dual Blender transport contract for fleet visibility](adr/0069-asset-foundry-blender-transport-cross-link.md) | convention | Accepted |
| 0081 | [CLAUDE.md loading-discipline routing (rules/ as Layer 1)](adr/0081-path-scoped-rules-dir-adoption.md) | convention | Proposed |
| 0086 | [Control-Gated Slices — how we decompose and ship large agentic-harness work](adr/0086-control-gated-slices.md) | process | Accepted |
| 0087 | [Stable-identity + facet-tag ADRs — NASA Configuration Management applied to decision records](adr/0087-stable-identity-and-facet-tags.md) | convention | Accepted |
| 0096 | [Skill architecture taxonomy and recurring audit](adr/0096-skill-architecture-taxonomy.md) | convention | Accepted |
| 0097 | [Wrap, absorb, or reject — integrating a mature external harness into an opinionated stack](adr/0097-wrap-absorb-reject.md) | process | Accepted |
| 0106 | [l1-core earns an operator-competence property (P5), teach loop as instrument](adr/0106-l1-core-operator-competence-property.md) | policy | Accepted |

### Other domains
| Serial | Title | Type | Status |
|--------|-------|------|--------|
| 0103 | [selfco gains a typed ontology layer, sequenced behind a change-impact index](adr/0103-selfco-ontology-program.md) | architecture (knowledge) | Accepted |
| 0105 | [The vault schema is one machine-readable file; prose documents cite it, never restate it](adr/0105-vault-schema-as-data.md) | architecture (knowledge) | Accepted |

### Proposed (unnumbered)

Drafts carry `serial: draft`; a number is assigned at `/adr accept` and never before (ADR-0087).

| Slug | Title | Type | Status |
|------|-------|------|--------|
| `bonded-pair-division-of-labor` | [Bonded-pair division of labor (ojfbot ⊕ selfco)](adr/draft-bonded-pair-division-of-labor.md) | architecture | Proposed |
| `catalog-scoped-user-skills` | [Catalog-scoped user skills — `install --user-scope` is data-driven, not a hardcoded list](adr/draft-catalog-scoped-user-skills.md) | tooling | Proposed |
| `dispatch-queue-and-day-runner` | [Dispatch queue + day-runner — the cockpit stages intents; a headless runner delivers slices](adr/draft-dispatch-queue-and-day-runner.md) | architecture | Proposed |
| `duplex-work-item-sync` | [(draft): Duplex work-item sync — beads canonical, GitHub issues mirrored, safe under full-duplex concurrency](adr/draft-duplex-work-item-sync.md) | architecture | Proposed |
| `envisioned-capability-marker` | [Envisioned-capability marker — distributed marker, maturity ladder, and reference lint](adr/draft-envisioned-capability-marker.md) | convention | Proposed |
| `harness-loop-instrumentation` | [Loop harnesses ride the OPAV spine; automation is gated on triggers, invocation is not](adr/draft-harness-loop-instrumentation.md) | architecture | Proposed |
| `headless-components-with-design-language-adapters` | [Headless components with design-language adapters](adr/draft-headless-components-with-design-language-adapters.md) | architecture | Proposed |
| `installed-harness-is-tracked` | [The installed agent harness is tracked, not gitignored](adr/draft-installed-harness-is-tracked.md) | convention | Proposed |
| `operating-surface-tiered-composition` | [Operating surface with tiered composition](adr/draft-operating-surface-tiered-composition.md) | architecture | Proposed |
| `progressive-autonomy-gates` | [Progressive autonomy gates — branch+PR today, data-gated promotion toward auto-merge](adr/draft-progressive-autonomy-gates.md) | convention | Proposed |
| `repo-scoped-skill-relevance` | [(draft): Repo-scoped skill relevance — per-repo `applies_to`/`kind` so the repo installer + suggester filter](adr/draft-repo-scoped-skill-relevance.md) | process | Proposed |
| `roadmap-under-northstar` | [Roadmap under northstar — file-canonical delivery decomposition with a compiled dispatch projection](adr/draft-roadmap-under-northstar.md) | convention | Proposed |
| `session-provenance-hardening` | [Session-provenance hardening — evidence-tiered pickup over a no-join-key bead reconciliation](adr/draft-session-provenance-hardening.md) | convention | Proposed |
| `three-tier-northstar` | [Three-tier northstar — distributed per-app vision tracking that ladders to a shared apex](adr/draft-three-tier-northstar.md) | convention | Proposed |

<details>
<summary>By-serial appendix (ordinal scan)</summary>

- 0001 — [Module Federation over iframes for shell composition](adr/0001-module-federation-not-iframes.md) · Accepted
- 0002 — [Single LLM gateway (frame-agent) for all sub-apps](adr/0002-single-llm-gateway.md) · Accepted
- 0003 — [Skill directories over flat command files](adr/0003-skill-directories-over-flat-files.md) · Superseded by ADR-0021
- 0004 — [pnpm workspaces as the package manager for all monorepos](adr/0004-pnpm-workspaces.md) · Accepted
- 0005 — [IBM Carbon Design System for sub-app UI components](adr/0005-carbon-design-system.md) · Accepted
- 0006 — [GraphQL Federation for Frame OS domain data layer](adr/0006-graphql-federation-domain-data-layer.md) · Proposed
- 0007 — [GET /api/tools capability manifest contract for all Frame sub-apps](adr/0007-get-api-tools-capability-manifest.md) · Accepted
- 0008 — [0008-shell-agent-routing-protocol.md](adr/0008-shell-agent-routing-protocol.md) · Accepted
- 0009 — [— Dual-Mode App Architecture](adr/0009-dual-mode-app-architecture.md) · Accepted
- 0010 — [— CoreReader Metadata Dashboard](adr/0010-corereader-metadata-dashboard.md) · Proposed
- 0011 — [Settings Modal Chrome Ownership and ErrorBoundary Reset Contract](adr/0011-settings-modal-chrome-ownership.md) · Accepted
- 0012 — [Module Federation Remote Integration Pattern](adr/0012-module-federation-remote-integration-pattern.md) · Accepted
- 0013 — [Safe Demo Deployment — Frame OS at frame.jim.software](adr/0013-safe-demo-deployment.md) · Accepted
- 0014 — [Layered Deployment Architecture](adr/0014-layered-deployment-architecture.md) · Accepted
- 0015 — [Gas Town + Paperclip + Wasteland as the multi-agent coordination layer](adr/0015-gas-town-paperclip-wasteland-adoption.md) · Accepted
- 0016 — [FrameBead — foundational work primitive for Frame Gas Town adoption](adr/0016-framebead-work-primitive.md) · Proposed
- 0017 — [Store-level singleton enforcement for single-context app types](adr/0017-singleton-enforcement-store-level.md) · Proposed
- 0018 — [Separate cv-builder repo slug from Resume Builder display name](adr/0018-cv-builder-slug-resume-builder-display-name.md) · Accepted
- 0019 — [Isolated context windows per domain agent — synthesis at output layer only](adr/0019-isolated-synthesis-context-windows.md) · Accepted
- 0020 — [No Redux store imports inside @ojfbot/shell packages/ui components](adr/0020-shell-ui-package-no-redux-imports.md) · Accepted
- 0021 — [Rename .claude/commands/ → .claude/skills/](adr/0021-skills-directory-rename-from-commands.md) · Accepted
- 0022 — [Per-instance Redux slice namespacing for multi-instance spawning](adr/0022-per-instance-redux-slice-namespacing.md) · Accepted
- 0023 — [NL instance spawning via ShellAgent, not a sidebar affordance](adr/0023-nl-spawning-via-shell-agent-not-sidebar.md) · Accepted
- 0024 — [G3 Approval Queue as security primitive, not a permission dialog](adr/0024-g3-approval-queue-as-security-primitive.md) · Accepted
- 0025 — [Gas Town execution + governance primitives in @core/workflows before shell/cv-builder adoption](adr/0025-gas-town-primitives-in-core-workflows-before-adoption.md) · Accepted
- 0026 — [CoreReader write-capability deferred to Phase 5, not Phase 1](adr/0026-corereader-write-capability-deferred-to-phase-5.md) · Accepted
- 0027 — [GasTownPilot as first direct @core/workflows consumer sub-app](adr/0027-gastown-pilot-direct-core-workflows-consumer.md) · Accepted
- 0028 — [React Query for server state in GasTownPilot](adr/0028-react-query-for-gastown-pilot-server-state.md) · Accepted
- 0029 — [Prop-only boundary for @ojfbot/shell UI components](adr/0029-shell-prop-only-ui-boundary.md) · Accepted
- 0030 — [Shared Frame UI Components Library](adr/0030-shared-frame-ui-components-library.md) · Accepted
- 0032 — [Daily-Logger React + Vercel Migration](adr/0032-daily-logger-react-vercel-migration.md) · Accepted
- 0033 — [Daily-Cleaner Confidence Threshold Policy](adr/0033-daily-cleaner-confidence-threshold-policy.md) · Proposed
- 0034 — [Isolated Redux stores with pub/sub message-passing boundary](adr/0034-frame-wide-redux-store-strategy.md) · Proposed
- 0035 — [Daily-cleaner inference budget cap](adr/0035-daily-cleaner-inference-budget-cap.md) · Proposed
- 0036 — [Lock-File Rebuild Protocol](adr/0036-lock-file-rebuild-protocol.md) · Accepted
- 0037 — [Skill telemetry, intent matching, and PR audit](adr/0037-skill-telemetry-and-intent-matching.md) · Accepted
- 0038 — [Morning Workflow Progressive Agent Orchestration](adr/0038-morning-workflow-orchestration.md) · Accepted
- 0039 — [Dolt as BeadStore backend](adr/0039-dolt-bead-store.md) · Accepted
- 0040 — [Claude session beads for meta-coordination](adr/0040-session-beads-meta-coordination.md) · Accepted
- 0041 — [Convoy orchestration via bead-emit.mjs](adr/0041-convoy-orchestration.md) · Accepted
- 0042 — [Two-tier session initializer](adr/0042-session-initializer.md) · Accepted
- 0043 — [AgentBead Bridge](adr/0043-agent-bead-bridge.md) · Accepted
- 0044 — [Ubiquitous language layer (CONTEXT.md + GLOSSARY.md)](adr/0044-ubiquitous-language-layer.md) · Accepted
- 0045 — [Skill /grill-with-docs for pre-planning Socratic alignment](adr/0045-grill-with-docs-skill.md) · Accepted
- 0046 — [Skill /tdd for red-green-refactor enforcement](adr/0046-tdd-skill.md) · Accepted
- 0047 — [Skill /deepen for Ousterhout-style module depth audits](adr/0047-deepen-skill.md) · Accepted
- 0048 — [Skill /triage and the severity/effort/domain/type rubric](adr/0048-triage-skill.md) · Accepted
- 0049 — [Pocock-style mode extensions on /plan-feature and /orchestrate](adr/0049-pocock-mode-extensions.md) · Accepted
- 0050 — [Skill metrics measurement system](adr/0050-skill-metrics-system.md) · Accepted
- 0051 — [RigProfile + workbench partition by profile](adr/0051-rigprofile-workbench-partition.md) · Proposed
- 0052 — [Bead prefix reservations for non-Frame rigs](adr/0052-bead-prefix-reservations-non-frame.md) · Proposed
- 0053 — [Bead-aware /frame-standup; informal-bead spine until A1 FrameBead is blocked](adr/0053-bead-aware-frame-standup-defer-a1.md) · Proposed
- 0054 — [Standup funnel measurement (suggestion → closure)](adr/0054-standup-funnel-measurement.md) · Proposed
- 0055 — [User-scope baseline for Pocock skills + principles](adr/0055-user-scope-baseline.md) · Proposed
- 0056 — [Developer Day Orchestration — Master](adr/0056-developer-day-orchestration-master.md) · Accepted
- 0057 — [Launcher mechanism under core/scripts/launcher](adr/0057-launcher-mechanism-core-scripts-launcher.md) · Accepted
- 0058 — [Sub-app registration schema](adr/0058-sub-app-registration-schema.md) · Accepted
- 0059 — [tmux topology and visual status language](adr/0059-tmux-topology-and-visual-status-language.md) · Accepted
- 0060 — [Dual Claude session model](adr/0060-dual-claude-session-model.md) · Accepted
- 0061 — [gastown-pilot Intake tab](adr/0061-gastown-pilot-intake-tab.md) · Proposed
- 0062 — [Reserved FrameBead label keys](adr/0062-reserved-framebead-label-keys.md) · Proposed
- 0063 — [daily-logger perRig digest extension](adr/0063-daily-logger-perrig-digest-extension.md) · Proposed
- 0064 — [Hammerspoon workspace orchestration](adr/0064-hammerspoon-workspace-orchestration.md) · Superseded by [workstation-yuri/ADR-0001](../../../workstation-yuri/decisions/adr/0001-workstation-orchestration.md) (2026-05-16)
- 0065 — [Zero-point and provenance convention](adr/0065-zero-point-and-provenance-convention.md) · Accepted
- 0066 — [Always-green CI policy](adr/0066-always-green-ci-policy.md) · Proposed
- 0067 — [Shared GitHub Actions repo (`ojfbot/github-actions`)](adr/0067-shared-github-actions-repo.md) · Accepted
- 0068 — [Agent must follow skill suggestions](adr/0068-follow-skill-suggestions.md) · Accepted
- 0069 — [Cross-link asset-foundry's dual Blender transport contract for fleet visibility](adr/0069-asset-foundry-blender-transport-cross-link.md) · Accepted
- 0070 — [Reaching the selfco vault from the Claude apps — GitHub mirror + connector now, locally-hosted obsidian-mcp later](adr/0070-vault-multi-surface-access.md) · Accepted
- 0073 — [selfco ingest removes the `draft` gate — the box files all non-terminal Inbox rows](adr/0073-selfco-ingest-removes-draft-gate.md) · Proposed
- 0079 — [Vault page-lifecycle policy — promoter-side ingest gate + graph-aware staleness signal](adr/0079-vault-page-lifecycle-policy.md) · Proposed
- 0080 — [Vault staleness scanner — graph-aware signal, surface-only, layered on `/vault lint`](adr/0080-vault-staleness-scanner.md) · Proposed
- 0081 — [CLAUDE.md loading-discipline routing (rules/ as Layer 1)](adr/0081-path-scoped-rules-dir-adoption.md) · Proposed
- 0082 — [Subagent strategy — default to skills + native delegation; `.claude/agents/` deferred](adr/0082-subagent-strategy.md) · Accepted
- 0083 — [Adopt Pocock-style skill conventions; add /prototype, /caveman, /zoom-out, and the writing pipeline](adr/0083-pocock-skill-conventions-and-new-skills.md) · Accepted
- 0084 — [SKILL.md is the canonical skill body filename (fleet-wide Skill-tool callability)](adr/0084-skill-md-canonical-filename.md) · Accepted
- 0085 — [The `selfco` LLM Wiki and the `/vault` skill](adr/0085-selfco-vault-and-skill.md) · Accepted
- 0086 — [Control-Gated Slices — how we decompose and ship large agentic-harness work](adr/0086-control-gated-slices.md) · Accepted
- 0087 — [Stable-identity + facet-tag ADRs — NASA Configuration Management applied to decision records](adr/0087-stable-identity-and-facet-tags.md) · Accepted
- 0088 — [Obsidian Bases as the vault's dynamic browsing layer](adr/0088-obsidian-bases-views.md) · Accepted
- 0089 — [Promote vault lint from shadow mode to a commit gate](adr/0089-lint-shadow-to-gate.md) · Accepted
- 0090 — [defuddle as a reversible, shadow-mode ingest trial](adr/0090-defuddle-ingest-fetch.md) · Accepted
- 0091 — [Semantic link-suggester for cultivate](adr/0091-semantic-link-suggester.md) · Accepted
- 0093 — [Suggestion identity + denominator repair — the keystone for any skill-loop metric](adr/0093-suggestion-identity-and-denominator.md) · Accepted
- 0094 — [Deliverable-tracking spine — gate-transition ledger → vault canvas projection (hook-audited)](adr/0094-deliverable-tracking-spine.md) · Accepted
- 0095 — [Skill-action instrumentation — a two-source, honesty-contracted `skill:acted` signal](adr/0095-skill-action-instrumentation.md) · Accepted
- 0096 — [Skill architecture taxonomy and recurring audit](adr/0096-skill-architecture-taxonomy.md) · Accepted
- 0097 — [Wrap, absorb, or reject — integrating a mature external harness into an opinionated stack](adr/0097-wrap-absorb-reject.md) · Accepted
- 0098 — [Two-track skill telemetry: the use-funnel and the evolution stream never blend](adr/0098-two-track-skill-telemetry.md) · Accepted
- 0099 — [Harden the two-axis review — fixed-point pinning, parallel axes, Fowler smell baseline](adr/0099-two-axis-review-hardening.md) · Accepted
- 0100 — [Absorb Pocock v1.1 lifecycle semantics into the existing mode surfaces](adr/0100-pocock-lifecycle-absorption.md) · Accepted
- 0101 — [/wayfinder — file-canonical decision maps upstream of the roadmap spine](adr/0101-wayfinder-decision-maps.md) · Accepted
- 0102 — [OJF-OPL — a git-native Object-Process Methodology profile as the fleet's inspectability layer](adr/0102-opm-inspectability-layer.md) · Accepted
- 0103 — [selfco gains a typed ontology layer, sequenced behind a change-impact index](adr/0103-selfco-ontology-program.md) · Accepted
- 0104 — [Behavioral misreports get their own ledger, and only an independent sweep may close one](adr/0104-defect-ledger-and-closure-loop.md) · Accepted
- 0105 — [The vault schema is one machine-readable file; prose documents cite it, never restate it](adr/0105-vault-schema-as-data.md) · Accepted
- 0106 — [l1-core earns an operator-competence property (P5), teach loop as instrument](adr/0106-l1-core-operator-competence-property.md) · Accepted

</details>

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

