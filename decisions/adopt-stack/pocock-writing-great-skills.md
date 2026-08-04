# /adopt-stack decision: mattpocock/skills `productivity/writing-great-skills`

Decided 2026-08-03. Candidate pinned at main `2ab958093e83e0ec752e6c1c5932da465bf23e0c` (MIT) — the
**same pin** as `pocock-skills-teach.md`, so the candidate version is consistent across records.
**Extends `pocock-skills-v1-1.md` (D1–D17) and `pocock-skills-teach.md` (D18–D25)** — same framework
(`adr:wrap-absorb-reject`), decision numbering continues at **D26**. Not re-litigated here: any D1–D25
call. Two are directly load-bearing for this record: **D15** (router skill REJECTED — hook-forced
suggester evaluated 84–100% vs router ~80%, `decisions/research/2026-07-17-skill-loop-sota.md`) and
ADR-0083 (vendoring via `npx skills add` rejected — integration is pin + absorb, zero upstream files
enter the tree).

Verdicts were made in-session under the operator-approved plan slate (plan of 2026-08-03, which named
expected leanings per opinion); any call the operator wants to overturn goes through a revision of this
record, not a re-run of the audit.

Upstream context: in the candidate repo's v1.0.0 this skill **replaced `write-a-skill`** — it is
Pocock's skill-*authoring* doctrine, all reference, no steps (`disable-model-invocation: true`
upstream). The natural absorption surface in this fleet is therefore the existing authoring/audit
pair: `skill-audit/knowledge/architecture-rubric.md` (single source of truth) + `/skill-create`
(birth compliance) — **not** a new skill.

## Gate 0 (script-measured): LIBRARY (0/6 application signals)

Candidate is a git subtree of prompt files, not a published npm artifact, so `measure-pkg.mjs`
(pnpm-view) does not apply — same posture as the v1-1 and teach records. Measured directly against the
pinned tarball (`github.com/mattpocock/skills/archive/2ab95809….tar.gz`); commands + verbatim output:

| Signal | Measurement (command) |
|--------|------------------------|
| Version | `package.json` → `1.1.0`; candidate subtree `skills/productivity/writing-great-skills` |
| Subtree size | `du -sh …/writing-great-skills` → `36K` |
| Content | 3 files: `SKILL.md` (83 lines / 1,526 words), `GLOSSARY.md` (201 lines / 2,939 words), `agents/openai.yaml` (5 lines — display name + `allow_implicit_invocation: false`) (`find -type f`, `wc -lw`) |
| Runtime code | **0** (`find … -name '*.ts' -o -name '*.js' -o -name '*.cjs' -o -name '*.mjs' \| wc -l` → 0) |
| Telemetry/network SDKs | **0** (`grep -rilE 'analytics\|sentry\|amplitude\|posthog' … \| wc -l` → 0) |
| DB drivers / server / auth / bin | none |
| Application-shaped signals | **0/6** |

Consequence: no runtime to wrap. Every call below is **ABSORB** or **REJECT** — WRAP does not arise.

## Decision table

Evidence paths are relative to the pinned subtree (`skills/productivity/writing-great-skills/…`).
Quoted lines are verbatim from the pin.

