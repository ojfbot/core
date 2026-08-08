---
type: wayfinder-map
slug: cockpit-northstar-conversation
northstar: l1-morning-cockpit
tracker_issue: "#333"
status: charting
---

# Wayfinder — the northstar conversation surface

## Destination

The roadtrip conversation gets a durable surface. A second tab in the cockpit's sidebar chat —
**Northstar**, beside the chief-of-staff (Leo) — opens scoped to whichever fleet tile is focused
and runs the relay's cadence at the desk: vision first, one thread at a time, the property set
attacked *as a set*, then per-property falsifiability and an honest `current:`, then the ladder
check with a `LADDER_STRESS` verdict. It is voice-capable (push-to-talk, spoken turns) but bound
to localhost — the car is retired as a venue, the cadence is what carries over. The conversation
converges on a fenced CONFIRMED block plus **slice intents**, and leaves as a proposal through the
existing gated `.handoff` write — never into core.

Arrived means: focusing `fairway` and opening Northstar starts a grounded conversation about
`l1-fairway`'s properties, their honest currents, and where the gap decomposes — and ends with
something an operator can approve into a brief without hand-repair.

Serves `ns:l1-morning-cockpit#P3` (the cockpit pivots focus across the active fleet — the
conversation is the deepest thing a focus-swap can open onto) and `ns:l1-morning-cockpit#P2`
(coordination is real and ground-truth — the tab's output goes through core's verbs, never a
parallel truth).

## Notes

- Charted 2026-08-01. The `/wayfinder` mode resolved **full** (19 registry entries).
- **The precedent this reconstructs.** The 2026-06/07 Northstar Roadtrip ran as a two-agent relay:
  Claude Code staged briefing cards and owned ground truth; claude.ai voice ran the Socratic grill;
  Notion carried blocks between them. Protocol in `decisions/northstar/offsite/contract.md`; loop
  and status ladder in `offsite/itinerary.md`; five landed outputs in `offsite/confirmed/`.
  `offsite/synthesis-ledger.md` is still seed-only — the relay stalled.
- **No transcript survives.** The conversations happened in voice mode; only the CONFIRMED blocks
  and the protocol are on disk. The chat-side skill that would have encoded the question ladder
  (`core/.claude/skills/northstar-voice/`, `rm:rm-l2-ojfbot#S3`) was specced and never built —
  verified absent 2026-08-01.
- **The one surviving prompt scaffold** is `~/selfco/raw/prompt-cockpit-northstar-clarification.md`
  — a real paste-into-voice ladder: vision → is this the right *set* of properties → per-property
  target/current/verification → ladder check → converge and emit. Its posture line is the design
  brief for this tab: *"Push back on my framing — I want the sharpest version, not validation…
  Grill me one thread at a time; don't dump a finished answer."*
- **The substrate already exists.** `morning-cockpit/packages/server/src/adapters/delivery.ts`
  parses core's registry, every northstar and roadmap file, `status.jsonl`, and joins compiled
  slice beads from Dolt. Section 03 renders it. The cockpit can already *see* the compass; this
  initiative is about talking to it. Nothing here needs a new reader.
- **Model orchestration is a fleet concern, not this tab's.** `switchboard` is the orchestration
  layer, and it is **real, not aspirational**: S1 is merged (FastAPI proxy, Anthropic adapter,
  byte-for-byte SSE passthrough, 16 tests) and its roadmap **already carries S9 — "Interactive
  consumer: cockpit chat streams through switchboard", queued.** This initiative must not
  duplicate that slice; the provider ticket below adopts it.
- **The cockpit has two provider paths, and only one is a selector.** `packages/server/src/llm.ts`
  already selects `'ollama' | 'claude' | 'off'` for summaries, reading digest, and papers — adding
  `'switchboard'` is a fourth case in an existing switch. But `routes/chat.ts` → `providers/
  ollama.ts` *deliberately bypasses* that selector (ADR-0006 §3): the bypass **is** the mechanism
  enforcing "no cloud cascade." Unifying chat under the selector re-opens ADR-0006 at the root.
- Selfco reference layer consulted: `wiki/concepts/three-tier-northstar.md`,
  `wiki/sources/prompt-cockpit-northstar-clarification.md`. Design-time read only.

## Decisions so far

Operator rulings, 2026-08-01 charting session (recorded as pre-map decisions, not closed tickets):

- **Voice-capable at the desk, not in the car.** Push-to-talk + spoken turns in the tab; cockpit
  stays bound to 127.0.0.1. Exposing an unauthenticated localhost surface to a phone is a security
  decision, not a feature — ruled out (D1).
- **Repo-only v1.** The tab ships against L1 northstars; the cluster layer is charted as a ticket
  blocked on core's cluster-tier build, with no cockpit-local cluster grouping invented ahead of
  the registry (D2).
