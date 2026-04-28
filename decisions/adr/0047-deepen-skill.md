# ADR-0047: Skill /deepen for Ousterhout-style module depth audits

Date: 2026-04-28
Status: Accepted
OKR: 2026-Q2 / O2 (skill ergonomics) / KR3 (architectural fitness)
Commands affected: /deepen (new), /sweep, /lint-audit, /techdebt, /scaffold
Repos affected: all

---

## Context

The Frame skill catalog has tools for tactical pattern detection (`/sweep` for dead code, `/lint-audit` for ESLint findings) and tools for surfacing entropy after the fact (`/techdebt` for cataloging accumulated issues). None of them ask the strategic question Ousterhout's *A Philosophy of Software Design* puts front and center: **are these modules deep enough?**

Symptoms of shallow design we've already seen across ojfbot:
- `packages/workflows/src/workflows/` has thin one-export wrappers per command (techdebt.ts, workbench.ts, etc.) that import many dependencies and add little behavior — high import-ratio, single-caller. The metrics flag them automatically.
- `packages/api/.../routes/` files in sub-apps tend toward many tiny exports, each a thin handler delegating to internal services — classic shallow-API pattern.
- Each new utility ends up in its own `utils/<thing>.ts` file regardless of size; the pile grows without consolidation pressure.

We want a skill that:
1. Measures depth with concrete metrics (so the audit isn't subjective)
2. Proposes consolidations with explicit cost/benefit (so the user can decide)
3. Surfaces false positives explicitly (barrel re-exports, intentional thin facades)
4. Does not silently edit code (the move is too risky for autonomous execution)
5. Routes accepted proposals to `/scaffold` and `/tdd` for the actual move

Pocock's `/improve-codebase-architecture` (mattpocock/skills) addresses (1)-(3); we ship it as `/deepen` to match Frame's verb-name skill convention and to highlight the Ousterhout depth concept that drives it.

## Decision

Ship `/deepen` at `.claude/skills/deepen/deepen.md` with three knowledge files and one script:

- `knowledge/depth-metrics.md` — public-exports/lines-per-fn/import-ratio/single-caller-leaf definitions, false-positive guards, JSON output format
- `knowledge/refactor-cost-model.md` — cost dimensions (test impact, blast radius, migration risk, ADR required), benefit dimensions (cognitive load, ergonomics, testability, agent ergonomics), weighing heuristic
- `knowledge/ousterhout-summary.md` — one-page recap of the Ousterhout depth model (deep modules, complexity sources, information hiding, strategic vs. tactical, generality where it pays)
- `scripts/measure-depth.mjs` — pure-Node depth-metric calculator. Reads .ts/.tsx in `--scope`, builds local import graph, computes per-file metrics + composite shallow score (0..1), outputs JSON. Excludes tests/dist/build/d.ts by default.

Workflow: scope and recon → measure → cluster shallow files by responsibility → propose deepening candidates with cost/benefit → suggest ADR for cross-package proposals → route accepted proposals to `/scaffold` (new structure) and `/tdd` (drive the move).

Modes:
- Default — read-only audit, ranked proposals, no edits.
- `--scope=<path>` — narrow analysis (strongly recommended; whole-repo audits produce too much output to act on).
- `--apply=<proposal-id>` — gated; routes through `/scaffold` rather than directly editing.
- `--budget=<N>` — proposal cap (default 5).

Output cap: 5 proposals per session. More dilutes signal; user re-runs with narrower scope.

Heuristic rule (already shipped in PR #81): Tier 2 suggestion when PR diff includes >5 changed `.ts`/`.tsx` files — the diff itself is shallow-spread signal.

## Consequences

### Gains
- Strategic 20% of every meaningful change has a concrete tool. Not every PR runs `/deepen`, but periodic invocations (after milestones, after the daily-logger ships, after a feature lands) leave the codebase a bit deeper each time.
- Metric-driven proposals neutralize the "this looks shallow to me" hand-waving that derails architecture conversations. The script's score is a starting point; code-reading judgment refines it.
- Shallow-design signal arriving via `/tdd` escalation (3+ awkward tests in a row) routes here automatically, closing the loop between feedback discipline and design correction.
- Cost/benefit framing makes risk legible. Proposals that look attractive on metrics but require a multi-PR migration get flagged "recommended order = 3" so user prioritizes accordingly.
- `measure-depth.mjs` outputs JSON — it can be re-used by other tooling later (telemetry, PR audit heuristics, CI gates) without re-implementing the heuristics.

### Costs
- Heuristics are imperfect. Barrel files, type-namespace files, and intentional thin facades will look shallow. Mitigated by explicit false-positive guards in `depth-metrics.md` and a "score < 0.5 = noise" threshold.
- The script does best-effort static analysis (regex-based, not full AST). Won't perfectly handle every TypeScript edge case (e.g., dynamically constructed export lists, unusual decorators). Acceptable for a heuristic; if we need precision later, swap to ts-morph or @typescript-eslint AST.
- Output of 5 proposals can still be too much to act on in one PR. The recommended-order field nudges users to do one at a time.
- Risk of premature deepening (consolidating modules that aren't causing pain). Mitigated by the "don't deepen what doesn't ask to be deepened" principle in the skill body and by the cost-benefit table.

### Neutral
- The skill never edits code, even with `--apply`. That flag routes the deepening through `/scaffold` (new structure) and the user manually moves logic. This is more conservative than Pocock's posture but matches Frame's "skills don't silently restructure code" stance.
- Cross-package proposals always require an ADR. This is a real cost for the proposal flow but a major safety win for the cluster.

## Alternatives considered

| Alternative | Why rejected |
|-------------|--------------|
| AST-based analysis (ts-morph or eslint AST) | Over-engineering for a heuristic. Regex catches 95% of cases; the cost/benefit framing absorbs imprecision. Can swap later if precision becomes a constraint. |
| Make depth a `/lint-audit` rule | `/lint-audit` is a CI-friendly checker; depth proposals require human-grade judgment and cost/benefit narrative. Different concern. |
| Run on every PR via heuristic-analysis | Already shipped at Tier 2 (when PR adds >5 TS files). Tier 1 would be too noisy; the audit is a periodic strategic move, not a per-PR gate. |
| Auto-apply (skill edits files directly) | Refactor blast radius is too large to auto-execute. User judgment on each move is required. |
| Fold into `/sweep` | `/sweep` removes; `/deepen` consolidates. Different operations, different user mental models. Two skills compose better than one overloaded skill. |
| Defer the script; do depth analysis manually | Manual depth analysis is too easy to skip when there's no concrete tool. Shipping the script makes the audit cheap to run. |

## Implementation notes

- Skill catalog entry already shipped in PR #81 (tier 2, phase `architecture`, `suggested_after: ["/recon", "/sweep", "/lint-audit"]`).
- Heuristic rule already shipped in PR #81 (Tier 2 when >5 TS files changed).
- Smoke-tested against `packages/workflows/src` — found `workflows/techdebt.ts` (score 0.65) and `workflows/workbench.ts` as top candidates. Real signal; the workflow files are thin one-export wrappers that import many dependencies. Whether to consolidate them is a separate decision; the audit surfaces the candidates.
- 30-day retro will measure: invocation count, proposals accepted vs. rejected, downstream `/scaffold` + `/tdd` usage following accepted proposals, follow-on TECHDEBT.md entries.
