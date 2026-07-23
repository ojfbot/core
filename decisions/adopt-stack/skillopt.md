# /adopt-stack decision: Microsoft `skillopt` (+ `skillopt_sleep` + Claude Code plugin)

Decided 2026-07-23. Why-layer: `adr:wrap-absorb-reject`.
Companion deep study: `decisions/research/2026-07-23-skillopt-vs-skill-loop.md`.
Candidate examined read-only at a scratchpad clone of <https://github.com/microsoft/skillopt> (v0.2.0 era, MIT).

## Gate 0 (script-measured): LIBRARY-weight distribution, cross-language (1/6 application signals)

`measure-pkg.mjs skillopt`, verbatim (the script correctly failed closed — SkillOpt is PyPI, not npm):

```
measure-pkg: registry lookup failed for "skillopt". No data — do NOT fabricate numbers.
Command failed: pnpm view skillopt version --json
npm error code E404
npm error 404 Not Found - GET https://registry.npmjs.org/skillopt - Not found
```

Deterministic fallback measurements (each row from a named command run 2026-07-23, not memory):

| Signal | Measurement | Source command |
|--------|-------------|----------------|
| Version | `skillopt 0.2.0` | `curl pypi.org/pypi/skillopt/json` |
| Dist size | wheel **0.32 MB**, sdist 0.29 MB | PyPI `urls[]` |
| Repo clone size | 6.2 MB | `du -sh` |
| Python LOC | 40,172 | `find -name '*.py' \| xargs wc -l` |
| Direct runtime deps | **7** — openai, pyyaml, numpy, openpyxl, azure-identity, azure-core, httpx | `pyproject.toml [project.dependencies]` |
| Heavy deps behind extras | alfworld/gymnasium, claude-agent-sdk, vllm, gradio (webui), sphinx | PyPI `requires_dist` (23 total incl. extras) |
| Telemetry SDKs | none found | `grep -rniE 'telemetry\|amplitude\|sentry\|segment\|posthog\|datadog'` → 0 matching lines (earlier filename-level hits were false positives on the word "segment") |
| Embedded DB / auth | no DB; `azure-identity` is backend-credential auth, not user auth | dep list + grep |
| Embedded server/UI | gradio WebUI behind optional `[webui]` extra; **binds `0.0.0.0` by default** (README) | `README.md`, `skillopt_webui/app.py` |
| Ships CLIs | yes — `skillopt-train`, `skillopt-eval`, `skillopt-sleep` | `pyproject.toml [project.scripts]` |
| Runtime | Python ≥ 3.10; launches `claude -p` / `codex` subprocesses for those backends | `pyproject.toml`, `docs/index.md` |
| Application-shaped signals | **1/6** (optional embedded UI only) | table above |

**Judgment.** By the 6-signal rubric this is a *library-weight* package — but it is a **Python trainer
toolkit in a pnpm/TS host**, so WRAP-by-import is impossible by construction. The only honest
boundaries are **process/protocol** (its CLIs / Claude Code plugin / MCP shells, zero packages in any
ojfbot tree) or **ABSORB** (take the contracts, re-express in our primitives). Both are used below.

## Decision table

