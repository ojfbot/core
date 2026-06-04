# ADR-0081: CLAUDE.md loading-discipline routing (rules/ as Layer 1)

Date: 2026-06-04
Status: Proposed
OKR: [TBD — Q2 / workflow-engine hygiene]
Commands affected: /init (authors CLAUDE.md → must route), /claude-md-audit (new, proposed), /sweep
Repos affected: virtualLight, purefoy, cv-builder, TripPlanner, blogengine, core (+ core for the skill/hook/standards)

---

> Shaped by a `/grill-with-docs` session (2026-06-04) off the Newline "Setting Up Claude Code" config audit (`~/selfco/wiki/synthesis/newline-setup-vs-ojfbot-claude-config.md`). Supersedes the original stub. Implementation spec to be produced by `/plan-feature --from-conversation`.

## Context

6 CLAUDE.md files run 1.5–2× the common ~200-line guidance (virtualLight 389, purefoy 377, cv-builder 366, TripPlanner 339, blogengine 310, core 303). The audit finding: **line count is the wrong metric.** The real cost is *conditional* content sitting in an *always-loaded* file — which both wastes context budget and silently dilutes instructions (Claude will not report ignoring a rule buried on line 280). "No failures observed" is near-worthless evidence because the failure mode is silent. Conversely, core's 303 lines are almost entirely always-relevant (command catalog + ecosystem map), proving size ≠ problem.

The newline lesson's remedy — split into `.claude/rules/` — is correct for *one* of four content classes. The fleet currently has **zero** `rules/` directories; instructions live in always-loaded CLAUDE.md, on-demand `domain-knowledge/`, and skills.

## Decision

Adopt a **standing loading-discipline** for CLAUDE.md authoring, not a line ceiling. Route every block by when it's needed:

- **Always-relevant** → stays embedded in CLAUDE.md (**Layer 0**).
- **Path-conditional** → **Layer 1**, auto-loaded by edit path. Two officially-supported mechanisms (verified against Claude Code docs, 2026-06): (a) `.claude/rules/<area>.md` with `paths:` frontmatter glob — the new `Rule` aggregate (CONTEXT.md §3); or (b) a nested `<subtree>/CLAUDE.md` (loaded on-demand when Claude reads files in that subtree). Default: nested CLAUDE.md for subtree-coherent content, `rules/` glob for cross-cutting concerns. (`@import` does **not** qualify — imports load at startup.)
- **Task-conditional reference** → `domain-knowledge/` pulled by a skill (**Layer 2**).
- **Stale / not-100%-true** → deleted.

**Forbid `@import`-relocation** (it preserves the always-loaded footprint — the metric is footprint, not line count). Enforce with a **two-stage PreToolUse gate** scoped to `**/CLAUDE.md` edits: stage 1 is a cheap deterministic tripwire (edit grows an already-oversized CLAUDE.md?) that gates stage 2, a scoped Haiku **judge** (reads the file + routing rubric). On a hit the gate runs a **block→ask loop**: block the edit (agent attempts to re-route) → if unresolved or the editor is human, ask the user — **presenting the judge's verdict as a fallible flag, not a ruling**, and routing into `/grill-with-docs --scope=claude-md-routing` to decide. Because the judge can itself drift/hallucinate, **every firing is logged as a structured event** (file, flagged lines, verdict + reasoning, action, resolution) so the judge's own reliability is measurable (see M5). The *reasoning* lives in the judge/`/claude-md-audit` skill, never as static logic in the hook. `/init` learns to route from the start so the pattern does not regrow.

## Consequences

### Gains
- Lower always-loaded footprint where content is genuinely conditional; less silent dilution.
- Forward-looking authoring discipline → the problem does not regrow from stale docs (the heresy-regrowth failure mode).
- Sensing/deciding/acting cleanly separated: telemetry senses, skill decides, gate enforces.

### Costs
- A new instruction surface (`Rule`) and drift risk ("where does this rule live?") — the ubiquitous-language concern.
- A gate that over-fires gets disabled within a day; demands high precision.
- Judgment content (which bucket?) cannot be fully automated — the gate catches "you added 40 lines to a 300-line file," not "is this line conditional."

### Neutral
- core likely barely decomposes — a successful outcome, not a failure.

## Rollout & evaluation (gating condition)

Success is a **quality property, not a footprint target**: *zero conditional blocks remain in the always-loaded layer.* Footprint reduction is then whatever falls out — large for cv-builder, ≈0 for core — and **both are correct** (a flat % target would wrongly force core to evict always-relevant content). Metrics (deterministic where possible):
- **M1 — always-loaded footprint** (descriptive, not pass/fail): tokens loaded per repo = root + ancestor `CLAUDE.md` + `@imports` + non-path-scoped rules; **excludes** path-scoped `rules/` and nested subtree `CLAUDE.md`. Tracked before→after with a routing diff (proves no `@import` theater).
- **M2 — Layer-1 conditionality**: % of new Layer-1 files (rules/ or nested CLAUDE.md) whose scope is narrower than repo root. Target 100%.
- **M3 — gate precision** (overfit signal): gate fires vs. overridden. Override rate >~30% → retune or disable.
- **M4 — over-decomposition / mis-routing** (overfit, silent): Layer-1 file count + a floor spot-audit (a CLAUDE.md dropping below ~80 lines is sampled — did always-true content get wrongly evicted?).
- **M5 — judge reliability** (the watcher of the watcher): false-block rate from the gate's structured event log — blocks later confirmed (by grill/user) to be on genuinely conditional content vs. judge hallucinations. Rising false-block rate ⇒ the Haiku judge is drifting ⇒ retune/swap.

**Rollout is opt-in per repo but automated**: a `core/CLAUDE-MD-ROLLOUT.md` tracker (per repo: `untouched → audited → PR-open → merged → gated`) advanced one repo per cycle by a **`/schedule` cron** that runs `/claude-md-audit`, opens the PR, and updates the tracker + telemetry — never a big-bang. Daily progress surfaces in **`/frame-standup`**. **Scale-up to ADR-0083** (general hooks-as-enforcement) is **data-gated**: only if the quality property holds AND M3/M5 low AND M4 clean after ~4 weeks; else hold the gate / keep manual discipline.

## Alternatives considered

| Alternative | Why rejected |
|-------------|--------------|
| Hard line-count CI gate (<200) | Optimizes the wrong metric; invites `@import` theater. |
| Reject rules/, document "it works" | "No failures" is blind to silent dilution; unprovable. |
| `@import` to organize CLAUDE.md | Preserves always-loaded footprint — theater. |
| One-time remediation of the 6 files | Regrows from stale docs (heresy pattern); no forward teeth. |
| Blanket-adopt rules/ for all 6 | Wrong shape — core is mostly Layer 0; routing is per-block, not per-repo. |
