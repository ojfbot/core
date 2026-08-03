# Extended skill audit — 2026-08-03

Full-fleet audit: deterministic D1–D7 + shadow D8–D11 (script) + judgment J1–J8 on **all 68 skills** (7 subagent batches, evidence-quoted).
Rubric: `.claude/skills/skill-audit/knowledge/architecture-rubric.md` as extended by `decisions/adopt-stack/pocock-writing-great-skills.md` (D26–D36).
Machine copy: `2026-08-03-extended-audit.json`. Extended verdicts fold J findings in; the *deterministic* verdict baseline (39/27/2) stays comparable to prior jsonl lines.

## Baselines (the measurable axes)

- Deterministic verdicts: **39 Aligned / 27 Needs work / 2 Refactor**
- Extended verdicts (J folded in): **14 Aligned / 47 Needs work / 7 Refactor**
- Sprawl (body ≥ 800w): **30/68** · total body words: **69464** · description words (context load): **4349** · negations: **518** · dup-line skills: **3**

| J signal | Aligned | Partial | Gap |
|---|---:|---:|---:|
| J1 | 62 | 6 | 0 |
| J2 | 66 | 0 | 2 |
| J3 | 58 | 9 | 1 |
| J4 | 60 | 6 | 2 |
| J5 | 59 | 9 | 0 |
| J6 | 53 | 4 | 11 |
| J7 | 57 | 11 | 0 |
| J8 | 57 | 7 | 4 |

Fix classes: none: 32 · disclose: 14 · prune: 11 · add-criteria: 6 · split: 4 · rewrite-description: 1

## Per-skill scorecard

