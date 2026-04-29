# Research spike: game-engine choice for ojfbot's web-native games

Date: 2026-04-28
Author: Claude (Opus 4.7) for James / ojfbot
Status: Research output (informs decision; doesn't make it)

---

## TL;DR

**Recommendation:** **Babylon.js** (Apache 2.0, web-native, TypeScript-first, batteries-included), with three independent community MCP servers already wrapping its scene API for AI agents. Migrate `beaverGame` to it as v0.2.

**Runner-up:** Stay on **Three.js + react-three-fiber + @react-three/rapier + drei + zustand** — same MIT license, same web stack, lowest migration cost from the current `beaverGame` code. Build a thin custom MCP layer (1–3 days) to expose your scene/world state to Claude. Choose this if you want to keep the ~2,500 lines of existing game logic intact.

**Why not PlayCanvas:** It has the only *first-party* MCP server, which is the most attractive fact in the field. But that MCP server drives the **cloud-hosted Editor**, not the engine runtime. PlayCanvas's main differentiator (the in-browser visual editor) requires a proprietary cloud backend; using PlayCanvas engine-only loses the very thing that makes it special. The cloud-lock-in tension is incompatible with your stated local-first preference.

**Why not Godot / Bevy / Unity / Unreal:** All eliminated by the hard web-native requirement. Godot's web export works but is heavy; Bevy WASM is maturing but not robust enough for v0; Unity/Unreal web exports are poor.

---

## Context

You asked: "what is our 'game engine'?" and "can I get onto a more standard one that is open + well-supported by MCP and public standards?"

Today's stack:
- `beaverGame`: Vite + raw `three@0.183` + TypeScript. ~2,500 lines of hand-written game logic in `src/scene/` (hydrology, damming, digging, felling, hauling, collision, bounds, terrain). No game-engine library, no physics library, no state management.
- `asset-foundry`: LangGraph + Anthropic + Blender + bpy. Produces validated `.glb` artifacts that beaverGame loads.

Three.js is a **renderer**, not a game engine. You've been hand-rolling everything an engine would give you (physics, scene, state, animation, input, persistence). That's productive work — and it's also exactly the kind of work an engine eliminates.

The decision is shaped by three answers you gave during alignment:
1. **Web-native: HARD** (must run in browser, no download).
2. **beaverGame logic: throwaway** (~2,500 lines is acceptable to discard for the right engine).
3. **MCP: must-have today** (engine-runtime AI control is the point of this exercise).

---

## Section 1 — Orientation: "what is a game engine?"

Since you're new to gamedev, the parts:

| Layer | What it does | Three.js today | Babylon.js | PlayCanvas |
|---|---|---|---|---|
| **Renderer** | WebGL/WebGPU draws pixels | ✓ (this is Three.js) | ✓ (own renderer) | ✓ (own renderer) |
| **Scene graph & editor** | Hierarchical tree of nodes; visual editor to lay out scenes | Tree only; no editor | Tree + Inspector v2 (runtime tweaker) | Tree + cloud Visual Editor |
| **Physics** | Rigid bodies, collisions, joints, character controllers | ✗ (you wrote `collision.ts`/`bounds.ts`) | ✓ Havok WASM built-in | ✓ Ammo (Bullet) built-in |
| **Animation** | Skeletal, blend trees, retargeting | Bare bones | Animation groups + retargeting (9.0) | State graph + retargeting |
| **State / ECS** | World state, entity-component-system | ✗ (you wrote `damming.ts`/`hydrology.ts`/etc.) | Class-based, with `Observable` patterns | ECS-first via Script Components |
| **Input** | Keyboard, mouse, gamepad, touch | ✗ (you wrote it in `player.ts`) | ✓ Action Manager | ✓ first-party |
| **Save / persistence** | Scene serialization + reload | ✗ | ✓ `SceneSerializer` | ✓ via Editor |
| **Asset pipeline** | Authoring → runtime | `asset-foundry` is yours | glTF/USDZ first-class | glTF/USDZ first-class |
| **Build / packaging** | Bundle for web/desktop/mobile | Vite (yours) | Vite/webpack | Self-host or PlayCanvas-hosted |

Your current Three.js stack covers ~2 layers (renderer + bare scene graph) out of 9. An engine like Babylon or PlayCanvas covers ~7. The gap is exactly the work you've been doing by hand.

---

## Section 2 — Candidate evaluation

### 2.1 — Babylon.js (Apache 2.0)

**Stable version (April 2026):** 9.4.1 (9.0 announced March 2026). License: Apache 2.0. ~20.9k GitHub stars, ~weekly releases.

**Strengths for this project:**
- **First-party TypeScript** — engine source is TS; types ship in `@babylonjs/core` directly, no `@types/*` indirection. Matches your stack precisely.
- **Havok WASM physics built-in** — MIT-licensed, claimed up to 20× faster than the legacy Ammo plugin. Cannon and Ammo plugins still available as fallback.
- **Inspector v2** (9.0) — service-oriented, React UI, opens via `scene.debugLayer.show()`. Exposes entire scene graph at runtime; supports custom inspectable properties on meshes (`inspectableCustomProperties`). The kind of thing that would have saved you hours debugging hydrology.
- **glTF 2.0 native loader; USDZ export** added in 8.0 (April 2025).
- **Animation, particles, action manager, scene serialization** all first-party.
- **9.0 features:** Clustered Lighting + area lights with emission textures (cozy-sim scenes with lanterns, water-shine, stained glass benefit).
- **WebGPU stable; WebGL2 fallback automatic.**

**Weaknesses:**
- **No native OpenUSD loader** — only USDZ *export*. If you author in USD, you still convert to glTF.
- **Bundle size is heavy by default.** Tree-shaken minimum ~700 KB; real apps land 1.9–3.6 MB. Tree shaking requires per-file imports — easy to accidentally pull the whole engine.
- **Smaller community than Three.js.** Discord ~568 members (vs. Three.js's tens of thousands). Forum is the primary support channel and is responsive.
- **Production cozy-sim catalog is thin.** Official games page lists Minecraft Classic, Temple Run 2, Shell Shockers, Sidus Heroes — no recent showcase cozy-sim titles in 2024–2026.
- **No documented Module Federation integration.** Mounting as an MF remote should work (it's a JS module + canvas), but you'd be writing the playbook.

**MCP / agent-control story:**
**Three independent community MCP servers exist** — strongest "today" support outside PlayCanvas:
1. `pandaGaume/mcp-for-babylon` (March 2026, Apache 2.0) — most ambitious. Camera control with easing/orbit/path, light CRUD, mesh show/hide/animate, snapshots, scene picking. Multi-engine (also CesiumJS). UMD bundle + Node WS tunnel; SSE and Streamable HTTP transports.
2. `davidvanstory/babylonjs-mcp` — simpler. `create_object` / `delete_object` / `select_object` / `list_objects` over stdio + WS to a browser app.
3. `immersiveidea/babylon-mcp` — indexes Babylon's docs, API, and source via LanceDB semantic search. Useful for *agents writing Babylon code*.

None are first-party from the Babylon team, but the runtime API (`scene.getMeshByName`, `MeshBuilder.CreateBox`, `scene.metadata`) is clean enough that "add a tree at X,Y,Z" is a one-liner.

### 2.2 — Three.js + libraries (the "compose your engine" path)

The 2026 canonical web stack on top of Three.js. All MIT, all maintained by [Poimandres](https://pmnd.rs/) (single-vendor coherence).

| Library | Role |
|---|---|
| `@react-three/fiber@9.6.0` | React renderer for Three.js. Declarative JSX, hooks (`useFrame`, `useThree`), pairs with React 19. |
| `@react-three/drei` | Helper grab-bag: `OrbitControls`, `useGLTF`, `Sky`, `Environment`, `Instances`, `BVH`, `Stage`, `Detailed`. |
| `@react-three/rapier` | Wrapper around Dimforge's Rust/WASM Rapier engine. Declarative `<RigidBody>`, `<Physics>`. Character controllers + joints mature in late 2025. 2026 roadmap: GPU rigid bodies via rust-gpu. |
| `zustand` | ~3 KB top-down store; subscribe in `useFrame` without re-render churn. Better fit than Jotai for interconnected world state (hydrology cells, agents, inventories). |

Non-React equivalents: **Threlte** (Svelte; mature; ships its own Rapier + Theatre.js bindings) and **TresJS** (Vue; smaller community). For staying in vanilla TS without React, **enable3d** and **WesUnwin/three-game-engine** exist but lack gravitational pull.

**What you still don't get vs. a real engine:**
- **No visual scene editor.** `threejs.org/editor` exists but is fragile; not a prefab system.
- **No prefab/instance system.** Godot's "save subtree as scene, edit once, propagates everywhere" has no R3F equivalent.
- **No animation editor / timeline.** Theatre.js exists but is a separate decision.
- **No save/load primitives.** Roll-your-own JSON.
- **No packaging.** No "export to itch.io" button.
- **No first-party diegetic UI.** `three-mesh-ui` is community.

**Strengths for this user:**
- Stack is MIT and Poimandres-coherent — one vendor, one paradigm.
- Existing 2,500 lines of Three.js logic port directly; R3F lets you drop down to imperative refs anywhere.
- Rapier removes the largest "yak" in cozy-sim work.
- Largest 3D-web community by far; Stack Overflow / Discord / Discourse coverage is unmatched.

**Weaknesses:**
- You stay responsible for engine-shaped concerns: scene format, prefab semantics, save/load, content pipeline.
- React adds ~40 KB and a reconciler your hot loop doesn't need.
- For tight ECS-heavy sims, vanilla Three.js + a hand-rolled tick is still faster than R3F.

**MCP / agent-control story:** Community projects only, no Anthropic involvement. `locchung/three-js` (PulseMCP) provides WebSocket-based scene manipulation. `deya-0x/threejsmcp` and `three-js-mcp` wrap Three.js source/docs for retrieval. All small, single-maintainer, low-star. Status: **experimental, no canonical implementation.** Building a v1 yourself is a one-day spike.

### 2.3 — PlayCanvas (MIT engine; cloud Editor)

**Stable version (April 2026):** Engine v2.18.0. License: MIT (engine). Editor frontend open-sourced (MIT) July 2025; **Editor backend remains proprietary/cloud**. ~14.8k engine GitHub stars.

**Strengths:**
- **Best-in-class web runtime.** Dual WebGL2 + WebGPU; tree-shakable ES module.
- **Batteries included.** Bullet-via-Ammo physics, hardware-accelerated particles, positional WebAudio, animation/state-graph, ECS scene graph, PCUI for GUI.
- **First-party MCP server** — `playcanvas/editor-mcp-server` (MIT, v0.1.0 Jan 2026). Drives the Editor from Claude Desktop or Cursor. Tool surface: entity CRUD, components, assets/materials, scene settings, store browsing, viewport screenshots.
- **glTF 2.0 native** (Draco, KHR_materials_unlit, morph targets); USDZ export for iOS AR.
- **Official React wrapper** `@playcanvas/react`.
- **Production track record:** Disney, King, Miniclip, Zynga, Snap, BMW, Mozilla.

**Weaknesses:**
- **Editor is cloud-only in practice.** Frontend is OSS but the backend service that powers it is not — "self-hosting" is unsupported. Engine-only local dev works fine but loses the Editor (the main reason to pick PlayCanvas over Three.js).
- **The MCP server drives the Editor, not the engine.** For engine-only projects, the MCP value largely disappears unless you build your own runtime-API wrapper — which is the same situation as Three.js.
- TypeScript supported but not idiomatic. Legacy `pc.createScript` attribute system is the documented path.
- WebGPU still flagged Beta as of v2.x.

**MCP / agent-control story:** As above — strong, but **only if you accept the cloud Editor**.

### 2.4 — Eliminated candidates (web-native hard requirement)

- **Godot:** Excellent open-source engine; web export exists but is heavy (~25 MB initial download for empty project, no first-party browser-runtime focus). Kills the "shareable URL" goal.
- **Bevy:** Modern Rust ECS engine; WASM target maturing but not robust for v0 — text rendering, audio, asset hot-reload all inconsistent on web.
- **Unity:** Source-available, not OSI open-source; recent licensing controversy. Web export (Unity Web) is poor — large bundle, cold-start latency, mobile browser unreliable.
- **Unreal:** Source-available; web (Pixel Streaming) requires a server farm — not actually "web-native."
- **Cocos Creator:** Web export works but mobile/2D focused; English documentation thinner; less synergy with TypeScript-first stack.
- **A-Frame:** WebXR-focused; declarative HTML model is too far from a game-engine for a beaver simulator.

---

## Section 3 — MCP-for-game-engines landscape (April 2026)

This is the load-bearing chapter for the recommendation.

### 3.1 — Anthropic's posture

- **First-party Blender MCP shipped April 28, 2026** (today, as I write this) — part of a 9-tool creative-app launch. Exposes Blender's full Python API for natural-language scene authoring, debugging, batch automation. Anthropic also joined the Blender Development Fund as Corporate Patron alongside Netflix/Epic/Wacom.
- **No first-party game-engine MCPs.** Anthropic's creative-tool wave is *content-creation*, not game runtimes. The 10,000+ public MCP servers Anthropic reports are dominated by SaaS/dev-tool integrations.
- **The pattern to expect:** Anthropic publishes the standard; engine vendors or community publish servers. PlayCanvas being first-party-from-the-engine-side, not from Anthropic, is the model.

### 3.2 — Engine MCP availability per candidate

| Engine | MCP support | Quality |
|---|---|---|
| **Blender** (asset pipeline) | First-party Anthropic, 1 day old | Production (per Anthropic) |
| **PlayCanvas** | First-party engine team | Most mature non-Anthropic engine MCP — but Editor-tied |
| **Babylon.js** | 3 community servers (pandaGaume, davidvanstory, immersiveidea) | Active; one is comprehensive |
| **Three.js** | Community single-maintainer (locchung, deya-0x) | Experimental |
| **Godot** | Community (`bradypp/godot-mcp`) | Editor control + project execution + debug |
| **Unity** | Two competing community (`CoplayDev`, `CoderGamester`) | Neither Unity-official |
| **Unreal** | Community (`ChiR24/Unreal_mcp`) | Not Epic-official |

### 3.3 — Cost of building a custom MCP layer

**1–3 days for v1, 1–2 weeks for production-quality.** Multiple 2026 tutorials (mcpize, hackteam, freecodecamp, Microsoft Learn) converge on "first working MCP server in 20–30 minutes" using `@modelcontextprotocol/typescript-sdk`. The work is:
1. Define tool schemas (your scene/world API surface).
2. Implement handlers that mutate your runtime.
3. Wire stdio or HTTP transport.

For a beaverGame-like sim, your v1 MCP would expose verbs like `spawn`, `tick`, `inspect`, `serialize`, `setHydrologyCell`, `triggerDamming`. **A v1 is a one-day spike regardless of which engine you pick.**

### 3.4 — Critical implication

**Engine-runtime MCP is not a strong differentiator between candidates** because:
- Babylon's three community servers are useful but small projects.
- PlayCanvas's first-party server requires the cloud Editor, which conflicts with local-first.
- Building a custom MCP server for *any* engine is one day of work.

The MCP question reduces to: which engine's runtime API is cleanest for an MCP wrapper to call? Babylon.js wins here (clean OO API, first-party TypeScript, runtime introspection via Inspector). Three.js is also fine. PlayCanvas's Editor API is rich but its runtime API is shaped by ECS conventions.

---

## Section 4 — Scoring matrix

Higher = better. Out of 5 unless noted. **Bold = decisive in recommendation.**

| Criterion | Babylon.js | Three.js + libs | PlayCanvas |
|---|---|---|---|
| License & openness | 5 (Apache 2.0) | 5 (MIT all) | 4 (engine MIT, editor cloud) |
| **MCP / agent surface** | **5** (3 community servers) | 3 (custom build needed) | 3 (Editor-tied) |
| Web export quality | 5 | 5 | 5 |
| Standards (glTF/USDZ) | 5 | 4 (no native USDZ) | 5 |
| Built-in primitives | 5 (Havok, Inspector, anim, particles) | 3 (Rapier + libs) | 5 (Ammo, ECS, audio, GUI) |
| TypeScript fit | **5** (first-party) | 5 (first-party) | 3 (not idiomatic) |
| Migration cost (small criterion) | 3 | **5** (lowest) | 3 |
| Community size | 3 | **5** (largest 3D-web) | 4 |
| MF integration | 3 (no docs, doable) | 4 (R3F mounts) | 3 (cloud lock-in) |
| Learning curve | 4 | 3 (you compose it) | 4 |
| Cloud lock-in | 5 (none) | 5 (none) | 2 (Editor cloud) |
| **TOTAL** | **51 / 60** | 47 / 60 | 42 / 60 |

---

## Section 5 — Recommendation

### Primary: Babylon.js, with a custom MCP layer

**Rationale:**
- Web-native, Apache 2.0, TypeScript-first — matches every hard constraint.
- Three community MCP servers exist; the most ambitious (`pandaGaume/mcp-for-babylon`) is a real reference implementation. If those don't fit your needs exactly, building your own is 1–3 days.
- Built-in primitives eliminate the layer of work you're currently hand-rolling: Havok physics replaces `collision.ts` / `bounds.ts`; particle system replaces ad-hoc water/dust effects; animation groups/retargeting replaces hand-keyframed felling/dam-build sequences; Inspector v2 replaces the ad-hoc tweak UIs you'd otherwise build.
- Hydrology and damming logic translates one-to-one (raycasts, bounding boxes, voxel queries are math-portable).
- No cloud lock-in.

**The honest cost:** smaller community than Three.js (Discord ~568 vs. tens of thousands), bundle size is heavy by default (1.9–3.6 MB without aggressive tree-shaking), no major recent cozy-sim showcase titles. None of those are blockers; all are acceptable for a hobby/portfolio project.

### Runner-up: Three.js + R3F + Rapier + drei + zustand

**When to pick this instead:** If you want to *keep* the existing 2,500 lines of beaverGame code and grow into "engine-ish" rather than rewriting. The migration is not "throw it all away" — it's "wrap it in `<Canvas>`, replace `collision.ts` with `<RigidBody>`, replace state management with zustand, keep hydrology/damming as-is." Smaller migration, larger long-term ceiling on hand-rolled engine concerns.

**Trade-off:** You stay responsible for the engine-shaped layers (no Inspector, no built-in animation editor, no first-party MCP wrappers). You build the MCP server yourself (1–3 days).

### Why not PlayCanvas

Cloud-Editor lock-in is the hard pass. You explicitly want local-first, AI-augmented dev. PlayCanvas's MCP advantage evaporates in engine-only mode and reappears only if you accept the cloud — which conflicts with your stated workflow.

---

## Section 6 — Migration sketch (if you go Babylon.js)

Three sprints, ~3–4 weeks total.

### Sprint AF1 — `beaverGame` rewritten on Babylon.js (M, ~1 week)
- New repo or branch: `beaverGame-babylon`.
- Scaffold: Vite + `@babylonjs/core` + `@babylonjs/loaders` + `@babylonjs/havok`.
- Port `bootstrap.ts` → Babylon `Engine` + `Scene`.
- Port `world.ts` → `SceneLoader.Append` of glTFs from asset-foundry.
- Port `player.ts` → `ArcRotateCamera` or `FollowCamera` + `ActionManager` for WASD.
- Sanity check: load 5 existing assets (birch_sapling, ground_pond_meadow, water_pond, sky_dome, beaver_basic), camera follows beaver, world renders.

### Sprint AF2 — Replace hand-rolled systems with Babylon primitives (M, ~1 week)
- `collision.ts` / `bounds.ts` → `PhysicsAggregate` + Havok rigid bodies.
- `materials.ts` → Babylon PBR materials (or `KHR_materials_unlit` for the cozy unlit look).
- `lighting.ts` → Babylon HemisphericLight + Clustered Lighting (9.0 area lights for lanterns).
- `particles.ts` → Babylon ParticleSystem (water splashes, dust on digging).
- Animations: convert hand-keyframed felling/hauling to AnimationGroups.

### Sprint AF3 — Port game logic + add MCP layer (L, ~1.5 weeks)
- `hydrology.ts` (the 365-line water sim) → port mostly verbatim; subscribe to `Observable` for tick events.
- `damming.ts` / `digging.ts` / `felling.ts` / `hauling.ts` → wrap as Babylon `Behavior` instances on entity meshes.
- **MCP server**: build `beavergame-mcp` as a local Node process. Tools: `inspect_world`, `set_hydrology_cell`, `spawn_tree`, `trigger_damming`, `set_player_position`, `screenshot`. Wraps `scene.getMeshByName` etc.
- asset-foundry Sprint D's Blender MCP integration becomes orthogonal — Blender authors `.glb`s, Babylon consumes them.

### What stays
- asset-foundry pipeline unchanged (it's the asset side).
- Validated `.glb` artifacts unchanged (Babylon loads them natively).
- The Frame OS surrounding (shell, frame-agent, gastown adoption) unchanged.

### What changes
- `beaverGame` package is rewritten end-to-end (~2,500 lines of TS replaced by a smaller surface).
- The R1 v0.1 spec for asset-foundry's editor (PR #92) is largely unaffected — it talks to glTF and consumer paths, both Babylon-compatible. The Three.js viewer code that R1 v0.1 wanted to reuse from `beaverGame/src/scene/bootstrap.ts` would instead come from the new Babylon-based `beaverGame`.

---

## Section 7 — Decision criteria for future re-evaluation

Use these "if X then Y" rules to revisit later if priorities shift:

1. **If you start needing a visual scene editor day-to-day** → revisit PlayCanvas (accept the cloud Editor) or Godot (accept desktop runtime, web export as a secondary target).
2. **If web-native ceases to be hard** (e.g. you decide a desktop binary is fine) → revisit Godot first; it's the strongest open-source full engine. Bevy if you're motivated to learn Rust.
3. **If MCP-at-engine-runtime becomes a sub-second-iteration loop need** rather than nice-to-have → all three candidates need a custom MCP layer; the question is which has the cleanest API. Babylon and Three.js are tied; PlayCanvas's Editor MCP will not help.
4. **If you decide to commit to a non-React UI stack** → swap R3F for Threlte (Svelte) or TresJS (Vue), or use Babylon (which is React-agnostic).
5. **If you ship 3+ games on the chosen engine** → revisit the Frame OS Game Library sub-app (R2 #93) story — at that point the catalog/launcher value is high enough to justify the integration.

---

## Section 8 — What this research did not verify

Honest gaps:

- **drei v11 WebGPU readiness** — in flight, not GA confirmed.
- **Threlte's Vue counterpart "TresJS"** — exists per ecosystem knowledge but did not surface clean 2026 docs in search.
- **Anthropic Blender MCP production stability** — one day old as of report date; treat as alpha.
- **Three.js MCP servers** are all single-maintainer hobby projects; treat as reference implementations, not dependencies.
- **No first-hand benchmark of bundle sizes** — Babylon's 700 KB / 1.9–3.6 MB range is from forum reports, not my measurement.
- **No first-hand benchmark of Havok vs Rapier performance** — both vendors claim leadership; for a cozy beaver sim either is more than enough.
- **MF integration of Babylon.js or PlayCanvas** — not documented anywhere; would be original work.
- **Cocos Creator** — quick-passed, not deep-dived. If the user wants me to verify it's a fair pass, that's a follow-up.

---

## Section 9 — Open questions for the user

1. **React vs vanilla TS for runner-up path.** If you go Three.js + libs, do you want React (R3F + drei + rapier-react) or vanilla TS (Three.js + bare Rapier + zustand-vanilla)? They're both viable; React is the documented canonical path.
2. **Sprint priority.** If you accept the Babylon recommendation, where does the 3-sprint migration sit relative to: R1 v0.1 (asset-foundry editor, PR #92 specs), Sprint M (workbench partition), Sprint Z (frame-agent vision)? Does game-engine migration jump the queue, slot in after, or run in parallel?
3. **Multi-game implications.** R2 (Game Library sub-app, #93) catalogs games. If beaverGame migrates to Babylon, future games likely follow. Do you want that as a soft expectation, or do you want each game to pick its own engine (which complicates the catalog)?

---

## Sources

### Babylon.js
- [Announcing Babylon.js 9.0 (March 2026)](https://blogs.windows.com/windowsdeveloper/2026/03/26/announcing-babylon-js-9-0/)
- [Babylon.js 8.0 — glTF, USDz, WebXR (April 2025)](https://blogs.windows.com/windowsdeveloper/2025/04/03/part-3-babylon-js-8-0-gltf-usdz-and-webxr-advancements/)
- [Babylon.js Apache 2.0 license](https://github.com/BabylonJS/Babylon.js/blob/master/license.md)
- [@babylonjs/havok npm](https://www.npmjs.com/package/@babylonjs/havok)
- [Inspector docs](https://doc.babylonjs.com/toolsAndResources/inspector)
- [MCP for Babylon — pandaGaume](https://forum.babylonjs.com/t/mcp-for-babylon-let-ai-agents-control-your-scene/62756)
- [davidvanstory/babylonjs-mcp](https://github.com/davidvanstory/babylonjs-mcp)
- [immersiveidea/babylon-mcp](https://github.com/immersiveidea/babylon-mcp)

### PlayCanvas
- [playcanvas/engine](https://github.com/playcanvas/engine)
- [Editor frontend open-sourced (July 2025)](https://blog.playcanvas.com/playcanvas-editor-frontend-is-now-open-source/)
- [playcanvas/editor-mcp-server](https://github.com/playcanvas/editor-mcp-server)
- [Self-hosting docs](https://developer.playcanvas.com/user-manual/editor/publishing/web/self-hosting/)

### Three.js + libraries
- [@react-three/fiber](https://www.npmjs.com/package/@react-three/fiber)
- [pmndrs/react-three-rapier](https://github.com/pmndrs/react-three-rapier)
- [Dimforge Rapier 2025-in-review / 2026 roadmap](https://dimforge.com/blog/2026/01/09/the-year-2025-in-dimforge/)
- [pmndrs/drei](https://github.com/pmndrs/drei)
- [State Management 2026 (Zustand vs Jotai)](https://dev.to/jsgurujobs/state-management-in-2026-zustand-vs-jotai-vs-redux-toolkit-vs-signals-2gge)
- [Threlte (Svelte+Three.js)](https://threlte.xyz/)

### MCP landscape
- [Anthropic Blender MCP launch (April 2026)](https://lushbinary.com/blog/claude-blender-mcp-connector-3d-modeling-guide/)
- [Three.js MCP (Loc Chung)](https://www.pulsemcp.com/servers/locchung-three-js)
- [Build MCP Server with TypeScript (2026)](https://mcpize.com/blog/mcp-server-typescript)
- [modelcontextprotocol TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)

### Cross-engine comparisons
- [Three.js vs Babylon.js vs PlayCanvas (2026)](https://www.utsubo.com/blog/threejs-vs-babylonjs-vs-playcanvas-comparison)
- [80.lv — Babylon.js cross-platform](https://80.lv/articles/babylon-js-a-web-first-game-engine-powering-cross-platform-experiences)
