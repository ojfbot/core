# Phase-2 candidates (PARKED — not decisions, not part of the Phase-1 survey)

> Tensions/fixes spotted during the Phase-1 evidence survey (`core/SURVEY.md`). **Quarantined here on
> purpose** so the survey stays a clean current-state record. Nothing here is proposed or endorsed — it is
> raw material for Phase 2 (FTI/OTAV decomposition), to be evaluated against the evidence, not before it.
> Do NOT act on these during Phase 1.

## Coupling / brittleness observed
- Manual, dated mirror of queue-label/bead types between `core/packages/workflows/src/types/*` and
  `morning-cockpit/.../dolt-bead.ts` — drift undetected.
- Hardcoded core paths: `suggest-skill.sh` (`CORE_DIR`), `workstation-yuri/hammerspoon/launcher.lua`
  (`LAUNCHER_ROOT`), shell `/api/techdebt` (`$HOME/ojfbot/core/TECHDEBT.md`), morning-cockpit queue-claim path.
- Two-file skill-suggestion funnel join keyed on field-name agreement across two JSONL singletons.
- No-dependency northstar frontmatter parser (`northstar-fm.mjs`) supports only a YAML subset; the whole
  reference graph rides on it, untested.
- Unlocked concurrent appends to shared `~/.claude/*.jsonl` from many repos.

## Fusion / single-responsibility tension observed
- `install-agents.sh`, `bead-emit.mjs` (19 verbs), `session-init.sh`, `_lib.sh`, `northstar/README.md`
  (doc + machine registry) each carry multiple reasons-to-change.

## Seam convergence candidates
- The leg-5 "authorizing shell / executing core launcher" division has no code; pursuing it would be
  net-new (auth boundary + shell→launcher routing channel + reconciling the two meanings of "spawn").
- `/api/beads` + `bead-emit` share a raw Dolt table while `read-model-contract` SDL sits unused — a
  candidate convergence point.
- `/api/techdebt` cross-seam write to a convention path — candidate for an explicit contract.

## Staleness / dedup candidates
- `packages/cli` + `packages/vscode-extension` dormant since Feb while advertised as the engine.
- Duplicate `reconcile-skill-acted.mjs` wired from both `core` and `core-tracking` globally.
- Root `skills/` vestigial; `decisions/okr/` superseded by northstar.
- `mysql2` declared in both root and workflows package.json.

## When Phase 2 starts
Pull the canonical **OTAV** (Observe/Test/Act/Verify) and **FTI** (Feature/Training/Inference) definitions
from James's selfco vault before cutting any planes. Apply them to `core/SURVEY.md`, not to this list.
