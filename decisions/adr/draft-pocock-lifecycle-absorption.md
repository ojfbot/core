# ADR: Absorb Pocock v1.1 lifecycle semantics into the existing mode surfaces
slug: pocock-lifecycle-absorption
serial: draft
rev:
Date: 2026-07-22
Status: Proposed
domain: workflow-engine
type: tooling
OKR: —
Commands affected: /plan-feature (--from-conversation upgraded), /orchestrate (--emit=github-issues upgraded, L3 brief), /day-run (brief template), /prototype (disposition), /triage (ready-for-agent gate)
Repos affected: core (skills + knowledge files); siblings receive via install-agents.sh
gate:
baseline:
traces:
  supersedes: [pocock-mode-extensions]
  amends: [pocock-skill-conventions-and-new-skills]
  relates-to: [wrap-absorb-reject, tdd-skill, control-gated-slices]
  parent:
  part-of-series:

---

## Context

`adr:pocock-mode-extensions` (0049) mapped Pocock's v1.0-era `/to-prd` and `/to-issues` onto mode
flags — `/plan-feature --from-conversation` and `/orchestrate --emit=github-issues` — to avoid
catalog dilution. Upstream v1.1 (pinned `ed37663`; verdicts in
`decisions/adopt-stack/pocock-skills-v1-1.md`, rows D3–D7, D14) renames these to `to-spec` /
`to-tickets` and substantially deepens the semantics: seam-first spec confirmation, no-paths/no-code
spec bodies, tracer-bullet ticket slicing with tracker-native blocking edges and frontier work order,
expand–contract sequencing for wide refactors, and a minimal per-ticket `implement` execution
contract. The local mode flags carry none of that depth.

**Supersession scope:** this ADR supersedes 0049's *content* (what the modes do). Its *rationale* —
mode flags over new skills, anti-catalog-dilution — survives intact and is applied again here: the
richer semantics land on the same two mode surfaces, and upstream's standalone `implement` skill is
deliberately NOT adopted as a skill.

## Decision

1. **`/plan-feature --from-conversation` gains to-spec semantics.** Synthesize the spec from the
   preceding conversation without re-interviewing; sketch the test seams and confirm them with the
   user BEFORE writing (fewest seams, highest level, ideal count = one); spec template gains a long
   numbered user-story list, Implementation Decisions and Testing Decisions sections, and an Out of
   Scope section; spec bodies contain no file paths and no code snippets (exception: decision-rich
   prototype snippets). Auto-`ready-for-agent` labeling is rejected — emitted work items get the
   label only when they pass `/triage`'s machine-checkable bar, else `needs-triage`.
2. **`/orchestrate --emit=github-issues` gains to-tickets semantics.** Every emitted slice is a
   tracer bullet: a complete path through every relevant layer, demoable alone, sized to one fresh
   context window. Slices declare blocking edges using the tracker's native dependency relationship
   so the frontier (open + unblocked + unclaimed) renders in the tracker. Wide refactors are
   sequenced expand–contract (expand beside old → migrate in blast-radius-sized batches → contract),
   CI green batch to batch. Before publishing, quiz the user on granularity / edges / merge-split.
   `knowledge/vertical-slice-issue-template.md` is updated accordingly.
3. **The `implement` contract is absorbed into briefs, not a skill.** Orchestrate Layer-3 briefs and
   the `/day-run` slice brief gain the per-ticket contract: fresh context per ticket → `/tdd` at the
   pre-agreed seams → typecheck regularly → full suite once at the end → review → commit to the
   working branch.
4. **`.scratch/` local tracking is rejected.** Local-mode decomposition routes to the existing
   surfaces — roadmap files (`decisions/northstar/`) or GitHub issues — never a new file convention.
5. **`/prototype` gains a third disposition** (amending `adr:pocock-skill-conventions-and-new-skills`):
   "kept on a throwaway branch as a primary source, with a context pointer on the driving issue."
   Delete-after-verdict remains the default.

## Consequences

### Gains
- The spec→tickets→implement path gets v1.1's sharpest ideas (seam-first confirmation, tracer
  bullets, frontier, expand–contract) without new catalog entries or new work-item surfaces.
- Seam confirmation at spec time feeds `/tdd`'s pre-agreed-seams rule (`adr:tdd-skill` rev A) — one
  conversation, two consumers.
- Blocking-edge emission makes `/day-run` dispatch order derivable from the tracker instead of
  roadmap-file order alone.

### Costs
- The two mode flags get denser; their SKILL.md "Modes" sections grow. Mitigated by pushing detail
  into knowledge files.
- Seam confirmation adds an interaction before spec writing — deliberate (it is where wrong tests
  get prevented), but it slows the fast path.
- Divergence from upstream naming (`/to-spec`, `/to-tickets` don't exist here) is permanent; the
  collision map in the adopt-stack record is the translation table.

### Neutral
- Upstream's `ready-for-agent` label is kept as vocabulary but gated locally by `/triage`.
- `implement`-as-brief means no telemetry row for an "implement skill"; execution provenance stays
  with the dispatching surface (orchestrate / day-run), which is where OPAV already looks.

## Alternatives considered

| Alternative | Why rejected |
|-------------|--------------|
| Adopt `/to-spec` + `/to-tickets` + `/implement` as standalone skills (upstream naming) | Re-litigates 0049's settled anti-dilution rationale; three near-duplicate catalog entries whose behavior differs from existing surfaces only in depth, not kind. |
| Adopt `.scratch/` for local-mode tickets | A fourth work-item surface fragments provenance across beads, roadmaps, and GH issues; nothing `.scratch/` does isn't covered by roadmap files or issues. |
| Auto-apply `ready-for-agent` at emit time (upstream behavior) | Bypasses the machine-checkable acceptance bar day-run autonomy gates depend on. |
| Skip the seam-first confirmation (keep current --from-conversation flow) | Loses v1.1's highest-leverage idea; seams decided late arrive after the tests are already awkward. |

## Provenance

| Field | Value |
| --- | --- |
| Zero-point | 2026-07-22 (adopt-stack record `pocock-skills-v1-1.md`) |
| Implementation start | _pending_ |
| Implementation end | _pending_ |
