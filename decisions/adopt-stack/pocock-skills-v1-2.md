# /adopt-stack decision: mattpocock/skills v1.2 (wait-what / wizard / to-questionnaire / plugin channel)

Decided 2026-08-08. Candidate pinned at main `84fdeffd12f2ee307994d1eb6feb48173b6e0502`
(2026-08-06; release v1.2.3; MIT). Prompted by Pocock's v1.2 announcement video
(youtube.com/watch?v=gaDdrDdczO4) and the aihero.dev v1.2 changelog.
**Extends `pocock-skills-v1-1.md` (D1–D17), `pocock-skills-teach.md` (D18–D25), and
`pocock-writing-great-skills.md` (D26–D36)** — same framework (`adr:wrap-absorb-reject`),
decision numbering continues at **D37**. Not re-litigated here: any D1–D36 call. Directly
load-bearing for this record: **D15** (router rejected on measured suggester evidence),
**D16** (per-repo config indirection rejected — see D38's boundary with it), **D17**
(upstream handoff rejected), ADR-0083 (vendoring via `npx skills add` rejected; integration
is pin + absorb, zero upstream files enter the tree).

## Gate 0: LIBRARY (unchanged)

Same repo shape as the v1-1 measurement: prompt files, no runtime dependencies, no
telemetry, no bin. Measured at the new pin: 1.4M (`du -sh`), 0 runtime JS/TS (the one new
`.sh` is `wizard/template.sh`, a human-in-the-loop stage library, not agent runtime; one
`.mjs` is changesets version-sync tooling). Application-shaped signals: **0/6**. WRAP does
not arise; every call is ABSORB or REJECT.

## Delta since prior pin `2ab9580` (2026-07-28)

Three new skills (`productivity/wait-what`, `engineering/wizard`,
`productivity/to-questionnaire`); one new distribution channel (official-marketplace Claude
Code plugin, `plugin.json` v1.2.3); `writing-great-skills` renamed to `writing-for-agents`
with a `SKILL-MECHANICS.md` split (content already absorbed D26–D36 — bookkeeping, no call
needed); a `skills/deprecated/` bucket (4 skills incl. `ubiquitous-language` — none was
absorbed as a standalone skill locally, no action); cosmetic churn on nine
previously-absorbed skills (+1/-1 … +3/-5) except two real changes, D41 and D42 below.

## Decision table

Evidence paths are relative to the pinned clone (`skills/…`). Host invariants cite the
ADR/file that owns them.

| # | Opinion imposed | Call | Evidence → invariant |
|---|-----------------|------|----------------------|
| D37 | wait-what: user-invoked comprehension-repair skill; 3-line body by design ("skills that fight verbosity fail by growing"); leading word names the **listener's** state, not the output register; re-pitch scope decided by the agent ("that", not "that last message"); ASD-STE100 register + `CONTEXT.md` vocabulary; never model-invoked | **ABSORB** as new user-scope `/wait-what` | `skills/productivity/wait-what/SKILL.md` + `docs/productivity/wait-what.md` → complements `/caveman`, which names the *output* (compression mode) — upstream's docs name the caveman register as the failure mode of output-naming fixes; the two are a pair, not rivals. Local body stays ≤4 lines — the local Tier/Phase/Gotchas scaffold is deliberately omitted (growing it defeats the mechanism); recorded here so `/skill-audit` doesn't "fix" it. UL clause binds to `CONTEXT.md` per D38 with explicit fallback (repo `CLAUDE.md` + `domain-knowledge/`) so the skill is whole in repos that haven't materialized a glossary yet. |
| D38 | CONTEXT.md: root-level, **glossary and nothing else** ("totally devoid of implementation details… not a spec, a scratch pad, or a repository for implementation decisions"); lazy creation (file exists only once the first term is resolved); `CONTEXT-MAP.md` for multi-context repos; format = Language / Relationships / Flagged ambiguities with canonical term + _Avoid_ list | **ABSORB convention + one bounded extension; REJECT the loader-manifest reading** | `skills/engineering/domain-modeling/SKILL.md`, upstream's own root `CONTEXT.md` → materializes a convention the fleet already half-holds: `~/.claude/CLAUDE.md` UL rule searches for `CONTEXT.md`/`GLOSSARY.md`, and `/grill-with-docs` already stages CONTEXT.md diffs — but zero repos have the file. Root location wins over the skill's older `domain-knowledge/CONTEXT.md` path (ancestor-search + CONTEXT-MAP compatibility); `/grill-with-docs` re-pointed. **Extension:** a term entry MAY carry one `→ deeper:` pointer (selfco wiki page, `domain-knowledge/` file) — a glossary entry with a citation is still a glossary entry. **Rejected:** using CONTEXT.md as a context-loading manifest for bead/selfco/tracking state — that is the role ADR-0081 assigns to CLAUDE.md layer routing, and putting it in CONTEXT.md violates the upstream's one hard rule. Boundary with D16: D16 rejected *config* indirection (`docs/agents/issue-tracker.md` etc.); the glossary is domain language, not config — no conflict. ADR staged: `adr:context-md-glossary-pointer-convention` (draft). |
| D39 | wizard: agent authors a stage-based interactive bash wizard for human-only procedures (credentials, CI secrets, dashboards, cutovers) from a fixed UX library (`template.sh`: stage gates, hidden secret entry, idempotent `.env` upserts, `gh secret` writes); library never hand-edited; ephemeral by default | **ABSORB, build deferred** | `skills/engineering/wizard/SKILL.md` + `template.sh` → fills a real gap (pending `aws sso login` push, selfco Pi deploy keys, USGS M2M — all recent human-only setup chains). Per ADR-0083 the template does not enter the tree verbatim; the stage library gets re-authored locally against the upstream contract (stage/say/ask_secret/write_env/set_secret/confirm) in the follow-up build. Deferred because the library + a verification pass is a session of its own; deferral tracked via background task, not silently dropped. |
| D40 | to-questionnaire: turn a decision the user can't answer alone into an async questionnaire for a named recipient; **grill the send, not the subject** (interview only about recipient + what's needed back; the questions target the recipient's knowledge gap); most-important-first ordering; one-idea questions with answer stubs + "why this matters" only where misreadable | **ABSORB** as new user-scope `/to-questionnaire` | `skills/productivity/to-questionnaire/SKILL.md` → no local equivalent: `/grill-with-docs` interviews *the user*, nothing extracts knowledge from a third party async. Concrete demand exists (FDE gap-simulator S2 call prep, client-engagement discovery under the no-outreach rule — a questionnaire is reviewable-before-send). Re-expressed, not vendored; output lands `to-questionnaire-<slug>.md` in cwd, unchanged. |
| D41 | grilling: pacing moves from one-question-at-a-time to **frontier rounds** — ask the whole set of questions whose prerequisites are settled, numbered `❓ Q<n>` each with `➡️` recommended answer; recompute the frontier after each round; dependent questions wait; fact-finding dispatched to sub-agents without blocking the rest of the round; done when the frontier is empty | **ABSORB with an independence guard** | upstream diff `2ab9580..84fdeff` on `skills/productivity/grilling/SKILL.md` (+14/−4) → supersedes the pacing half of D1's absorption. Local doctrine ("batching is where ambiguity hides" — the user answers the easy question and skates past the load-bearing one) is preserved as the guard: a round contains only mutually-independent questions, and when answers might interact, fall back to one per turn. The two rationales agree on the failure mode (stacked *dependent* questions); frontier rounds forbid exactly those. `/grill-with-docs` step 4 + gotchas updated. |
| D42 | diagnosing-bugs: redaction discipline — every shown command/output/artifact has secrets replaced with `<REDACTED>` first; loops built against env vars so credentials stay out of what's shown; captured artifacts quoted only at the signal lines; if redacted output can't diagnose, say so and ask | **ABSORB** into `/investigate` | upstream diff on `skills/engineering/diagnosing-bugs/SKILL.md` (+8/−2) → `/investigate` shows evidence verbatim by design and had no redaction rule; this is a real hole (HAR files and log dumps carry auth headers). Small additive section. |
| D43 | Distribution: install as an official-marketplace Claude Code plugin (`/plugin install mattpocock-skills`), auto-updating, 25 skills | **REJECT install; ABSORB the update problem as a watch routine** | `README.md` install block, `.claude-plugin/plugin.json` → reaffirms ADR-0083. Installing would land 9+ hard name collisions (`grill-with-docs`, `tdd`, `triage`, `wayfinder`, `teach`, `code-review`, `handoff`, `prototype`, `research`) against locally-hardened versions, and dump ~25 foreign descriptions into the suggester's matching surface mid-Wave-2 (holdout κ-gate 0.603, hook #400). The legitimate need the plugin answers — *staying current* — is met instead by a scheduled watch routine: weekly check of repo HEAD vs. the pin recorded here, plus Pocock's teaching output (aihero.dev changelog/skills pages, YouTube channel) since absorbed opinions ship with essays that explain the *why*. Findings post to a core tracking issue; a HEAD change triggers a new adopt-stack pass, never a sync. |

## Integration shape

Zero upstream files enter the tree. Two new skills re-expressed (`/wait-what`,
`/to-questionnaire`, both `scope:["user"]` so they fire in any session on this machine,
including `~/selfco` vault sessions); one convention materialized (root `CONTEXT.md`
glossary, seeded in core, lazy elsewhere; draft ADR staged); two existing skills amended
(`/grill-with-docs` frontier rounds + CONTEXT.md re-point, `/investigate` redaction); one
absorb deferred with a tracked build task (`/wizard`); one rejection with a compensating
watch routine (plugin channel → weekly upstream watch). Upstream tracking remains
pin + adopt-stack record, per ADR-0083.

Suggester note: this adds 2 descriptions to the catalog surface while the Wave-2 κ-gate
(0.603) is under measurement — orders of magnitude below the 25-description perturbation
D43 rejects, but recorded so the Wave-2 analysis can account for it.
