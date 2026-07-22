---
id: 20260722-2104-brief-opm-inspectability-layer-review-accept-and-pilot
type: brief
title: "OPM inspectability layer — review, accept, and pilot"
actor: code-claude
to: code-claude
session_id: 2026-07-22T21:04:36Z
refs: []
hook: opm-adoption
status: live
created_at: 2026-07-22T21:04:36Z
labels:
  project: core
---

## Context

A 2026-07-22 remote session researched Object-Process Methodology (Dori, ISO/PAS 19450) and
landed a full first slice on branch `claude/object-process-modeling-research-6gw2sg` in **four
repos** (core, daily-logger, selfco, morning-cockpit — same branch name everywhere, all pushed,
working trees clean, no PRs opened). The bet: OJF-OPL — a git-native controlled-English profile
of OPM (one fact per line, `[src:]`-anchored, rendered to Mermaid) — as the fleet's
inspectability/tuning layer. Everything is descriptive and shadow-mode; nothing gates. Evidence
base and rationale are compiled in selfco (`wiki/sources/opm-deep-research.md`,
`wiki/synthesis/opm-as-ojfbot-inspectability-layer.md`). Key facts: LLMs generate/parse OPL via
in-context learning (arXiv:2502.09658); no open-source textual OPM tooling exists to conflict
with; MBSE literature warns benefits are usually perceived-not-measured, hence the shadow-first
rollout with a kill criterion.

## Goal

Drive the branch through review to acceptance, then start the pilot: get the core ADR draft
accepted (or amended), open PRs for the four branches, and run the first real `/opm lint` pass
in daily-logger so the pilot's drift-detection clock starts.

## Acceptance criteria

- [ ] Jim has reviewed the core ADR draft; `/adr accept` run (assigns serial) or revisions made
- [ ] PRs opened for all four repo branches (user request required first — do not open unasked)
- [ ] `/opm lint` executed against `daily-logger/opm/system.opl`; findings recorded (expect: clean or small; fix any real syntax/anchor errors it surfaces in the seed models)
- [ ] Pilot TPM registered somewhere durable (northstar/roadmap per current convention): "≥1 real drift caught OR 4 weeks model-accurate" before any gate/CI promotion
- [ ] selfco synthesis page updated if the ADR is revised (it names the rollout shape)

## References

- adr:opm-inspectability-layer — file:decisions/adr/draft-opm-inspectability-layer.md (core; rollout §, kill criterion)
- file:domain-knowledge/opm-modeling.md — the OJF-OPL v0.1 grammar, render rules, mapping table
- file:.claude/skills/opm/SKILL.md — modes model · render · lint · query
- file:opm/system.opl + file:opm/system.md — core seed model
- github:ojfbot/daily-logger — `decisions/adr/0039-opm-pipeline-model.md`, `opm/system.opl` (the pilot), CLAUDE.md "System model" section
- github:ojfbot/morning-cockpit — `decisions/adr/0015-system-map-pane-opm.md` (proposal only, NO code — respect the read-only carve-out)
- github:ojfbot/selfco — `raw/opm-object-process-methodology-research.md` (full cited report), wiki pages above, `wiki/log.md` [2026-07-22] entries
- Registration edits in core: `packages/workflows/src/registry.ts` (one line, **not typechecked** — node_modules absent in the authoring container; run `pnpm typecheck` first), `.claude/skills/skill-loader/knowledge/skill-catalog.json`, CLAUDE.md tables

## Flag back

- Whether to open PRs at all, and whether the 4 branches merge together or core-first — Jim's call.
- Any change to the agent/instrument semantics or sentence templates in opm-modeling.md — that
  vocabulary is now referenced from 4 repos; don't fork it unilaterally.
- Cockpit ADR-0015: do not start implementation without explicit go — it's Draft/Proposed and
  the repo forbids casual write-paths/new panes.
- If `/opm lint` design meets reality badly (e.g. the reality-probe pass is too fuzzy to be
  useful), flag rather than silently weakening the check.

## Constraints (optional)

- ADR-0087 identity rules in core: never self-assign serials; `/adr accept` renames the draft.
- selfco `wiki/log.md` is append-only — corrections are new entries (one correction entry from
  this session already demonstrates the pattern).
- pnpm everywhere; grill-before-coding posture applies to the pilot work.
- Shadow-mode is load-bearing: lint must not gate anything until the RIDM promotion in the ADR.