| # | Opinion imposed | Call | Evidence → invariant |
|---|-----------------|------|----------------------|
| D26 | **Predictability as root virtue**: "the agent taking the same _process_ every run, not producing the same output — is the root virtue; every lever below serves it" | **ABSORB** | `SKILL.md` L7, `GLOSSARY.md` "Predictability" → names what the fleet's audit apparatus already optimizes for but had no word for; enters `architecture-rubric.md` preamble as the stated goal the D/J signals serve. |
| D27 | **Invocation economics**: strip `description` from user-invoked skills ("zero context load"); keep descriptions only where the agent must reach the skill autonomously | **REJECT as stated; ABSORB the accounting** | `SKILL.md` L15–L18 → description-stripping fights the fleet's discovery architecture: the suggest-skills hook + catalog `triggers` are the invocation surface (ADR-0068 exists because suggestions were *ignored*, not over-fired), and D5 requires model-facing descriptions. But the **context-load ledger is real and previously unmeasured**: total description word count across 68 skills becomes a tracked axis (script `desc_words`, fleet aggregate in the audit report). |
| D28 | **Router skill** cures cognitive load when user-invoked skills multiply | **REJECT** | `SKILL.md` L20 → already decided as **D15** (hook-forced eval 84–100% beats router ~80%). Cross-ref only; not re-litigated. |
| D29 | **Description writing**: front-load the leading word; "One trigger per branch. Synonyms that rename a single branch are duplication"; cut identity already in the body | **ABSORB, eval-gated** | `SKILL.md` L24–L28 → the fleet's one *proven* description instrument is `scripts/suggester-eval.mjs` (Cohen's κ = 0.700 frozen holdout). Amendment: **no description or trigger-list rewrite ships unless the frozen-holdout κ does not regress** — Pocock's synonym-collapse rule is a hypothesis about *this* fleet's matcher, not a fact; the eval is the arbiter. The `MANDATORY:` prefix is a deliberate ADR-0068 countermeasure and is exempt from stylistic pruning until the eval says otherwise. |
| D30 | **Information hierarchy**: steps → in-file reference → disclosed reference; progressive disclosure "is how the information hierarchy is protected", licensed by branching; context-pointer *wording* decides reach; co-location within a rung | **ABSORB** | `SKILL.md` L30–L44 → refines existing D4 (which only checks `knowledge/` presence vs word count). New: pointer-wording quality and co-location enter the judgment pass; "a must-have target behind a weakly worded pointer is a variance bug" (`GLOSSARY.md` "Context Pointer") becomes a J-lens on JIT directives. |
| D31 | **Split by sequence / post-completion steps**: visible later steps pull toward premature completion; "hiding only works across a real context boundary (a user-invoked hand-off or a subagent dispatch)" | **ABSORB as judgment lens (J8)** | `GLOSSARY.md` "Premature Completion", "Post-Completion Steps" → the context-boundary caveat matches fleet reality (orchestrate L3 dispatch, day-run briefs are exactly such boundaries). Ordered defence absorbed verbatim: **sharpen the completion criterion first**; split only when the criterion is irreducibly fuzzy *and* the rush is observed. No skill is split by this record — split candidates surface via J8 in the extended audit. |
| D32 | **No-op sentence test**: "run the no-op test on each sentence in isolation, and when one fails, delete the whole sentence"; model-relative — "settle it by running the skill, not by debate" | **ABSORB as judgment signal (J5)** | `SKILL.md` L59, `GLOSSARY.md` "No-Op" → direct sharpening of existing J1 ("doesn't state the obvious") from skill-level to sentence-level. The model-relative caveat is kept: J5 findings are *candidates*, confirmed by behavior, not debate — pruning waves treat them as prune-candidates, not auto-deletes. |
| D33 | **Negation → positive framing**: "steering by prohibition backfires… Prompt the positive"; prohibitions survive only as hard guardrails paired with the positive target | **ABSORB as measured axis + J lens, guardrails exempt** | `SKILL.md` L83, `GLOSSARY.md` "Negation" → script measures negation density (D9, observe-only); judgment decides which prohibitions are convertible. Exemption is explicit: the fleet's hard guardrails (git safety, never-auto-close, movement-contract "NEVER writes northstar current:") are exactly the "hard guardrail you can't phrase positively" case Pocock allows — they stay, paired with positive alternatives where possible. |
| D34 | **Leading words**: pretrained concepts repeated as tokens, anchoring execution + invocation; "Assume every skill is carrying restatements that leading words retire — go find them" | **ABSORB as authoring technique + J lens** | `SKILL.md` L61–L72 → enters the `/skill-create` checklist (reach for a pretrained word; coined words pay definition tokens) and the judgment pass hunts collapse opportunities ("fast, deterministic, low-overhead" → *tight*). No deterministic proxy — leading-word strength is model-relative (a weak one is a no-op, `GLOSSARY.md` "No-Op"). |
| D35 | **Completion criteria**: clarity (checkable) resists premature completion; demand (exhaustive) drives legwork — "which is how a skill with no steps still carries an exhaustiveness bar" | **ABSORB as judgment signal (J7)** | `GLOSSARY.md` "Completion Criterion", "Legwork" → previously invisible to the audit. J7 checks each skill's steps (or flat-reference bar) for checkable + demanding criteria; the demand-binds-flat-reference point matters here because most fleet skills are reference-heavy. |
| D36 | **Failure-mode vocabulary**: duplication ≠ sediment ≠ sprawl (repeated meaning / stale accumulation / sheer length), each with its own cure | **ABSORB into rubric vocabulary + deterministic proxies** | `SKILL.md` L74–L83, `GLOSSARY.md` §Pruning → the distinctions assign *different fixes* to what D4 currently lumps as "too big": sprawl → disclose (D8 proxy: large body even with `knowledge/`); duplication → single source of truth (D11 proxy: repeated non-trivial lines); sediment → relevance pruning (J6, no deterministic proxy — staleness needs judgment). |

## Integration shape

Zero upstream files enter the tree (ADR-0083). Nine opinions absorbed, two rejected (D27-as-stated,
D28). Absorption lands in exactly two existing surfaces — `skill-audit` (rubric preamble + shadow
deterministic signals D8–D11 + judgment signals J5–J8) and `/skill-create` (authoring checklist items)
— preserving the fleet's single-source-of-truth rubric rather than adding a parallel Pocock rubric.
All new deterministic signals run **shadow/observe-only** (reported + logged, excluded from verdict
roll-up) per ADR-0086; promotion into the verdict is a RIDM decision gated on the hardening waves'
data. Description-touching work is gated on the frozen suggester eval (D29 amendment). Upstream
tracking remains the pinned-commit mechanism; this record supersedes nothing in the two prior records.
