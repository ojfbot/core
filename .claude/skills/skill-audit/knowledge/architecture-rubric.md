# Skill Architecture Rubric

The canonical checklist for auditing a skill against the patterns in Anthropic's
"Lessons from building Claude Code: How we use skills," extended with the
predictability axes absorbed from Pocock's `writing-great-skills`
(`decisions/adopt-stack/pocock-writing-great-skills.md`, D26–D36). Single source
of truth — referenced by `/skill-audit` (the audit) and `/skill-create` (birth
compliance).

**Root virtue: predictability** — a skill exists to make the agent take the same
*process* every run, not produce the same output (D26). Every signal below is a
lever on it.

Two signal classes. **Deterministic** signals are script-checkable by
`scripts/audit-architecture.mjs` (no judgment). **Judgment** signals require an
LLM reading the skill. Keeping them separate is what makes the recurring audit
reproducible.

## The nine categories (+ one off-taxonomy value)

Anthropic catalogued their internal skills into nine categories and observed:
*the best skills fit cleanly into one; the ones that try to do too much straddle
several and confuse the agent.* The categories are a **gap-finding lens**, not a
mandatory classification — much of this library is methodology/orchestration that
sits off the nine on purpose.

| value | meaning |
|-------|---------|
| `library-api-reference` | How to correctly use a library/CLI/SDK; gotchas; reference snippets |
| `product-verification` | Drive the running product to verify it works (playwright/tmux/headless). Highest measurable quality impact per Anthropic. |
| `data-analysis` | Connect to data/monitoring stacks; query patterns; dashboard/field references |
| `business-automation` | Collapse a repetitive multi-tool workflow into one command |
| `code-scaffolding` | Generate framework-correct boilerplate from a template |
| `code-quality-review` | Enforce code quality / review code; testing practices |
| `cicd-deployment` | Fetch, commit, push, deploy; rollout + rollback |
| `runbooks` | Symptom → multi-tool investigation → structured report |
| `infrastructure-ops` | Routine (often destructive) maintenance with guardrails |
| `methodology-meta` | Off-taxonomy: planning, orientation, writing, continuity, skill-management, communication. **Not a failure** — an explicit bucket for skills the nine don't describe. |

## Deterministic signals (D)

Each is pass/fail per skill, computed by the script.

- **D1 — Cataloged.** The on-disk skill dir has an entry in `skill-catalog.json` (no drift).
- **D2 — Categorized.** The catalog entry has a `category` from the table above.
- **D3 — Gotchas section.** `SKILL.md` contains a `## Gotchas` heading. *Anthropic: "the highest-signal content in any skill is the Gotchas section."*
- **D4 — Progressive disclosure.** Either the skill has a `knowledge/` dir (load-on-demand reference) **or** its `SKILL.md` is small enough (< ~400 words) not to need one. Fail = a large SKILL.md with everything inline.
- **D5 — Model-facing description.** The `SKILL.md` frontmatter `description` reads as a trigger condition (action words / "MANDATORY … when user asks to" / quoted trigger phrases), not human prose.
- **D6 — Scripts where deterministic.** If the skill's body describes deterministic work (measure/count/scan/compute/tally) it should bundle a `scripts/` dir so the LLM composes rather than reimplements. Soft flag only.
- **D7 — Single category.** The catalog entry is not flagged `straddle: true`. *(Straddle is set by judgment, recorded in the catalog.)*

## Shadow deterministic signals (D8–D11) — observe-only

Absorbed from `pocock-writing-great-skills` (D33, D36 proxies; D27, D29
accounting). Computed and logged by the script but **excluded from the verdict
roll-up** until promoted by a data-gated RIDM decision (ADR-0086 shadow
discipline) — they measure, they don't judge yet.

- **D8 — Sprawl.** SKILL.md body exceeds the sprawl threshold (~800 words)
  *even when* `knowledge/` exists. D4 catches missing disclosure; D8 catches a
  top-of-ladder that stayed illegible after disclosing. Cure: push more
  reference down, or split by branch/sequence.
- **D9 — Negation density.** Count of prohibition patterns (`never`, `do not`,
  `don't`, `avoid`, `must not`) per 100 words. High density is a rewrite
  candidate — steering by prohibition names the unwanted behavior into context.
  Hard guardrails (git safety, never-auto-close) are legitimate and stay; the
  metric finds convertible prohibitions, judgment (J-pass) decides which.
- **D10 — Description load.** Description word count and catalog trigger count.
  The context-load ledger: every description word is paid on every turn.
  Rewrites are **eval-gated** — a description/trigger change ships only if the
  frozen-holdout suggester κ (`scripts/suggester-eval.mjs`) does not regress.
