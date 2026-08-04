Reference for `speculative-pass` generation: what the skill abstracts, the four-part stance structure, the orthogonality knob, the full I/O contract, workflow steps 1–3 in detail, and registration.

The thing this skill abstracts is a *structure*, not a topic. The map-stack fleet worked because of a repeatable shape, not because of maps — the harness is durable, the products are disposable (Founders' Playbook framing already in selfco). This skill makes that harness reusable.

Distinct from `/deep-research` (fan-out web search → cited report) and `/orchestrate` (execute a decomposition through worktree agents). This skill *generates the stances and seed prompts*; running them is optional and downstream.

## What a stance is — the four-part structure

Every agent in a fleet is a **stance**, defined by exactly four parts. Drop any one and the fleet degrades; the load-bearing part is named below.

1. **Native domain** — where the agent natively thinks, deliberately NOT James's core. This is what supplies the weirdness. An Archivist thinks in centuries and single files; a Morphologist thinks in slime-mold transport networks. If the native domain is already inside James's world, the stance has no oblique angle and produces advice he'd reach anyway.

2. **Forced landing** — the clause that makes every speculation reduce to something James can *build on his actual substrate*. Without it the agent lectures ("maps are political," "back up your data"). With it, every speculation must terminate in an artifact, a pipeline step, a query, a file format he already runs. The forced landing is what converts weirdness into pursuable work.

3. **Anti-pattern** — the boring attractor the agent must avoid. **THIS IS THE LOAD-BEARING PART.** Without an explicit anti-pattern, all n stances collapse onto the same generic answer (for the map stack: "use an LLM to make a nicer basemap"). The anti-pattern names the failure mode that would make the stance boring, so the agent has to route around it. It is the difference between a fleet that diverges and a fleet that rephrases one idea n times.

4. **Seed prompt** — the verbatim instruction a Claude Code / Cowork sub-agent runs. Written so it can be lifted character-for-character into a real parallel session. Names James's real tools, states the forced landing inside the prompt, and embeds the anti-pattern as a constraint.

Pattern, stated once: **Native domain** (where it thinks) → **Forced landing** (so it builds, not lectures) → **Anti-pattern** (the boring attractor it must avoid) → **Seed prompt** (the verbatim sub-agent instruction).

## The orthogonality knob — the key parameter

A single setting tunes how far off-core the native domains are pulled, and it simultaneously calibrates the strictness of the forced-landing clause. Take it as an explicit input; default to `adjacent-weird`.

| Setting | Native domains pulled from… | Forced-landing strictness | Every output pursuable? |
|---|---|---|---|
| **adjacent-weird** *(DEFAULT)* | neighboring fields — recognizably in-domain, novel angle. The band the map-stack fleet used. | **strict** — must reduce to existing substrate James already runs | yes |
| **off-axis** | genuinely other fields, dragged back to the target | **present but bridging-tolerant** — a land may need one new component, named | mostly |
| **maximally-wild** | ignore feasibility; optimize for surprise | **relaxed/optional** — landing is a bonus, not a requirement | no — surprise is the point |
| **spread** | mix across the band: assign each stance a different setting so the fleet samples the whole axis | per-stance | mixed — flag which |

The knob does two jobs at once, and they move together: it sets **how far the native domain sits from core**, and **how hard the forced landing has to pull it back**. Wild domains with strict landings produce nothing; adjacent domains with relaxed landings produce the generic advice you were trying to escape. Keep the two coupled.

## I/O contract

**INPUT**
- `core` — a description of James's known world for the target area, pulled from selfco. For the map stack that is: geospatial engineering (GDAL / GRASS / PostGIS / PMTiles / tippecanoe), agentic CLI pipelines, data-journalism-via-agents, the Airstream camera program + analog fabrication (intaglio / cyanotype / pinhole), and the selfco bead-as-provenance pattern. If James doesn't hand you the core, retrieve it from selfco (`/vault query` or the relevant `wiki/` pages) before generating — stances built on a guessed core land wrong.
- `target subsystem` — what to attack. E.g. "the F1 telemetry stack," "selfco itself," "the Airstream camera program," "the map stack."
- `orthogonality` — one of the four settings above.
- `n` — fleet size. The map stack used 5.

**OUTPUT**
- `n` stances, each with native domain / forced landing / anti-pattern / seed prompt.
- optionally: run `k ≤ n` of them inline as sample passes (the PASS shape below).
- a handoff doc (same shape as a `.handoff/` bead) so the un-run stances can be spawned later — the handoff is never a spent idea.

## Workflow detail — steps 1–3

### 1 — Assemble the core

Get James's core for the target area. If he pasted it, use it. Otherwise pull it from selfco — the vault is the canonical store of what James's world *is*. A stance is only as good as the substrate it's told to land on; a thin or guessed core produces stances that propose things he already has or can't build.

### 2 — Generate n disjoint native domains, calibrated to the knob

Pick `n` native domains, each outside James's core, calibrated to the orthogonality setting (adjacent for `adjacent-weird`, far for `off-axis`/`maximally-wild`, mixed for `spread`). **They must be disjoint** — no two stances may share a source domain, or parallel runs will rephrase one idea instead of diverging. Disjointness of *domains*, not of landing surface: several stances can land on the same substrate (GDAL, PMTiles) as long as they *think* in different worlds.

For the map stack, the five were: long-term data preservation / format archaeology · investigative journalism + intelligence (what a map hides) · biology / growth-and-routing models · pre-digital cartographic craft · fiction / invented worlds.

### 3 — For each domain, derive the other three parts

- **Forced landing** — name the substrate it must reduce to, at the strictness the knob sets. "Every speculation reduces to an artifact James can produce from his current pipeline and store the way he stores selfco."
- **Anti-pattern** — name the boring attractor in this domain. Ask: *what is the obvious, inert thing someone would say from this native domain?* That is the anti-pattern. ("Maps are political." "Old maps are beautiful." "Nature-inspired algorithm." "Fantasy map generator.") The stance must route around it.
- **Seed prompt** — write the verbatim instruction. It must: name James's real tools, state the forced landing inside the prompt, and embed the anti-pattern as an explicit constraint ("don't write an essay about X; produce a runnable Y").

## Registration

This is a **chat-side / claude.ai skill** (like `selfco-ingest`), not a Claude Code catalog skill. Two facts follow:

- **Git canonical:** this file, `core/.claude/skills/speculative-pass/SKILL.md`. It is NOT registered in `skill-loader/knowledge/skill-catalog.json` — chat-side skills aren't catalog-listed (`selfco-ingest` isn't either).
- **Runtime is the cloud:** to go live it must be uploaded to claude.ai (Settings → Capabilities → Skills). Editing this file updates the git copy only; re-upload to deploy.
