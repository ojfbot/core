---
name: speculative-pass
description: "Generate a fleet of speculative research sub-agents pointed at one of James's subsystems, each entering from an oblique angle he wouldn't reach from his default stance, yet forced to land on something buildable on his actual substrate. Takes James's core for the target area, a target subsystem, an orthogonality setting, and a fleet size n; emits n disjoint stances (native domain / forced landing / anti-pattern / seed prompt), optionally runs k of them inline as sample passes, and writes a handoff doc so the un-run stances can be spawned later. Use whenever James says \"speculative pass,\" \"point a fleet at X,\" \"attack X obliquely,\" \"weird agents on X,\" \"orthogonal angles on X,\" \"generate stances for X,\" or wants research sub-agents that diverge instead of converging on generic advice. The harness is the asset; the subsystem is disposable — this skill makes the map-stack fleet reusable across any subsystem."
---

###### speculative-pass
A generator. Given (James's core, a target subsystem, an orthogonality setting, a fleet size **n**), it emits **n** research *stances* — each a sub-agent that thinks in a domain that is NOT James's, forced to land on something he can build on his real substrate, guarded by an anti-pattern that keeps it from collapsing into generic advice. Optionally runs some inline; always leaves a handoff doc for the rest.

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

## Workflow

### 1 — Assemble the core

Get James's core for the target area. If he pasted it, use it. Otherwise pull it from selfco — the vault is the canonical store of what James's world *is*. A stance is only as good as the substrate it's told to land on; a thin or guessed core produces stances that propose things he already has or can't build.

### 2 — Generate n disjoint native domains, calibrated to the knob

Pick `n` native domains, each outside James's core, calibrated to the orthogonality setting (adjacent for `adjacent-weird`, far for `off-axis`/`maximally-wild`, mixed for `spread`). **They must be disjoint** — no two stances may share a source domain, or parallel runs will rephrase one idea instead of diverging. Disjointness of *domains*, not of landing surface: several stances can land on the same substrate (GDAL, PMTiles) as long as they *think* in different worlds.

For the map stack, the five were: long-term data preservation / format archaeology · investigative journalism + intelligence (what a map hides) · biology / growth-and-routing models · pre-digital cartographic craft · fiction / invented worlds.

### 3 — For each domain, derive the other three parts

- **Forced landing** — name the substrate it must reduce to, at the strictness the knob sets. "Every speculation reduces to an artifact James can produce from his current pipeline and store the way he stores selfco."
- **Anti-pattern** — name the boring attractor in this domain. Ask: *what is the obvious, inert thing someone would say from this native domain?* That is the anti-pattern. ("Maps are political." "Old maps are beautiful." "Nature-inspired algorithm." "Fantasy map generator.") The stance must route around it.
- **Seed prompt** — write the verbatim instruction. It must: name James's real tools, state the forced landing inside the prompt, and embed the anti-pattern as an explicit constraint ("don't write an essay about X; produce a runnable Y").

### 4 — Convergence + anti-pattern audit (do not skip)

Before emitting, check the four skill-level anti-patterns below. Any failure means regenerate that stance, not ship-with-a-caveat. This step is the reason the fleet diverges.

### 5 — Optionally run k stances inline as sample passes

If James wants sample passes, run `k` of them now, each producing a PASS in the shape below. Prefer the stances *least* connected to his core (they prove the method hardest). The map-stack session ran 3 of 5 and left the 2 most art-connected for the first live Claude Code session, so the handoff carried live work.

### 6 — Emit the handoff doc + optionally stage to selfco

Write a handoff doc for the un-run stances in the `.handoff/` bead shape (frontmatter + mission + the un-run stances verbatim + a "done when"). If James wants it captured, stage the whole fleet to the selfco Notion inbox via the `selfco-ingest` pattern (chat-side write path; the promoter lands it on disk). Each un-run stance can also be staged as its own inbox row so it's individually spawnable later — that is how Agents 4 and 5 of the map-stack fleet were run.

## The PASS shape — what running a stance produces

Every sample pass follows one shape, abstracted from all five map-stack passes. Hold to it; it is what makes a pass *pursuable* rather than a riff.

1. **`Find:` or `Build:` headline** — one sentence. Use **`Find:`** when the stance locates an existing capability James didn't know maps to his problem (Archivist → PMTiles; Morphologist → Physarum routing). Use **`Build:`** when it specifies a new artifact or pipeline to construct (Forensic → contested-zone step; Historian → line-weight pass; Narratologist → synthetic-state forge).
2. **Substrate verification** — name the real tools and check them, don't assert them. "PMTiles is a single-file content-addressed archive… verified: documented Protomaps format." Real syntax, real field schemas, real recipes (`ogr2ogr → tippecanoe → .pmtiles`).
3. **The adjacent-weird move** — name, explicitly, the oblique binding James wouldn't reach from his default stance. This is the payoff. (Archivist: bind PMTiles to the bead-as-provenance pattern so the map carries its own lineage. Narratologist: make the universe-closing-device legible to machines, illegible to humans.)
4. **Speculation flag** — partition honestly into **confident** (verified substrate) / **confident-but-custom** (real tools, but you wire it yourself) / **speculative-but-grounded** (plausible, not verified off-the-shelf). Never let a "buildable now" hide a custom build.
5. **Buildable verdict** — `Buildable now:` (or `Buildable with effort:`) + the concrete tool chain + a one-line tagline (`Pursuable, verified, oblique.`).

## Skill-level anti-patterns — do not let the skill

These are the failure modes of the *generator itself*. The convergence audit (step 4) exists to catch them.

- **Native domain inside James's core** — no weirdness; the stance proposes what he'd reach anyway. (If the domain is "better tile caching," it's inside core. Reject.)
- **Dropping the anti-pattern field** — the whole fleet collapses to generic advice. The anti-pattern is load-bearing; a stance without one is not done.
- **Stances that can't land** — essays, not buildables. Forbidden unless `orthogonality = maximally-wild`, where landing is explicitly optional.
- **Convergence** — non-disjoint native domains. If two stances think in the same world, parallel runs just rephrase one idea. Regenerate until the domains are disjoint.

## Gotchas

- **Skipping the core-retrieval step is the highest-leverage failure, not the convergence audit.** A guessed `core` poisons every downstream stance — they land on substrate James doesn't run or already has, and no amount of disjointness fixes that. When he doesn't hand you the core, `/vault query` it from selfco *before* generating; stances built on a thin core fail silently because they still *look* well-formed.
- **The orthogonality knob's two jobs drift apart under pressure.** It is tempting to pull wild native domains while keeping a strict forced landing (because strict feels safe) — that pairing produces nothing buildable. Wild domains demand a relaxed/bridging landing; adjacent domains demand a strict one. If your output is all essays or all generic advice, you decoupled the knob.
- **Disjointness is about the native domain, not the landing surface.** Five stances all landing on PMTiles/GDAL is fine and expected; five stances all *thinking* in "data infrastructure" is convergence. Check where each agent reasons from, not where it terminates — the easy mistake is to wave through near-identical domains because their seed prompts name different tools.
- **A `Buildable now:` verdict that hides a custom build is a lie the PASS shape exists to prevent.** When you run sample passes, partition honestly into confident / confident-but-custom / speculative-but-grounded. The seductive move is to call a thing "buildable now" because the *components* exist off-the-shelf even though James has to wire them himself — that's confident-but-custom, and mislabeling it burns the method's credibility.
- **The handoff doc is the deliverable even when you run zero stances inline.** The value is divergence spawned in parallel later, not passes cycled in one session. Don't treat un-run stances as leftovers — stage each to the selfco inbox as an individually spawnable row, or the fleet's reusability (the entire point) evaporates.

## Self-test — regenerate the map-stack fleet

The skill is correct iff, from `core = {geospatial eng / agentic CLI pipelines / data-journalism-via-agents / Airstream + fabrication / bead-as-provenance}`, `target = "map stack"`, `orthogonality = adjacent-weird`, `n = 5`, it regenerates this fleet (native domain → anti-pattern → buildable landing):

| # | Stance | Native domain | Anti-pattern (the boring attractor) | Lands on |
|---|---|---|---|---|
| 1 | Archivist | long-term data preservation / format archaeology | "back up your data to the cloud" | PMTiles single-file + bead-as-provenance in metadata |
| 2 | Forensic Cartographer | investigative journalism / intelligence — what a map hides | "maps are political" | `ST_SymDifference` on POV layers → contested-zone overlay |
| 3 | Morphologist | biology / growth + routing models | "nature-inspired algorithm" as decoration | Physarum solver over a GRASS cost surface → redundant-route mesh |
| 4 | Historian-of-Craft | pre-digital cartographic technique | "old maps are beautiful" (aesthetic nostalgia) | engraver's line-weight ladder as GDAL→SVG pass = intaglio bite-time spec |
| 5 | Narratologist | fiction / invented worlds | "fantasy map generator" | synthetic-state forge: fiction as schema-valid CShapes/NaturalEarth geodata |

If a regeneration produces five stances whose native domains are disjoint, each carrying an anti-pattern that names its domain's boring attractor, each landing on James's real substrate — the structure held. If any two collapse together, or any lacks an anti-pattern, the generator failed step 4.

## Registration

This is a **chat-side / claude.ai skill** (like `selfco-ingest`), not a Claude Code catalog skill. Two facts follow:

- **Git canonical:** this file, `core/.claude/skills/speculative-pass/SKILL.md`. It is NOT registered in `skill-loader/knowledge/skill-catalog.json` — chat-side skills aren't catalog-listed (`selfco-ingest` isn't either).
- **Runtime is the cloud:** to go live it must be uploaded to claude.ai (Settings → Capabilities → Skills). Editing this file updates the git copy only; re-upload to deploy.

## Postflight

After generating a fleet:
> Offer to stage it to selfco via `selfco-ingest` so the un-run stances are individually spawnable later.

After running sample passes:
> Hand the un-run stances' seed prompts to a real Claude Code / Cowork session — the value is divergence, so run them in parallel, not one session cycling stances.