- **D11 — Duplicate lines.** Non-trivial lines (> 6 words, normalized)
  appearing 2+ times within SKILL.md. Proxy for duplication (same meaning, two
  sources of truth); the fix is collapsing to one authoritative place.

## Judgment signals (J)

Scored `Aligned` / `Partial` / `Gap` by an LLM pass.

- **J1 — Doesn't state the obvious.** No restating of default Claude behavior ("Claude already knows how to code"). Knowledge content pushes Claude *out* of its default.
- **J2 — Gotchas carry real edge cases.** The `## Gotchas` content is genuine field-learned failure modes, not filler restating the obvious. *(A Gotchas section that exists but is filler fails J2 even though it passes D3.)*
- **J3 — Doesn't railroad.** Provides knowledge + gotchas while preserving flexibility. **Exception:** gate/quality skills (`validate`, `investigate`, `tdd`, `pr-review`) are allowed deliberate rigid sequences — rigidity is the point there.
- **J4 — Straddle.** Does the skill genuinely do too much (multiple unrelated categories)? If yes → recommend split or document why the straddle is intentional, and set `straddle: true`.
- **J5 — No-op sentences.** (D32) Run the no-op test sentence by sentence: does this sentence change behavior versus the model's default? A failing sentence is deleted whole, not trimmed. Sharpen of J1 from skill-level to sentence-level. Model-relative: findings are prune *candidates*, settled by running the skill, not by debate.
- **J6 — Sediment.** (D36) Stale layers that no longer bear on what the skill does — references to renamed files/flows, superseded conventions, dead modes. Distinct from duplication (repeated meaning) and sprawl (sheer length); the lens is *relevance*.
- **J7 — Completion criteria.** (D35) Do the skill's steps end on checkable criteria (agent can tell done from not-done)? Is the demand exhaustive where it matters ("every X accounted for", not "produce a list")? For flat-reference skills, is there an exhaustiveness bar binding the reference ("every rule applied")? Vague criteria invite premature completion; missing demand invites thin legwork.
- **J8 — Premature-completion risk.** (D31) Do visible later steps tempt rushing an earlier fuzzy step? Ordered defence: sharpen the completion criterion first (cheap, local); recommend a sequence split only when the criterion is irreducibly fuzzy *and* the rush is observed — and only across a real context boundary (subagent dispatch / hand-off), since an inline call hides nothing. Also the lens for context-pointer wording (D30): a must-have `knowledge/` file behind a weakly worded JIT directive is a variance bug — fix the wording first.

## Per-skill verdict

Roll the signals into one label:

- **Aligned** — all D pass (D6 soft), no J `Gap`.
- **Needs work** — 1–2 D fail or a J `Partial` (e.g. missing Gotchas section).
- **Refactor candidate** — `straddle: true`, or 3+ D fail, or a J `Gap`.

Shadow signals (D8–D11) and the new J5–J8 lenses are **reported beside** the
verdict, not rolled into it, until RIDM promotion — this keeps the
verdict-count baseline comparable across audits while the hardening waves run.

## Library-level outputs

- **Coverage map** — count of skills per category; flag categories with 0 (absent) or 1 (thin) coverage. This is the gap-finder.
- **Straddle list** — every `straddle: true` skill with a split/keep recommendation.
- **Drift list** — on-disk skills absent from the catalog (D1 failures).

## Authoring tips checklist (for `/skill-create`)

When creating a new skill, satisfy these by construction:
1. Pick exactly one `category` (use `methodology-meta` if off-taxonomy — don't force a fit).
2. Add a `## Gotchas` section (seed it; it accretes over time, Day-1 → Month-3).
3. Write the `description` as a trigger condition for the model, not prose for a human.
4. Put reference material in `knowledge/`, not inline, once `SKILL.md` grows past ~400 words.
5. Bundle deterministic work as a `scripts/` helper; let the LLM compose it.
6. Don't state the obvious — only what pushes Claude out of its default behavior.
7. Don't railroad unless this is a gate/quality skill where rigidity is the contract.
8. End every step on a checkable, demanding completion criterion — "every modified X accounted for", not "produce a list" (D35). For flat-reference skills, bind the reference with an exhaustiveness bar ("every rule applied").
9. Steer with positives: state the target behavior instead of prohibiting the unwanted one (D33). Keep a prohibition only as a hard guardrail you can't phrase positively, and pair it with what to do instead.
10. Reach for a leading word — a pretrained concept (*tight*, *tracer bullet*, *relentless*) repeated as a token — instead of restating a quality in a phrase at three sites (D34). A coined word recruits no priors; prefer an existing one.
11. Before shipping, run the no-op test sentence by sentence: if a sentence wouldn't change the agent's behavior versus its default, delete the sentence (D32). Trigger/description changes to *existing* skills are additionally eval-gated on the frozen suggester holdout (D29).