| Skill | D fails | Words | J Partial | J Gap | Fix | Extended verdict |
|---|---|---:|---|---|---|---|
| `adopt-stack` | — | 1028 ⚠ | — | — | none | Aligned |
| `adr` | — | 972 ⚠ | — | — | none | Aligned |
| `agent-debug` | — | 607 | — | — | none | Aligned |
| `bead` | D4 | 1084 ⚠ | J8 | — | disclose | Needs work |
| `blind-sweep` | D4 | 1834 ⚠ | — | — | none | Needs work |
| `caveman` | D4 | 416 | — | — | none | Needs work |
| `claude-md-audit` | D4 | 1372 ⚠ | — | — | none | Needs work |
| `claude-md-rollout` | D4 | 612 | J3 | — | none | Needs work |
| `council-review` | — | 787 | — | — | none | Aligned |
| `daily-logger` | — | 472 | J6 | — | prune | Needs work |
| `day-run` | D4,D5 | 422 | — | — | none | Needs work |
| `deepen` | — | 1332 ⚠ | — | J6 | prune | Needs work |
| `deploy` | — | 605 | J7 | J6,J8 | disclose | Refactor candidate |
| `diagram` | D4 | 719 | — | — | none | Needs work |
| `diagram-intake` | — | 1005 ⚠ | J8 | — | add-criteria | Needs work |
| `doc-refactor` | — | 498 | J7 | J6,J8 | disclose | Refactor candidate |
| `extension-audit` | — | 614 | — | — | none | Aligned |
| `fleet-onboard` | D2,D4 | 764 | — | — | none | Needs work |
| `frame-dev` | D4,D5 | 526 | — | — | none | Needs work |
| `frame-standup` | D7 | 3193 ⚠ | J6 | J4,J8 | split | Refactor candidate |
| `gastown` | — | 1330 ⚠ | J3 | J4 | split | Refactor candidate |
| `gated-slice` | — | 1875 ⚠ | — | — | none | Aligned |
| `git-guardrails` | D4 | 781 | — | — | none | Needs work |
| `grill-with-docs` | — | 2290 ⚠ | J5 | — | prune | Needs work |
| `handoff` | — | 553 | J5,J7,J8 | — | add-criteria | Needs work |
| `hardening` | — | 536 | — | — | none | Aligned |
| `init` | D4,D5 | 764 | — | J6 | rewrite-description | Needs work |
| `investigate` | — | 914 ⚠ | — | — | none | Aligned |
| `lint-audit` | D4 | 769 | — | J6 | disclose | Needs work |
| `merge-quiz` | D4 | 3029 ⚠ | J3,J4 | — | split | Refactor candidate |
| `observe` | — | 569 | — | — | none | Aligned |
| `opm` | D3,D4 | 548 | J4 | J2 | disclose | Needs work |
| `orchestrate` | — | 2762 ⚠ | J4 | J3 | split | Refactor candidate |
| `plan-feature` | — | 1335 ⚠ | — | — | none | Aligned |
| `pr-review` | — | 1299 ⚠ | J8 | J6 | disclose | Needs work |
| `prototype` | D4 | 1006 ⚠ | — | — | none | Needs work |
| `push-all` | — | 546 | J1,J5 | — | prune | Needs work |
| `rag-audit` | — | 571 | J8 | J6 | disclose | Needs work |
| `recon` | D4 | 499 | J1,J5,J7 | — | prune | Needs work |
| `resume` | D3,D4 | 831 ⚠ | — | J2 | disclose | Needs work |
| `resume-audit` | — | 1277 ⚠ | J3 | — | none | Needs work |
| `roadmap` | D4 | 626 | J1,J5,J7 | — | add-criteria | Needs work |
| `scaffold` | — | 565 | J7 | — | add-criteria | Needs work |
| `scaffold-app` | D4 | 1043 ⚠ | J4 | — | disclose | Needs work |
| `scaffold-frame-app` | D5 | 1448 ⚠ | J3,J6 | — | prune | Needs work |
| `screenshot-audit` | — | 581 | J7 | — | add-criteria | Needs work |
| `selfco-ingest` | D4 | 2857 ⚠ | J1,J4,J5,J8 | — | disclose | Needs work |
| `setup-ci-cd` | — | 544 | J1,J5,J7 | — | prune | Needs work |
| `skill-audit` | — | 780 | — | — | none | Aligned |
| `skill-create` | — | 1140 ⚠ | — | — | none | Aligned |
| `skill-loader` | — | 684 | J5,J7 | J8 | disclose | Needs work |
| `skill-metrics` | — | 1035 ⚠ | — | — | none | Aligned |
| `spec-review` | D4 | 1331 ⚠ | J3 | — | none | Needs work |
| `speculative-pass` | D4 | 2403 ⚠ | J3 | — | none | Needs work |
| `summarize` | — | 321 | J1,J5,J7 | — | prune | Needs work |
| `sweep` | — | 520 | — | — | none | Aligned |
| `tdd` | — | 1623 ⚠ | — | J6 | prune | Needs work |
| `techdebt` | — | 649 | — | J6 | disclose | Needs work |
| `test-expand` | — | 610 | J7 | — | add-criteria | Needs work |
| `triage` | — | 1489 ⚠ | J3 | J6 | disclose | Needs work |
| `validate` | — | 1192 ⚠ | J4 | — | none | Needs work |
| `vault` | D7 | 399 | — | — | none | Refactor candidate |
| `wayfinder` | — | 1251 ⚠ | J3,J8 | — | disclose | Needs work |
| `workbench` | — | 764 | J6 | — | prune | Needs work |
| `writing-beats` | D4 | 718 | — | — | none | Needs work |
| `writing-fragments` | D4 | 662 | — | J6 | prune | Needs work |
| `writing-shape` | D4 | 744 | — | — | none | Needs work |
| `zoom-out` | D4 | 539 | — | — | none | Needs work |

## Findings by fix class (evidence-quoted)

### disclose (14)

