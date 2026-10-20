---
type: wayfinder-map
slug: classic-space-agent-world
northstar: l2-ojfbot
tracker_issue: "#541"
status: charting
---

# Wayfinder — Classic Space agent world

## Destination

The Arcade gains an ambient venue. A Classic Space server room — 1980s LEGO space illustration,
blue spacemen, black contours — runs all day on a desk monitor, and every minifig in it is a real,
named ojfbot agent, process or queue. A glance reads status; selecting a figure or place reveals
the real entity, its task and its evidence; a plain dashboard/text view renders the same state in
parity; a stale or disconnected feed says so in both surfaces. **Arrived** = one cluster room bound
to one real read-only fleet feed, two or more minifigs on independent validated routes, the plain
view in parity, deterministic replay for regression, and layout, labels and overrides that survive
restart. Serves `ns:l2-ojfbot#P3` (the Arcade fronts the fleet) and `ns:l2-ojfbot#P1` (each app
reaches a usable surface in its natural venue). The minifig is the flâneur of the Arcade's own
naming register (name the operating surface, #273).

The initiative consumes the play-well cluster's tools — Drafting Table tokens, the LEGO building
UI, Blender expertise — as a client cluster and contributes features back, the way other clusters
are meant to consume blogengine's publishing harness without joining its cluster. It does not join
play-well's correspondence register unless the repo-home ticket rules otherwise. Siri, camera
moves, node authoring and further rooms are beyond arrival (see fog and out-of-scope below).

## Notes

- **Mode:** full (core registry resolves, 26 entries). Charted 2026-10-20 from
  `lego-village-pipeline` as the vantage; the map lives here in the one library.
- **Source bundle:** `~/Desktop/classic-space-walkway-pass` — a ChatGPT-session handoff with
  honest provenance: a Three.js projection scene (approved plate camera-projected onto rough
  solids), one procedural rigid minifig on one route, fixed art camera, 36 s loop at 24 fps;
  Chromium captured, FFmpeg encoded; **Blender never ran**; no fleet schema inspected. Read
  `START_HERE.md`, `AGENTS.md`, `handoff/PRODUCT_VISION.md`, `handoff/OJFBOT_WORLD_COMPILER.md`,
  `handoff/KNOWN_LIMITATIONS.md`, `handoff/NEXT_LAYOUT_CHANGE.md`. The bundle's `AGENTS.md`
  standing rules (preserve the visual contract; work honestly and incrementally; never claim a
  Blender run or render without evidence) are inherited verbatim as working constraints.
- **Why "fork from LVP" is weaker than it sounds.** LVP is a procurement digital twin that spends
  real money against a BOM; this is an ambient agent-ops venue. What carries over is conventions
  (teacher principle, evidence axes, a11y-tree contract, Drafting Table tokens at
  `docs/design/H-01-R1/dt/tokens.css`, mock-math labelling, people rules: James is a friend of
  the family, never a parental role; the boys are EH, HH, LH), not domain. The real precedent is
  the Arcade lineage.
- **The Arcade is the home, by name already.** `operating-surface-bonded-pair` (#272) closed
  "name the operating surface" (#273) on 2026-07-23 with Benjamin's *Arcades Project* as the
  register: one passage, many worlds; the operator as flâneur. No visual "see the fleet" attempt
  has been filed under it: `core-library` (May 2026, "3D cyberspace navigation UI for deployed
  apps + running agents", Babylon, wireframe Cambridge UL aesthetic) is a three-commit seed with
  undeclared scope and no northstar; cockpit tiles and gastown-pilot are separate apps. This map
  is the first Arcade *venue* initiative. Cross-map dependencies: registry schema home (#275) and
  tier B talk seam (#281) remain open there.
- **"The ojfbot schema" does not exist as one thing.** fleet-runner is design-only
  (`fleet-runner/` holds planning and research; placement approved in core as
  `packages/fleet-runner`, ADR-0108; no runtime). What is observable today: the live Claude Code
  session census (the UserPromptSubmit hook lists ~40 worker agents by repo), beads under
  `.handoff/` (typed, dated, with refs and status), `decisions/northstar/status.jsonl`
  (movement ledger, sparse), the northstar registry and roadmaps, GitHub issues/PRs/sub-issues,
  the daily-logger sweep. The first feed is a research question, not a lookup.
- **Governance fact:** `REGISTER.md` scope text — "the play-well cluster, not one repo … and any
  further play-well repo" — means calling this repo play-well pulls it under memo preflight,
  register versions and relay-only self-merge. Membership is a decision (repo-home ticket).
- **Vault reads (design-time, read-only):**
  - `synthesis/play-well-research-harness` — the decomposition alarm and innovation alarm apply
    to any "ahead of the field" claim this venue makes; keep candidate modules as findings until
    decided.
  - `concepts/blender-era-3d-work` — the practice's craft → script → agent arc; a 2019 "rough
    server-room blockout" and a 2021–22 LDraw import pipeline are literal ancestors of this room.
  - `synthesis/cluster-status`, `synthesis/ojfbot-ecosystem-map` — the `core-library` seed and
    `asset-foundry` (LangGraph → bpy → validated .glb, generic by construction) as the fleet's
    Blender capability.
  - `synthesis/fleet-runner-design-contracts` — user story 8 ("truthful blocked, unknown and
    stale states so process health does not masquerade as progress") is the fleet's own statement
    of this venue's honesty rule.
- **Standing constraints carried from the handoff:** a walking minifig never implies a live task
  succeeded; a metaphorical walk down a garbage lane never itself triggers deletion; queue visuals
  may aggregate while the dashboard keeps exact counts; simulation time stays separate from render
  frame rate; mock data is labelled simulated.
- **Tooling pointers (not endorsements):** Mint MCP / mint-threejs-skills, `ahujasid/mcp-for-blender`,
  the Blender MCP connector attached to this session, `asset-foundry`'s subprocess bridge. Evaluate
  any generator on one small module before widening (handoff `TOOLS_AND_PRECEDENTS.md`).

## Decisions so far

Grill-resolved at charting (recorded here as pre-map rulings by Yuri, 2026-10-20, not closed
tickets):

- Home lineage is the **Arcade**, as the next iteration attempt; play-well is consumed as a tool
  well, blogengine-consumer pattern — ruled in the charting grill (anchor `ns:l2-ojfbot#P3`, `#P1`).
- Arrival requires **one real read-only feed**, not replay alone and not Siri — ruled in the
  charting grill.
- Camera moves/transitions, node-based room authoring and multiple rooms are **out of scope** —
  ruled in the charting grill.

Closed tickets: none yet.

## Tickets

| Ticket (title, refer-by-name) | Type | Blocked by | Status |
|-------------------------------|------|------------|--------|
| Repo and northstar home (#542) | grilling | — | open |
| Observable fleet state survey (#543) | research | — | open |
| Blender's role in the loop (#544) | grilling | — | open |
| Two-agent route proof on the projection scene (#545) | prototype | — | open |
| Reacquire the measured minifig references (#546) | task | — | open |
| First feed binding (#547) | grilling | Observable fleet state survey | open |
| Arcade seam (#548) | grilling | Repo and northstar home | open |
| Play-well consumption contract (#549) | grilling | Repo and northstar home | open |
| Ambient host and display operations (#550) | grilling | Repo and northstar home | open |
| Authoritative spatial source (#551) | grilling | Blender's role in the loop; Two-agent route proof on the projection scene | open |
| State vocabulary and honesty rules (#552) | grilling | First feed binding | open |
| Yellow lane semantics (#553) | grilling | First feed binding | open |
| Minifig fidelity bar (#554) | grilling | Reacquire the measured minifig references | open |
| Plain view parity and the a11y contract (#555) | grilling | State vocabulary and honesty rules | open |
| Room document and restart survival (#556) | grilling | First feed binding; Authoritative spatial source | open |

Frontier at charting: Repo and northstar home · Observable fleet state survey · Blender's role in
the loop · Two-agent route proof on the projection scene · Reacquire the measured minifig
references. Research runs one cycle at a time; the survey is the only research ticket.

Deliveries deliberately **not** on this map (they are roadmap slices once the decisions above make
their entrance statable): the longitudinal yellow gangway layout pass (`NEXT_LAYOUT_CHANGE.md`),
the production two-agent slice, the semantic vertical slice with replayed inspection and archive
tasks, character interaction clips, and the baseline commit of the bundle into whatever repo the
home ticket names.

## Not yet specified

- **Siri / voice query** — operator intent is clear ("quick queries and interactions via Siri");
  the question is not statable until an application API over the state store exists (after
  Ambient host and display operations and Plain view parity).
- **Interaction vocabulary** — inspect panel, carry archive capsule, pause at a busy junction,
  acknowledge-attention gesture; depends on the state vocabulary.
- **Queue aggregation visuals** — how many items become one visual summary, and what the summary
  may hide; depends on the bound feed's queue shape.
- **Contribution path back to play-well** — which play-well tool receives its first feature from
  this consumer (tokens, building UI, Blender recipes); depends on the consumption contract.
- **Generative asset tooling** — whether Mint, `generate_3d` or asset-foundry supply candidate
  modules; depends on Blender's role.
- **Family exposure** — whether EH/HH/LH ever see this surface, which would pull in the family
  rules in full; nothing in the operator's direction says so yet.
- **Level connector behaviour** — lift/stairs traversal and reservations; depends on the
  authoritative spatial source.

## Out of scope

- **Camera moves and transitions** — ruled by Yuri, 2026-10-20 (charting grill). The art camera
  stays fixed until layout and behaviour are dependable.
- **Node-based room authoring** — ruled by Yuri, 2026-10-20. The world-compiler node editor waits
  until one real cluster compiles into agreed scene and dashboard state.
- **Multiple rooms** — ruled by Yuri, 2026-10-20. One room is the proof; rooms-as-clusters is a
  later initiative.
- **Touching lego-village-pipeline** — stated in the charting brief: this initiative reads LVP
  for precedent and never edits it.
