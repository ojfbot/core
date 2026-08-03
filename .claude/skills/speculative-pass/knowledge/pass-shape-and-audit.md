Reference for `speculative-pass` auditing and running: workflow steps 4–6 in detail, the PASS shape, the skill-level anti-patterns, and the map-stack self-test.

## Workflow detail — steps 4–6

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