| # | Opinion imposed | Call | Evidence → invariant |
|---|-----------------|------|----------------------|
| D1 | Skill = single trainable markdown artifact (`best_skill.md`, 300–2k tokens; protected `LEARNED`/`SLOW_UPDATE` blocks) | **ABSORB** | README overview; `evaluation/gate.py` strips marker blocks. Our artifact stays `SKILL.md` (ADR-0084); take the *trainable-text-state* framing and the protected-block idea for machine-managed sections → diffable-artifact + SKILL.md-canonical invariants. |
| D2 | Bounded edit ops (add/delete/replace patches), LLM-ranked clipping to an edit budget, rejected-edit buffer | **ABSORB** | `optimizer/clip.py` (`rank_and_select`, `max_edits` budget, truncation fallback); README ("rejected-edit buffer"). Re-express as edit-op vocabulary for the shadow evolution stream (`skill:authoring` events, ADR-0098) + a rejected-proposal ledger → "the join is the loop closing" (P4). |
| D3 | Validation-gated acceptance: candidate accepted only on strict held-out improvement (`evaluate_gate`, hard/soft/mixed metric) | **ABSORB** | `evaluation/gate.py` is a ~225-line pure decision function. We already run this discipline for suggester changes (frozen κ holdout); extend it to skill-*body* edits, with RIDM/human sign-off kept on top → shadow-first → RIDM invariant. |
| D4 | Deep-learning vocabulary (epochs, learning rate, LR scheduler, gradients) as the loop's ubiquitous language | **REJECT (naming)** | docs/index.md analogy table. Our UL is disposition / ruler / gate / RIDM (CONTEXT.md, ADR-0044); adopt a mapping table in the research record, not the vocabulary → ubiquitous-language invariant. |
| D5 | Separate optimizer model vs frozen target model | **ABSORB** | `skillopt/model/router.py` config (optimizer and target roles configured separately). Matches the existing Opus-teacher / Haiku-volume pattern; no dependency needed. |
| D6 | `skillopt_sleep` nightly engine: harvest `~/.claude` → mine → replay → gate → **staged proposal → human adopt**, mock + handoff backends | **WRAP at process boundary (shadow trial)** | `docs/sleep/README.md`, `plugins/claude-code/README.md`: read-only harvest, staged-never-auto-applied, backups on adopt, `mock`/`handoff` backends need no API key. Run from a scratchpad venv against 1–2 non-sensitive projects, proposals reviewed at an operator sitting — thin-client-for-capability pattern; zero packages in any ojfbot tree. **Pin the gated/staged config explicitly**: human-gating is their default, not an invariant — `gate_mode=off` and `--auto-adopt` exist (deep-research verified). |
| D7 | Real-backend data boundary: truncated transcripts + derived tasks sent to the provider, "not currently guaranteed to be secret-free" (their words) | **REJECT (default-off)** | `docs/sleep/README.md` data-boundary section, quoted. Violates the sensitive-register discipline (Hal §6, selfco). Any real-backend run requires the reviewed task-file workflow (`"reviewed": true`) on explicitly non-sensitive projects only; mock/handoff otherwise. |
| D8 | Their benchmark envs (`skillopt/envs/`, SearchQA et al.) as the measure of skill quality | **REJECT as our ruler** | Envs are generic QA/embodied benchmarks; our ruler is operator-labeled gold sets + frozen holdouts (ADR-0095, suggester-gold-v1). Their envs are scratchpad experiment material only — "fix the ruler" invariant. |
| D9 | Claude Code plugin surface (`/skillopt-sleep` commands, hooks, local marketplace) | **WRAP (trial), human-gated** | `plugins/claude-code/` ships marketplace metadata + `scripts/sleep.sh` runner; process-boundary by design. Install is an operator decision (it adds hooks/commands to the harness), so trial rides on D6's shadow slice, not a default install. |
| D10 | Its own managed cron scheduler (`/skillopt-sleep schedule`) | **REJECT** | README scheduler section. Fleet scheduling is already owned by launchd/cron conventions + the loops registry (`decisions/loops/loops.md`); a vendor-managed cron entry would be an unregistered loop → loop-registry invariant. |
| D11 | Gradio WebUI monitoring dashboard | **REJECT** | Optional extra; default bind `0.0.0.0` (README). No need — observability lives in cockpit/reports; avoids an always-on local web server. |
| D12 | Python/PyPI runtime for the engine | **WRAP (process)** | `pyproject.toml`. Never enters a pnpm tree; confined to a scratchpad/dedicated venv exactly like other Python repos in the fleet (purefoy, switchboard precedent). |

## Integration shape

Zero SkillOpt packages in any ojfbot tree. **Absorb the contracts** — bounded add/delete/replace edit
ops with an edit budget, a rejected-proposal ledger, and strict held-out validation-gated acceptance
for skill-body edits — into the existing honest-skill-loop primitives (evolution stream, gold sets,
RIDM promotion). **Wrap the capability** — `skillopt-sleep` driven out-of-process from a scratchpad
venv in mock/handoff mode as a shadow trial on non-sensitive projects, proposals human-adopted at a
sitting. Reject their vocabulary, envs-as-ruler, scheduler, WebUI, and default real-backend data flow.
Track the repo as a fast-moving reference (TypeScript-style "powerful tool we use where it fits, not a
platform we build on").