- **Output leaves through the existing gate.** Converged blocks and slice intents go out as a
  `.handoff` brief via `handoff-emit.ts` under ADR-0005's single write carve-out. Nothing writes
  into `core/decisions/northstar/`; nothing touches `current:` or `status.jsonl` (D3).
- **Non-local / SOTA models are allowed per-tab.** ADR-0006's ban is on *silent cascade*, not on
  operator-selected providers. The Northstar tab may select a frontier model — the grill is
  judgment work and a 7B local model produces agreeable mush at it. Real model orchestration is
  acknowledged as coming; see the provider ticket (D4).
- **Every cockpit chat interface becomes a switchboard client, not just this tab.** Operator
  ruling: the provider seam is cockpit-wide (chat, handoff drafting, lane summaries, reading
  digest, papers), adopting switchboard's already-queued S9 rather than a Northstar-only path.
  *Three constraints Code attaches, unratified:* (a) **hard ordering** — switchboard speaks only
  Anthropic today; its Ollama adapter is S2 (`ready`, unmerged), so the cockpit cannot become a
  client before S2 lands without losing local-first outright; (b) this is a **wider ADR-0006
  amendment** than the tab needed, because chat's bypass of `llm.ts` is the no-cascade mechanism
  itself; (c) **the deterministic floor is non-negotiable** — switchboard is a network service on
  :8600, and a 7am outage must still render the cockpit, so it is a provider *option* with
  `chatFallbackText` / `summarizeLane` intact, never the only path (D6).
- **The tab drafts slice INTENT, never slices.** Operator ruling: a chat session may propose
  decomposition to capture intent, but not author schema-level slice planning. *Code's sharpening,
  offered and not yet ratified:* the boundary is falsifiability from what the tab can see —
  `title`/`deliverable`/`phase` are intent, `advances` resolves-or-fails against the registry, and
  `moves_from` is derivable (it *is* `current:`, and roadmap-lint WARNs when they disagree); but
  `moves_to` is pure judgment, `entrance` is human-asserted at `queued → ready` by schema
  definition, `success` must be verifiable on the PR, and **`check:` is a hard no — its mere
  presence is the `autonomy_fit` signal, so a fabricated one silently promotes a slice to
  `agent_eligible` and lets the day-runner claim it.** The exact field list is the evidence-line
  ticket's remaining work (D5).

## Tickets