- **`bead`** — references/bead-schemas.md is load-bearing for correct frontmatter but only appears in a passive file listing, never a 'load before filling template' directive. (J8: “references/bead-schemas.md — frontmatter schema per bead type”)
- **`deploy`** — Step 3's entire content (blast-radius framework) is missing — knowledge/ only has preflight-checklist.md and rollback-guide.md. (J6: “load `knowledge/blast-radius-guide.md`” · J7: “What metrics, logs, or error rates to watch for the first 30 minutes post-deploy.” · J8: “load `knowledge/blast-radius-guide.md`”)
- **`doc-refactor`** — Step 4 depends on a knowledge file that doesn't exist — knowledge/ only has docs-structure.md and readme-template.md. (J6: “Load `knowledge/mermaid-templates.md` for common Mermaid patterns” · J7: “what stubs were created, and what still needs a human to fill in” · J8: “Load `knowledge/mermaid-templates.md` for common Mermaid patterns”)
- **`lint-audit`** — Pinned plugin version and hardcoded TD-002/TD-003/TD-004 mappings baked into SKILL.md are stale-risk; push to knowledge/ or derive live. (J6: “@frame/eslint-plugin v2.0.0 (8 rules)”)
- **`opm`** — No Gotchas section at all, and the four modes (author/render/lint/query) touch distinct skill categories. (J2: “## Boundaries” · J4: “Four modes: model (author or update the .opl from repo reality”)
- **`pr-review`** — knowledge/framework-checks.md is referenced twice but doesn't exist — a dead pointer that silently drops framework-specific checks. (J6: “Load `knowledge/framework-checks.md` if the PR touches LangGraph, RAG pipeline” · J8: “if the PR touches LangGraph, RAG pipeline, browser extension, or Carbon components”)
- **`rag-audit`** — knowledge/migration-paths.md referenced but does not exist (only rag-invariants.md present), so migration guidance silently never loads. (J6: “Load `knowledge/migration-paths.md` if the current store needs to be upgraded” · J8: “Load `knowledge/migration-paths.md` if the current store needs to be upgraded”)
- **`resume`** — Excellent anti-confabulation design but no ## Gotchas section despite carrying real field lessons inline (e.g. the id-join trap). (J2: “## Dependencies”)
- **`scaffold-app`** — Step 7 bundles code-scaffolding with fleet-wide registration — flag straddle:true rather than split (bundling is intentional to prevent omission). (J4: “the new repo must be registered in fleet-wide systems”)
- **`selfco-ingest`** — Strong 500-1000-word completion floor, but fully inline with no knowledge/ dir; mixes generic style tips with tag-schema governance. (J1: “Active voice. No "it was argued that..."” · J4: “ALTER COLUMN "tags" SET MULTI_SELECT(” · J5: “Trust the developer audience — cultural shorthand is fine” · J8: “Wait for him to react before proceeding”)
- **`skill-loader`** — knowledge/flows.md (a genuinely useful lifecycle map) is never referenced anywhere in SKILL.md — an orphaned must-have file. (J5: “Less is more — install only what is needed.” · J7: “Produce the full catalog grouped by lifecycle phase.” · J8: “Load `knowledge/skill-catalog.json` for the full skill inventory”)
- **`techdebt`** — Well-designed meta-skill; its own knowledge/allowed-paths.md has drifted — the isAllowedPath() sample still says .claude/commands/ where the prose says .claude/skills/**. (J6: “/^\.claude\/commands\//,”)
- **`triage`** — Rigorous reproducible-triage skill; See Also links three nonexistent <skill>/<skill>.md files, same pattern as tdd. (J3: “Never deviates without explicit user override.” · J6: “../roadmap/roadmap.md — directional prioritization (this skill applies it to issues)”)
- **`wayfinder`** — The fleet-substrate.md mode table is must-have for full-mode detection but pointed to with a soft descriptive sentence rather than an imperative read directive. (J3: “No code, no deliverables, no ticket resolution during charting.” · J8: “The full mode table is in `knowledge/fleet-substrate.md`.”)

### split (4)

- **`frame-standup`** — 3300-word skill bundles content-audit, telemetry, queue-sweep/dispatch, and movement-recording; knowledge/northstar.md describes exactly how Steps 4.6/5 should use it but is never pointed to from SKILL.md. (J4: “Sweep dead leases, then post unassigned work to the queue” · J6: “How `/frame-standup` Step 4.6 + Step 5 use the three-tier northstar.” · J8: “How `/frame-standup` Step 4.6 + Step 5 use the three-tier northstar.”)
- **`gastown`** — Four modes span audit, scaffolding-planning, UI review, and cicd ops — a real straddle. (J3: “A1 before all else; G-series requires A1+A2; never skip steps.” · J4: “audit adoption progress, plan incremental work, review GasTownPilot UI implementations, and keep GitHub roadmap issues”)
- **`merge-quiz`** — 3100+ words with no knowledge/ disclosure; the vault-capture step is a distinct concern worth delegating to /vault. (J3: “No exceptions, and no "but I'll be careful."” · J4: “This appends to `~/selfco/wiki/log.md`, the vault's append-only ledger”)
- **`orchestrate`** — Mandatory jq-parsed bead/convoy bookkeeping at every step heavily railroads execution; also embeds a separate GitHub-issue-emission workflow. (J3: “Find the session bead ID (created by bead-session.sh when this skill was invoked)” · J4: “Modes — emit GitHub issues (Pocock /to-issues)”)

### prune (11)

- **`daily-logger`** — knowledge/architecture-brief.md heading says 'Four-phase pipeline' but the body lists a Phase 5 (API Build). (J6: “## Four-phase pipeline”)
- **`deepen`** — See Also points to <skill>/<skill>.md files (recon.md, sweep.md, techdebt.md) that don't exist — those dirs only contain SKILL.md. (J6: “`../recon/recon.md` — aerial-view orientation (run first)”)
- **`grill-with-docs`** — Excellent gate-style skill with hard confirmation stop-gate; Core Principle 1's opener is generic exhortation restated more concretely later. (J5: “Ask before you assume. Every silent assumption is a future bug”)
- **`push-all`** — Step 1's git-status/diff-staged sequence largely restates the git-commit workflow already mandated at the environment level. (J1: “Run `git status` and `git diff --staged`.” · J5: “Run `git status` and `git diff --staged`.”)
- **`recon`** — Steps 1-5 largely restate what a competent agent already does; the real differentiator (Notable observations) has no exhaustiveness bar. (J1: “Then survey: directory layout, key directories, package.json/pyproject.toml/etc.” · J5: “Then survey: directory layout, key directories, package.json/pyproject.toml/etc.” · J7: “Unusual patterns, tech debt hot-spots, security surface, missing tests, dead code”)
- **`scaffold-frame-app`** — Excellent checkable validation gate, but the JIT pointer claims a '30-item checklist' while Step 9 lists 28 — reconcile. (J3: “Write all files per app-templates.md langgraph-app template, with these mandatory patterns” · J6: “Load knowledge/validation-checklist.md for the full 30-item checklist”)
- **`setup-ci-cd`** — Sharp self-aware Gotchas; Core Principles/Constraints repeat generic conventions without process specificity. (J1: “Detect, don't assume — read the actual stack” · J5: “Respect existing conventions.” · J7: “What was created, what was skipped (already existed), manual steps needed”)
- **`summarize`** — Main body mostly restates default summarization instincts; the Gotchas section carries all the real signal. (J1: “Focus on: purpose, key responsibilities, important functions/types/interfaces, notable patterns” · J5: “If text is provided directly: summarize it.” · J7: “thorough breakdown covering all major types, functions, patterns, dependencies, and concerns”)
- **`tdd`** — Exemplary red-green-refactor skill; but three See Also links point at nonexistent <name>.md files — every sibling uses SKILL.md. (J6: “../test-expand/test-expand.md — coverage planning (lighter than /tdd)”)
- **`workbench`** — Tight launcher wrapper; one dangling reference to an in-progress migration whose status isn't verifiable from the file. (J6: “preserved on disk as a fallback during the migration”)
- **`writing-fragments`** — See Also references a /grill-me skill that does not exist in the library (the real skill is grill-with-docs). (J6: “`/grill-me` — if the topic itself needs sharpening before you mine for material.”)

### add-criteria (6)

- **`diagram-intake`** — Step 1's visual-parse is inherently fuzzy and has no explicit per-label confidence checkpoint before the crisp Steps 2-6. (J8: “state what you can read and ask the user to clarify specific items”)
- **`handoff`** — Step 1 ('read the code') has no checkable done-state; risk of a shallow skim before the fully-specified writing step. (J5: “Be specific, not generic.” · J7: “Understand entry points, data flows, and failure modes from the actual implementation.” · J8: “Understand entry points, data flows, and failure modes from the actual implementation.”)
- **`roadmap`** — Core Principles read as generic PM advice and the output format lacks a demanding completion bar. (J1: “Current state first — understand what exists before projecting forward” · J5: “Concrete over aspirational — short-term items must be actionable” · J7: “Default: structured markdown document.”)
- **`scaffold`** — Tight, well-scoped; only the final output-summary step lacks a checkable exhaustiveness bar. (J7: “Files created/modified, what still needs implementation, open questions”)
- **`screenshot-audit`** — Strong bias-correcting Gotchas; Step 2 never states an exhaustiveness requirement that every pair be classified. (J7: “Classify each change”)
- **`test-expand`** — Solid tests-only skill; the gap-mapping step never states a closing exhaustiveness bar before Propose. (J7: “Which branches are not covered? (if/else, switch, error paths, edge cases)”)

### rewrite-description (1)

- **`init`** — Step 3's hardcoded repo-to-architecture-file table lists only 8 repos while the fleet has ~45; unlisted repos get no context-loading guidance. (J6: “| purefoy | `domain-knowledge/purefoy-architecture.md` |”)

