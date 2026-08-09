# asset-foundry Architecture

> Display name: **Asset Foundry** (repo: ojfbot/asset-foundry, package: asset-foundry)

Source: https://github.com/ojfbot/asset-foundry

## Overview

An AI-driven Blender asset pipeline. World manifest in YAML → LangGraph orchestrator with four narrow sub-agents → Blender (subprocess; MCP/TCP path stubbed) → deterministic Validator → glTF binary. Outputs are consumed by [`beaverGame`](https://github.com/ojfbot/beaverGame) and are designed to be reusable across any future stylized low-poly game project.

**Not a Frame sub-app.** Build-time only — no runtime AI ships anywhere.

## The graph

```
manifest/world.yaml              ← Zod-validated single source of truth
       │
       ▼
 WorldDesigner    (only writer to manifest; no Blender access)
       │
       ▼
 AssetSculptor    (LLM → bpy script; offline path uses fixtures/<id>.py)
       │
       ▼
 MaterialArtist   (palette → material plan; no geometry mods)
       │
       ▼
 SceneAssembler   (spawns Blender, exports .glb)
       │
       ▼
 Validator        (deterministic TS — tri budget, summary JSON, writes .validation.json)
       │
       ▼
 dist/<id>_v1.glb + dist/<id>_v1.validation.json
       │
       ▼ (auto-synced)
 ../beaverGame/public/assets/
```

Each sub-agent has a strict, non-overlapping tool surface. See `decisions/adr/0004-narrow-subagent-boundaries.md`.

## File layout

```
manifest/
  world.yaml                  single source of truth (1 biome, 5 props as of Phase 0)
  schema.ts                   Zod schema; the contract WorldDesigner cannot violate
  load.ts                     parse + validate + findProp helpers
src/orchestrator/
  state.ts                    LangGraph Annotation state (pattern from cv-builder)
  graph.ts                    state machine wiring the four nodes + Validator
  llm.ts                      Anthropic SDK wrapper; prompt caching enabled
  parsing.ts                  extract bpy + FOUNDRY_SUMMARY JSON
  nodes/
    world-designer.ts         selects a prop entry; ONLY agent that may write manifest
    asset-sculptor.ts         emits bpy script (or uses fixtures/ when offline)
    material-artist.ts        plans palette → material slot mapping
    scene-assembler.ts        spawns Blender, exports .glb
src/blender/mcp-bridge.ts     subprocess Blender; MCP/TCP path opt-in via FOUNDRY_USE_MCP=1
src/validator/index.ts        deterministic, NOT an agent
fixtures/                     hand-scripted bpy used when ANTHROPIC_API_KEY is unset
  _lib.py                     shared helpers (sRGB→linear, FLOAT_COLOR + active-color, KHR_materials_unlit material)
  birch_sapling.py            5 fixtures total
  ground_pond_meadow.py
  water_pond.py
  sky_dome.py
  beaver_basic.py
scripts/
  gen-asset.ts                CLI entry; runs the LangGraph one-shot
  validate.ts                 schema + every dist/*.validation.json
  validate-manifest.ts        Zod-only manifest check (CI gate)
  install-blender-mcp.sh      verify Blender LTS pin + addon
.blender-version              pinned LTS (ADR-0002; currently 4.0.2)
dist/                         committed validated .glbs (the artefact contract)
.claude/skills/
  add-prop/                   local skill: scaffold a new manifest entry + fixture
  audit-budgets/              local skill: tri-budget reconciliation
.claude/SKILLS.md             categorises core skills
decisions/adr/                5 ADRs (local-only orchestrator, Blender pinning, etc)
```

## §4.4 Python contract (every bpy script must)

1. Open with a deterministic seed (`random.seed(hash(prop_id) & 0xFFFF)`).
2. Operate on a fresh empty scene (`bpy.ops.wm.read_factory_settings(use_empty=True)`).
3. Produce one named root object whose name is the `prop_id`.
4. Stay at or under the manifest's `tri_budget`.
5. End with `bpy.ops.export_scene.gltf(filepath=OUT_PATH, …)`.
6. Print exactly one line: `FOUNDRY_SUMMARY {"asset_id":..., "tri_count":..., "bounding_box":{...}, "material_slots":[...]}`.

The Validator parses #6 and gates on #4. Failure routes structured rejection back into the orchestrator state.

## Sub-agent contract (ADR-0004)

| Sub-agent | Reads | Writes | External calls |
|---|---|---|---|
| WorldDesigner | game design notes | `manifest/world.yaml` | (no Blender) |
| AssetSculptor | one prop entry | `dist/scripts/<id>_v1.py` (online) or `fixtures/<id>.py` (offline) | Anthropic |
| MaterialArtist | palette + sculpted asset | material plan in state | Anthropic, Poly Haven (Phase 2+) |
| SceneAssembler | sculpt + materials | `dist/<id>_v1.glb` | Blender (subprocess or MCP) |
| Validator | summary JSON, manifest | `dist/<id>_v1.validation.json` | (deterministic, no LLM) |

## Blender gotchas (committed to memory)

- **`bm.loops.layers.color.new()` (BYTE_COLOR) is silently dropped by the glTF exporter.** Use `bm.loops.layers.float_color.new()` (FLOAT_COLOR domain).
- **`bm.to_mesh()` does not promote a colour layer to active.** Without `mesh.color_attributes.active_color`, the exporter writes no COLOR_0 even with `export_colors=True`. `_lib.py:_activate_color` handles this.
- **Vertex colours in glTF are linear by spec.** Author in sRGB and let `_lib.py:srgb_to_linear` convert before assignment, otherwise Three.js renders washed-out tones.
- **Blender's glTF exporter only writes a material as `KHR_materials_unlit` if the node setup is Emission-only.** Anything with a Principled BSDF gets exported as standard PBR — even for unlit-by-design props. See `_lib.py:make_unlit_vertex_color_material`.
- **`__file__` in a fixture script is the script path itself.** Fixtures `sys.path.insert(0, os.path.dirname(__file__))` before `from _lib import …`. Don't copy fixtures into other directories before running.

## Reuse target

This pipeline is built generically so future games can register their own manifest. The contract surface (manifest schema, §4.4 Python contract, validation JSON shape) is stable; the orchestration code is portable. To consume from a new game:

1. Author a `world.yaml` matching `manifest/schema.ts`.
2. Add fixtures or rely on the LLM path.
3. Point `gen-asset.ts`'s sync target at the new game's `public/assets/`.

## Available skills

Full ojfbot skill tree is symlinked at `.claude/skills/`. Useful here: `/scaffold`, `/adr`, `/validate`, `/spec-review`, `/add-prop` (local), `/audit-budgets` (local). See `.claude/SKILLS.md`.

## ADRs (cross-reference)

- ADR-0001 Local-only orchestrator; no runtime AI
- ADR-0002 Pin Blender LTS; validator refuses drift
- ADR-0003 Hand-scripted bpy for hero props (Hyper3D reference-only)
- ADR-0004 Narrow sub-agent boundaries are first-class
- ADR-0005 Reuse cv-builder's LangGraph node + state pattern

Cross-cutting decisions (asset format, repo split, TS-everywhere) live in `../beaverGame/decisions/adr/`.
