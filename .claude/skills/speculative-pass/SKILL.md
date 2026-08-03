---
name: speculative-pass
description: "Generate a fleet of speculative research sub-agents pointed at one of James's subsystems, each entering from an oblique angle he wouldn't reach from his default stance, yet forced to land on something buildable on his actual substrate. Takes James's core for the target area, a target subsystem, an orthogonality setting, and a fleet size n; emits n disjoint stances (native domain / forced landing / anti-pattern / seed prompt), optionally runs k of them inline as sample passes, and writes a handoff doc so the un-run stances can be spawned later. Use whenever James says \"speculative pass,\" \"point a fleet at X,\" \"attack X obliquely,\" \"weird agents on X,\" \"orthogonal angles on X,\" \"generate stances for X,\" or wants research sub-agents that diverge instead of converging on generic advice. The harness is the asset; the subsystem is disposable — this skill makes the map-stack fleet reusable across any subsystem."
---

###### speculative-pass
A generator. Given (James's core, a target subsystem, an orthogonality setting, a fleet size **n**), it emits **n** research *stances* — each a sub-agent that thinks in a domain that is NOT James's, forced to land on something he can build on his real substrate, guarded by an anti-pattern that keeps it from collapsing into generic advice. Optionally runs some inline; always leaves a handoff doc for the rest.

> **Load `knowledge/stance-generation.md`** before generating anything — the four-part stance structure, the orthogonality-knob table, the I/O contract, generation guidance, and registration notes.

## What a stance is — the four-part structure

Pattern, stated once: **Native domain** (where it thinks) → **Forced landing** (so it builds, not lectures) → **Anti-pattern** (the boring attractor it must avoid) → **Seed prompt** (the verbatim sub-agent instruction). The anti-pattern is the load-bearing part — without it, all n stances collapse onto the same generic answer.

## The orthogonality knob — the key parameter

A single setting tunes how far off-core the native domains are pulled, and it simultaneously calibrates the strictness of the forced-landing clause. Take it as an explicit input; default to `adjacent-weird`.

## Workflow

### 1 — Assemble the core

If James didn't hand you the core, pull it from selfco (`/vault query`) before generating — a thin or guessed core produces stances that land wrong.

### 2 — Generate n disjoint native domains, calibrated to the knob

Each sits outside James's core, calibrated to the knob. **They must be disjoint** — no two stances may share a source domain.

### 3 — For each domain, derive the other three parts

Forced landing (name the substrate, at the knob's strictness), anti-pattern (the domain's boring attractor), seed prompt (verbatim, naming James's real tools).

### 4 — Convergence + anti-pattern audit (do not skip)

Any failure means regenerate that stance, not ship-with-a-caveat.

> **Load `knowledge/pass-shape-and-audit.md`** before this audit — the four skill-level anti-patterns, the PASS shape, run/handoff guidance, and the map-stack self-test.

### 5 — Optionally run k stances inline as sample passes

Each pass follows the PASS shape; prefer the stances least connected to his core.

### 6 — Emit the handoff doc + optionally stage to selfco

Write a handoff doc for the un-run stances in the `.handoff/` bead shape.

## Gotchas

- **Skipping the core-retrieval step is the highest-leverage failure, not the convergence audit.** A guessed `core` poisons every downstream stance — they land on substrate James doesn't run or already has, and no amount of disjointness fixes that. When he doesn't hand you the core, `/vault query` it from selfco *before* generating; stances built on a thin core fail silently because they still *look* well-formed.
- **The orthogonality knob's two jobs drift apart under pressure.** It is tempting to pull wild native domains while keeping a strict forced landing (because strict feels safe) — that pairing produces nothing buildable. Wild domains demand a relaxed/bridging landing; adjacent domains demand a strict one. If your output is all essays or all generic advice, you decoupled the knob.
- **Disjointness is about the native domain, not the landing surface.** Five stances all landing on PMTiles/GDAL is fine and expected; five stances all *thinking* in "data infrastructure" is convergence. Check where each agent reasons from, not where it terminates — the easy mistake is to wave through near-identical domains because their seed prompts name different tools.
- **A `Buildable now:` verdict that hides a custom build is a lie the PASS shape exists to prevent.** When you run sample passes, partition honestly into confident / confident-but-custom / speculative-but-grounded. The seductive move is to call a thing "buildable now" because the *components* exist off-the-shelf even though James has to wire them himself — that's confident-but-custom, and mislabeling it burns the method's credibility.
- **The handoff doc is the deliverable even when you run zero stances inline.** The value is divergence spawned in parallel later, not passes cycled in one session. Don't treat un-run stances as leftovers — stage each to the selfco inbox as an individually spawnable row, or the fleet's reusability (the entire point) evaporates.

## Postflight

After generating a fleet:
> Offer to stage it to selfco via `selfco-ingest` so the un-run stances are individually spawnable later.

After running sample passes:
> Hand the un-run stances' seed prompts to a real Claude Code / Cowork session — the value is divergence, so run them in parallel, not one session cycling stances.
