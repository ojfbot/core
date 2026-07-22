# /adopt-stack decision: mattpocock/skills v1.1 (lifecycle refresh)

Decided 2026-07-22. Candidate pinned at main `ed37663` (2026-07-21; release v1.1.0 = 2026-07-08; MIT).
Why-layer: `adr:wrap-absorb-reject`. Implementing ADRs: `adr:pocock-lifecycle-absorption`,
`adr:wayfinder-decision-maps`, `adr:two-axis-review-hardening`; revisions to `adr:grill-with-docs-skill` (rev A),
`adr:tdd-skill` (rev A). Supersedes the verdict surface of `adr:pocock-mode-extensions` (content only — its
anti-catalog-dilution rationale survives and governs the calls below).

Prior engagement: the v1.0-era stack was reimplemented locally (ADRs 0045–0049, 0083); vendoring via
`npx skills add` was rejected in `adr:pocock-skill-conventions-and-new-skills` and is not reopened here.

## Gate 0 (script-measured): LIBRARY (0/6 application signals)

Candidate is a git repo of prompt files, not a published npm artifact, so `measure-pkg.mjs` (pnpm-view)
does not apply. Measured directly against the pinned tarball; commands + verbatim output:

| Signal | Measurement (command) |
|--------|------------------------|
| Version | `package.json` → `1.1.0`; `.claude-plugin/plugin.json` → `1.2.0` (main is past the release) |
| Total size | 900K (`du -sh`) |
| Runtime dependencies | **none** (`dependencies: None`; devDeps = changesets release tooling only) |
| Runtime code | **0** JS/TS files (`find -name '*.ts' -o -name '*.js'` → 0; the 1 `.cjs` is changeset config) |
| Content | 112 `.md` (41 `SKILL.md`), 41 `agents/openai.yaml` (Codex metadata), 5 `.sh` (symlink installers) |
| Telemetry/network SDKs | **0** (`grep -ril 'analytics|sentry|amplitude|posthog' skills/` → 0) |
| DB drivers / server / auth | none |
| Ships a bin/CLI | no (install via third-party `skills` CLI or Claude Code plugin, both external) |
| Application-shaped signals | **0/6** |

Consequence: there is no runtime to wrap. Every call below is **ABSORB** (re-express the opinion in
ojfbot primitives) or **REJECT** — WRAP does not arise.

## Decision table

Evidence paths are relative to the pinned tarball (`skills/…`). Host invariants cite the ADR/file that owns them.

