# beaverGame Architecture

> Display name: **Cozy Beaver** (repo: ojfbot/beaverGame, package: beaver-game)

Source: https://github.com/ojfbot/beaverGame

## Overview

A cozy 3D beaver simulator. Vanilla TypeScript + Vite + Three.js — no React, no Module Federation, **not a Frame sub-app** (see beaverGame ADR-0006). The client loads validated `.glb` artefacts produced by the sibling repo [`asset-foundry`](https://github.com/ojfbot/asset-foundry) under a dev-mode validation tripwire.

## Repo split

This is half of a two-repo system:

| Repo | Cadence | Stack |
|---|---|---|
| `beaverGame` | Runtime / web client | Vite + TS + Three.js, no AI at runtime |
| `asset-foundry` | Build-time / pipeline | LangGraph + Anthropic + Blender + bpy |

The contract is the validated `.glb` artefact + sibling `<asset>.validation.json`. See `decisions/adr/0007-repo-split-beavergame-asset-foundry.md`.

## File layout

```
src/main.ts                 22-line bootstrap
src/scene/
  bootstrap.ts              renderer + camera + RAF lifecycle (lifted from landing/Hero)
  load-glb.ts               GLTFLoader wrapper; refuses unvalidated .glb in dev
  lighting.ts               IBL (currently no-op — unlit materials don't need it)
  materials.ts              MeshBasicMaterial(vertexColors) post-process
  world.ts                  composeWorld(scene): ground/sky/pond/scattered trees
  player.ts                 spawnPlayer(scene): WASD + 3rd-person follow camera
  types.ts                  ValidationManifest TS shape (mirrors foundry validator)
public/assets/              committed .glb + .validation.json (synced from foundry)
scripts/
  snap.ts                   Playwright headless screenshot + scene probe (the iteration loop)
  inspect-glb.ts            dump a .glb's geometry attributes & materials
  validate-assets.ts        consumer-side gate (every .glb has passing manifest)
.claude/skills/
  snap/                     local skill: visual iteration loop
  regen-asset/              local skill: trigger foundry pipeline
  <core-skill>/             symlinks from install-agents.sh
.claude/SKILLS.md           categorises core skills (apply / awareness / don't apply)
decisions/adr/              7 ADRs (renderer choice, asset format, repo split, etc)
```

## Key non-Frame deviations

This repo borrows ojfbot tooling (skills, ADRs, hooks via `core/scripts/install-agents.sh`) but skips the cluster's web-app pattern. The deviations:

- **No React, no Carbon, no Redux.** Vanilla Three.js with a thin TS class around the renderer.
- **No Module Federation.** Standalone Vite app; the bundle is a static glb of HTML+JS+assets.
- **No frame-agent gateway.** No runtime AI of any kind ships in the client.
- **Local-skill architecture in `.claude/SKILLS.md`** — the core skill tree gets symlinked in but most Frame-shaped skills (`/scaffold-frame-app`, `/frame-dev`, etc) are documented as not-applicable. Local skills (`/snap`, `/regen-asset`) live as real dirs under `.claude/skills/<name>/` and survive `install-agents.sh` reinstalls.

## Render-time gotchas (learned the hard way)

- **`tsconfig.json` has `"noEmit": true`** and `pnpm build` runs `vite build` only. An earlier `tsc -b` left `.js` shadow files in `src/` that Vite's resolver picked first, freezing the runtime on stale class definitions.
- **`THREE.WebGLRenderer.toneMapping = THREE.NoToneMapping`** — ACES washes the unlit vertex-colour palette to near-white.
- **Vite's SPA fallback returns 200/text/html for missing public assets.** Any `fetch` against `/assets/*.<ext>` should sniff Content-Type before parsing.
- **Blender +Y forward → glTF -Z forward.** Camera offset and WASD direction in `player.ts` use negative Z signs accordingly.

## Phase plan (from the v0.1 planning doc)

| Phase | Exit criterion | Status |
|---|---|---|
| 0 — Spike | A `.glb` of a tree appears in a browser, lit by an HDRI | ✅ shipped 2026-04-27 (with one extension: a basic world spawn — beaver, pond, scattered trees) |
| 1 — Manifest + Validator | `pnpm validate-assets` runs in CI and gates merges | not started |
| 2 — Sub-agents v1 | `pnpm gen-asset` produces a passing artefact unattended in 3/5 runs | partially exercised (offline path works; LLM path not yet end-to-end) |
| 3 — Playable beaver | A stranger plays for two minutes without a tutorial | partially: WASD + follow cam exist; no terrain bounding, no game loop |
| 4 — Building loop | Player can build a recognisable dam | not started |
| 5 — Deployment + polish | Shareable URL, 60fps M1 / 30fps low-tier | not started |

## Available skills

The full ojfbot skill tree is symlinked at `.claude/skills/`. Useful here: `/scaffold`, `/adr`, `/validate`, `/snap` (local), `/regen-asset` (local). See `.claude/SKILLS.md` for the full categorisation.

## ADRs (cross-reference)

- ADR-0001 Three.js vanilla over R3F
- ADR-0002 WebGL2 ship, WebGPU later
- ADR-0003 TS everywhere; Python only as build artefact
- ADR-0004 glTF .glb + KHR_materials_unlit + vertex colours
- ADR-0005 Plain TS classes + event bus + localStorage
- ADR-0006 Standalone repo (NOT a Frame sub-app for v0)
- ADR-0007 Repo split with asset-foundry