| Ticket (refer by name) | Type | Blocked by | Status |
|------------------------|------|------------|--------|
| where the evidence line falls when the chat has facts (#334) | grilling | — | open |
| one thread or two ledgers — authoring vs decomposition (#335) | grilling | where the evidence line falls | open |
| the cockpit-wide switchboard seam and its failure behavior (#336) | grilling | — | open |
| does a one-thread grill survive a 372px rail (#338) | prototype | — | open |
| push-to-talk viability at the desk (#339) | prototype | does a one-thread grill survive a 372px rail | open |
| thread keying and focus changes mid-conversation (#340) | grilling | — | open |
| what focusing a cluster means in the cockpit (#341) | grilling | *core: cluster-tier schema build (RFQ-004)* | blocked |

**Frontier** (open + unblocked + unclaimed): the evidence line (#334), the switchboard seam (#336),
the 372px rail (#338), thread keying (#340). Blocking edges live in each issue's `## Blocked by`
section — this GitHub instance exposes no native dependency field, matching the convention already
used by `operating-surface-bonded-pair`.

### Ticket bodies

**where the evidence line falls when the chat has facts** (#334) · *grilling*
The relay's governing rule (`core/.handoff/20260628-2009-brief-resume-northstar-offsite.md`) is
*"Chat hallucinates below the evidence line… Keep chat ABOVE the line: judgment, framing,
aspiration. Any code fact is a question for Code, not a chat claim."* That rule existed because
claude.ai had no filesystem. **This tab does** — it reads the registry, roadmaps, `status.jsonl`,
and slice queue state through `/api/delivery`. So the line moves; the decision is where to.
Which facts are hard-grounded and quotable (`current:`, slice `status`, movement lines, lint
state)? Which remain judgment the operator alone rules (is P3 an axis or a feature; is 55 honest)?
D5 gives the shape; this ticket fixes the field-level list and the refusal behavior when the tab
is pushed past it.

**one thread or two ledgers — authoring vs decomposition** (#335) · *grilling*
The request was northstar roadmap *and* slice decomposition in one tab. Wayfinder's own boundary
rule: *"Wayfinder tickets are questions closed by answers; roadmap slices are deliveries closed by
merged PRs — two ledgers, never merged."* Does the tab hold both as explicit modes with different
affordances, refuse decomposition and hand off to `/gated-slice`, or emit slice intents as a
distinct artifact type from the CONFIRMED block? D5 constrains the answer but does not pick it.

**the cockpit-wide switchboard seam and its failure behavior** (#336) · *grilling*
D4 settles that a frontier model may be selected; D6 settles that the seam is cockpit-wide and
adopts switchboard's queued S9. What remains open is genuinely undecided:
(a) **Failure behavior.** When the selected provider is unreachable, does a call fall back to
local Ollama, to the deterministic floor, or refuse and name the provider that failed? Falling
back to Ollama is the silent cascade ADR-0006 bans wearing a different hat — but switchboard's own
S7 is *"opt-in cascade per route class (ADR: explicit failover)"*, so the fleet answer may be
"labeled failover, declared per route." Decide once, cockpit-wide.
(b) **Where the seam lives.** Does `llm.ts` gain a `'switchboard'` case and `routes/chat.ts` start
using the selector it currently bypasses, or does a thin client sit under both? The bypass is
load-bearing (ADR-0006 §3) and cannot be deleted casually.
(c) **Sequencing and ownership.** Switchboard S2 (Ollama adapter) is `ready` but unmerged, and S3
(daily-logger as first consumer) precedes S9. Does the cockpit wait for the full chain, or ship an
inline per-tab provider first as a stepping stone and migrate? The stepping stone is throwaway
work if the chain lands soon — that trade is the decision.
(d) **Which side owns the slice** — switchboard's S9, a cockpit PH4 slice with `repo: switchboard`,
or both halves. Precedent exists: this roadmap already carries slices with `repo: core`.

**does a one-thread grill survive a 372px rail** (#338) · *prototype*
The cadence was authored for voice in a car, where one-question-at-a-time is the only option. In a
`.chat-sidebar` (372px, `app.css:1357`) it may read as a slow interrogation. Build 2–3 variants —
freeform chat with a ladder nudge / stepped wizard with a progress rail / hybrid — run a real
northstar through each, record the verdict, delete the losers.

**push-to-talk viability at the desk** (#339) · *prototype*
Web Speech API in the cockpit's browser: push-to-talk vs continuous, TTS for the agent's turn,
barge-in, reduced-motion and a11y. Blocked on the cadence prototype because voice pushes hard
toward one-question-at-a-time and would prejudge it.

**thread keying and focus changes mid-conversation** (#340) · *grilling*
`packages/server/src/chat-store.ts` holds one global thread in `.data/chat-history.json` with no
tab or unit key. Per-unit Northstar threads need a key, a retention rule, and a ruling on what
happens when a different tile is clicked mid-grill: switch threads, warn, or pin the conversation
and decouple it from focus. The third option changes what "focus-scoped" means.

**what focusing a cluster means in the cockpit** (#341) · *grilling, blocked*
Per D2. `ns:cluster-<name>@<semver>#P<n>` is `[SCHEMA ITERATION 6] — DESIGNED` in
`offsite/schema-evolution-log.md`; there is no cluster node in `decisions/northstar/schema.md`,
`scripts/lib/northstar-fm.mjs`, or lint, and no grouping above a repo in the cockpit's fleet tiles
(`phase` is a flat tag). The operator ruled the topology already — *cluster members are REPOS,
uniformly; a thin membership/coordination overlay, not a ladder parent* — but the schema is
unbuilt. **Blocked on core's cluster-tier schema build (RFQ-004), which the operator flagged
2026-08-01 as increasingly load-bearing across cluster-golf, cluster-gameworld, and cluster-f1.**

**No research tickets.** Nothing here needs an AFK deep-research cycle; manufacturing one to fill
a type slot would be padding.

## Not yet specified

- Whether the tab reads `decisions/wayfinder/*.md`. The map library is currently unconsumed by any
  app — a cockpit that could see open frontiers alongside slices is obviously interesting, but the
  question isn't statable until the tab's mode structure settles (one thread or two ledgers).
- Whether the cockpit ever emits a `LADDER_STRESS` verdict, and how the kickback gate (one `break`,
  or 3 `strain`s against the same parent property, freezes the roadtrip) would surface in a UI.
  Not statable until the evidence line is fixed — a verdict is exactly the kind of semantic
  judgment the contract says is *"chat's, not the linter's."*
- Whether this surface eventually *replaces* the Notion relay, or stays the desk-side half of it.
- Whether `SYNTHESIS:` — the cross-project line that compounds into the ledger — has any meaning
  in a single-unit-focused conversation, or requires the cluster layer first.

## Out of scope

- **In-car access from a phone** — ruled by Yuri 2026-08-01 (D1). The cockpit binds 127.0.0.1 with
  no auth; exposing it is a security decision, not a feature. If the car is wanted again, the
  answer is core's queued chat-side skill `northstar-voice` (`rm:rm-l2-ojfbot#S3`), not this tab.
- **Direct writes into `core/decisions/northstar/`** — ruled by Yuri 2026-08-01 (D3). ADR-0005's
  single carve-out stands.
- **The cockpit writing `current:` or appending `status.jsonl`** — permanently out. The movement
  contract is that a session never writes `current:`, and movement is recorded at merge by the
  merging human via `scripts/record-movement.mjs`. Answers never touch `status.jsonl`.
- **Cockpit-local cluster grouping ahead of the registry** — ruled by Yuri 2026-08-01 (D2).