| # | Opinion imposed | Call | Evidence → invariant |
|---|-----------------|------|----------------------|
| D1 | Grilling primitive: facts vs decisions ("if a fact can be found by exploring the environment, look it up rather than asking; the decisions are mine") + confirmation stop-gate before acting | **ABSORB** into `/grill-with-docs` | `skills/productivity/grilling/SKILL.md` → strengthens the grill posture (`domain-knowledge/agent-defaults.md`, `adr:grill-with-docs-skill`); fixes self-grilling when grilling runs inside another skill. |
| D2 | Wrapper-over-primitive skill architecture (7-line `grill-me`/`grill-with-docs` stubs delegating to `/grilling` + `/domain-modeling`) | **REJECT** | `skills/productivity/grill-me/SKILL.md` (6 lines) → local monolith already stages CONTEXT.md diffs + ADR stubs in-loop (`adr:grill-with-docs-skill`); restructuring is adoption-for-form. |
| D3 | to-spec: no-interview conversation synthesis; seam sketch confirmed with user BEFORE writing ("fewest seams, highest seam, ideal is one"); spec template (long user-story list, Implementation/Testing Decisions, Out of Scope); no file paths or code in specs | **ABSORB** into `/plan-feature --from-conversation` | `skills/engineering/to-spec/SKILL.md` → mode-flag surface preserved per `adr:pocock-mode-extensions` rationale; seam-first confirm feeds `/tdd` at pre-agreed seams (D8). |
| D4 | to-spec publishes with auto-applied `ready-for-agent` label | **REJECT** | same file, publish step → local `/triage` gates `ready-for-agent` on machine-checkable acceptance criteria; day-run autonomy gates depend on that bar (`adr:control-gated-slices`, day-run brief). |
| D5 | to-tickets: tracer-bullet vertical slices (complete path through every layer, demoable, one context window), tracker-native blocking edges, "work the frontier", expand–contract sequencing for wide refactors, quiz-the-user granularity check | **ABSORB** into `/orchestrate --emit=github-issues` | `skills/engineering/to-tickets/SKILL.md` → sharpens the existing vertical-slice discipline (`~/.claude/CLAUDE.md` vertical-slices rule, `orchestrate/knowledge/vertical-slice-issue-template.md`). |
| D6 | `.scratch/<feature>/issues/NN-slug.md` local file tracker | **REJECT** | same file, local-tracker fallback → ojfbot already has three sanctioned work-item surfaces (`.handoff/` beads, `decisions/northstar/` roadmaps, GitHub issues); a fourth fragments provenance (`adr:session-provenance-hardening` draft). Local-mode decomposition routes to roadmap files or GH issues. |
| D7 | implement: per-ticket execution contract (fresh context per ticket → /tdd at pre-agreed seams → typecheck regularly → full suite once at end → code-review → commit), shipped as a standalone skill | **ABSORB contract, REJECT the skill** | `skills/engineering/implement/SKILL.md` (~14 lines) → contract folds into orchestrate L3 briefs + day-run brief; a standalone skill dilutes the catalog (`adr:pocock-mode-extensions` rationale). |
| D8 | tdd: test only at pre-agreed seams (confirmed with user before any test); anti-patterns tautological tests + horizontal slicing (vs tracer bullets) | **ABSORB** into `/tdd` | `skills/engineering/tdd/SKILL.md`, `tests.md`, `mocking.md` → deepens `adr:tdd-skill` red-green discipline. |
| D9 | tdd: refactoring removed from the loop entirely ("belongs to the review stage") | **REJECT** | same file → keep local refactor-at-green (`adr:tdd-skill` rev A records the deliberate divergence); review-stage smell check ALSO adopted via D10, so both stages exist. |
| D10 | code-review: fixed-point pinning (three-dot merge-base diff, rev-parse preflight, empty-diff fail-fast); two parallel per-axis subagents (Standards / Spec) reported verbatim, never merged or reranked; fixed 12-smell Fowler baseline with "repo standards override" + "always a judgement call" rules | **ABSORB** into `/pr-review` + `/validate` | `skills/engineering/code-review/SKILL.md` → hardens the existing two-axis review (`adr:pocock-skill-conventions-and-new-skills` item 4); shared baseline lives once at `pr-review/knowledge/smell-baseline.md`. |
| D11 | wayfinder: map + typed decision tickets (research/grilling/prototype/task) with native blocking edges, frontier work order, one-ticket-per-session, claim-by-assignment, "plan don't do", no-fog early exit, hands off at spec stage | **ABSORB** as new `/wayfinder` skill | `skills/engineering/wayfinder/SKILL.md` → fills a real gap: pre-decision charting for foggy initiatives, upstream of `/gated-slice` (`adr:control-gated-slices`) and the roadmap spine (`adr:roadmap-under-northstar` draft). The one genuinely new capability in v1.1. |
| D12 | wayfinder: map body lives only in the issue tracker; research tickets fired as parallel subagents at chart time | **REJECT (both sub-opinions)** | same file → map is file-canonical at `decisions/wayfinder/<slug>.md` mirroring the roadmap file-canonical + projection pattern; research is SERIALIZED through the deep-research harness (sequential-research rule after the 2026-06-05 overnight batch failure) and filed to `decisions/research/`, not throwaway branches. |
| D13 | research: standalone background-research skill writing one cited md file per repo convention | **REJECT skill, note convention already held** | `skills/engineering/research/SKILL.md` → the deep-research workflow harness + `decisions/research/` convention already cover it with adversarial verification the upstream skill lacks. |
| D14 | prototype: capture the prototype as a primary source on a throwaway branch with a context pointer on the issue | **ABSORB** as a third disposition option in `/prototype` | `skills/engineering/prototype/SKILL.md` ("Capture it when done") → amends the delete-by-default disposition (`adr:pocock-skill-conventions-and-new-skills`); delete stays the default. |
| D15 | ask-matt: router skill as the discovery mechanism | **REJECT router, ABSORB the flow map** | `skills/engineering/ask-matt/SKILL.md` → suggest-skill hook + catalog triggers are the measured local answer (hook-forced eval 84–100% vs router ~80%, `decisions/research/2026-07-17-skill-loop-sota.md`); the lifecycle/on-ramp map lands as `skill-loader/knowledge/flows.md`. |
| D16 | setup-matt-pocock-skills: per-repo config indirection (`docs/agents/issue-tracker.md`, `triage-labels.md`, `domain.md`) | **REJECT** | `skills/engineering/setup-matt-pocock-skills/SKILL.md` → duplicates CLAUDE.md + `domain-knowledge/` conventions and `install-agents.sh` distribution. |
| D17 | handoff: compact-conversation handoff skill | **REJECT** | `skills/productivity/handoff/SKILL.md` → `/bead --compact` already owns this; name collision documented in both skill descriptions. |

## Integration shape

Zero upstream files enter the tree. Nine opinions are re-expressed in ojfbot primitives across five
existing skills (`grill-with-docs`, `tdd`, `pr-review`, `validate`, `prototype`), two mode surfaces
(`plan-feature --from-conversation`, `orchestrate --emit=github-issues`), two brief templates
(orchestrate L3, day-run), and one new skill (`/wayfinder`, file-canonical map variant). Eight opinions
rejected with recorded reasons. Upstream tracking remains the pinned-commit + research-note mechanism
(`decisions/research/2026-07-17-skill-loop-sota.md` + the 2026-07-22 reception report), not a sync.
