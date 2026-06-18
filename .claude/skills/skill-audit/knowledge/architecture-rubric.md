# Skill Architecture Rubric

The canonical checklist for auditing a skill against the patterns in Anthropic's
"Lessons from building Claude Code: How we use skills." Single source of truth —
referenced by `/skill-audit` (the audit) and `/skill-create` (birth compliance).

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

## Judgment signals (J)

Scored `Aligned` / `Partial` / `Gap` by an LLM pass.

- **J1 — Doesn't state the obvious.** No restating of default Claude behavior ("Claude already knows how to code"). Knowledge content pushes Claude *out* of its default.
- **J2 — Gotchas carry real edge cases.** The `## Gotchas` content is genuine field-learned failure modes, not filler restating the obvious. *(A Gotchas section that exists but is filler fails J2 even though it passes D3.)*
- **J3 — Doesn't railroad.** Provides knowledge + gotchas while preserving flexibility. **Exception:** gate/quality skills (`validate`, `investigate`, `tdd`, `pr-review`) are allowed deliberate rigid sequences — rigidity is the point there.
- **J4 — Straddle.** Does the skill genuinely do too much (multiple unrelated categories)? If yes → recommend split or document why the straddle is intentional, and set `straddle: true`.

## Per-skill verdict

Roll the signals into one label:

- **Aligned** — all D pass (D6 soft), no J `Gap`.
- **Needs work** — 1–2 D fail or a J `Partial` (e.g. missing Gotchas section).
- **Refactor candidate** — `straddle: true`, or 3+ D fail, or a J `Gap`.

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
