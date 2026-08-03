# Modes, composition, and routing

Invocation modes for `/deepen`, how it composes with sibling skills, and where accepted proposals route.

## Modes

- **Default** — read-only audit, ranked proposals, no edits.
- `--scope=<path>` — narrow analysis (strongly recommended; whole-repo is rarely useful).
- `--apply=<proposal-id>` — locked behind user confirmation. Routes through `/scaffold` for the new structure, then user manually moves implementation. Skill itself does not edit files.
- `--budget=<N>` — cap proposals at N (default 5). Useful for time-boxed audits.

## Postflight routing (Step 6)

- If a proposal is accepted, the user runs `/scaffold` to wire the new module's types and stubs.
- After scaffolding, `/tdd` drives the move (write tests against the new surface, then make them pass by relocating logic).
- Cross-package moves: open a separate PR per accepted proposal — don't bundle two unrelated deepenings.

## Composition

- Follows `/recon` (which gives the aerial view this audit refines).
- Follows `/sweep` (which finds dead code; deepen finds shallow code).
- Routes to `/scaffold` (new structure) and `/tdd` (drive the move).
- Outputs ADR stubs for cross-package proposals; user commits via `/adr`.

## See Also

- `depth-metrics.md` — public exports, lines per function, import ratio, single-caller leaf
- `refactor-cost-model.md` — weighing test impact, blast radius, migration risk against ergonomics gain
- `ousterhout-summary.md` — depth, information hiding, complexity sources
- `../scripts/measure-depth.mjs` — per-file metric calculator (run from repo root with `--scope=<path>`)
- `../../recon/SKILL.md` — aerial-view orientation (run first)
- `../../sweep/SKILL.md` — dead-code finder (complements deepen — sweep removes, deepen consolidates)
- `../../techdebt/SKILL.md` — file proposals as TECHDEBT.md entries for tracking over time
