---
type: wayfinder-map
slug: cockpit-northstar-conversation
northstar: l1-morning-cockpit
tracker_issue: "#333"
status: working
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
- **Prototype evidence, 2026-08-08 (cockpit v2 design pass).** A full interactive design prototype
  (`morning-cockpit/research/design-handoff-cockpit-v2/`, branch `prototype/fleet-navigator`) ran
  against two of this map's open tickets. Its findings are recorded as **evidence below, not as
  closures** — a prototype answers a question; the operator rules on it.
  - **#338 — the canvas does not survive 372px.** Measured in the prototype (RFI response E30):
    a fleet canvas is comfortable at ≥ ~700px and workable at ~560px; the 400px node popover and
    tier-card text are the binding constraints, and neither fits the 372px `.chat-sidebar`. The
    canvas therefore moved to a main-column Fleet section. **What does fit the rail is the pattern
    the v2 design adopts there instead: inspector (context breadcrumb → node payload) above
    threaded chat**, on a `minmax(60px,1fr) minmax(120px,46%)` grid so neither pane overlaps the
    other. This is a verdict on the *canvas* in the rail; the one-thread-grill cadence question the
    ticket was originally written to answer is what remains. Ratified 2026-08-11 as D8, and #338 was
    **re-scoped** to that remaining question rather than closed.
  - **#340 — the recommended answer is keyed threads plus an explicit scope toggle.** Implemented
    cockpit-side in the prototype (option S-c): threads keyed `{global | repo}`, a `GLOBAL · LEO`
    tab plus per-repo tabs opened via "Ask Leo ↓", each scoped thread carrying a
    `context → Global: ON/OFF` share toggle. **Clicking a different tile mid-grill pins the thread
    to its scope** — selection changes the INSPECTOR, not the conversation. That is the map's third
    option ("pin the conversation and decouple it from focus") chosen deliberately, which does
    change what "focus-scoped" means: the *thread* is scope-keyed at creation, the *rail* is
    focus-following. Ratified 2026-08-11 as D7; #340 closed.

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

Operator rulings, 2026-08-11 — ratified from the cockpit v2 design pass evidence (Notes):

- **D7 — threads are keyed `{global | repo}`, and focus changes do not move a thread.** Per-scope
  threads with a per-thread `share-to-global` toggle; clicking a different tile mid-grill repoints
  the inspector and leaves the conversation pinned to the scope it was opened in. This is the
  third option #340 named — pin the conversation and decouple it from focus — chosen deliberately,
  so "focus-scoped" now means the *thread* is scope-keyed at creation while the *rail* follows
  focus. **Closes #340** on the key and the focus rule. Two residues the ruling does not cover, and
  they are not implementation details: the **retention rule** (how many threads per repo survive,
  and for how long) is an undecided question, and the **store migration** is real work —
  `chat-store.ts` holds one global thread in `.data/chat-history.json` with no key at all, so
  keying is a migration, not a field addition. Retention is carried in *Not yet specified* below
  until it is charted as its own ticket.
- **D8 — the fleet canvas is a main-column surface; the 372px rail holds inspector + threaded
  chat.** Measured, not preferred: ≥700px comfortable, ~560px workable, and the 400px node popover
  plus tier-card text are the binding constraints at 372px. Settles *where the canvas goes*. It
  does **not** settle the cadence question #338 was originally written to answer, which is why
  #338 was re-scoped rather than closed (below) — the prototype never ran the three cadence
  variants, and closing on this evidence would have banked an answer to a question nobody asked.

## Tickets

| Ticket (refer by name) | Type | Blocked by | Status |
|------------------------|------|------------|--------|
| where the evidence line falls when the chat has facts (#334) | grilling | — | open |
| one thread or two ledgers — authoring vs decomposition (#335) | grilling | where the evidence line falls | open |
| the cockpit-wide switchboard seam and its failure behavior (#336) | grilling | — | open |
| does the ladder cadence survive a chat rail (#338, re-scoped) | prototype | — | open |
| push-to-talk viability at the desk (#339) | prototype | does the ladder cadence survive a chat rail | open |
| thread keying and focus changes mid-conversation (#340) | grilling | — | closed (D7) |
| what focusing a cluster means in the cockpit (#341) | grilling | *core: cluster-tier schema build (RFQ-004)* | blocked |

**Frontier** (open + unblocked + unclaimed): the evidence line (#334), the switchboard seam (#336),
the ladder cadence (#338, re-scoped). **#339 stays blocked** behind #338 — ratifying D8 settled
where the canvas lives, not whether the cadence survives a rail, and voice still prejudges the
cadence exactly as it did when the edge was drawn. Blocking edges live in each issue's
`## Blocked by` section — this GitHub instance exposes no native dependency field, matching the convention already
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

**does the ladder cadence survive a chat rail** (#338) · *prototype* · **re-scoped 2026-08-11**
The cadence was authored for voice in a car, where one-question-at-a-time is the only option. In a
`.chat-sidebar` (372px, `app.css:1357`) it may read as a slow interrogation. Build 2–3 variants —
freeform chat with a ladder nudge / stepped wizard with a progress rail / hybrid — run a real
northstar through each, record the verdict, delete the losers.

*Re-scoped by operator ruling 2026-08-11.* The original title asked two questions at once, and the
cockpit v2 prototype answered only one of them. **Settled, and moved to D8:** where a canvas lives
(main column, ≥560px workable) and what the 372px rail holds instead (inspector above threaded
chat). **Still open, and now the whole of this ticket:** does the ladder cadence — vision → is this
the right *set* of properties → per-property target/current/verification → ladder check → converge
— survive being delivered one question at a time in a narrow rail, or does it read as
interrogation?

The rail is therefore a **given** for this ticket, not a variable: build the 2–3 variants at 372px
against the real inspector-above-chat layout D8 fixed, run an actual northstar through each, record
the verdict, delete the losers. #339 stays blocked behind it for the reason the edge was drawn —
voice pushes hard toward one-question-at-a-time and would prejudge the answer.

**push-to-talk viability at the desk** (#339) · *prototype*
Web Speech API in the cockpit's browser: push-to-talk vs continuous, TTS for the agent's turn,
barge-in, reduced-motion and a11y. Blocked on the cadence prototype because voice pushes hard
toward one-question-at-a-time and would prejudge it.

**thread keying and focus changes mid-conversation** (#340) · *grilling*
`packages/server/src/chat-store.ts` holds one global thread in `.data/chat-history.json` with no
tab or unit key. Per-unit Northstar threads need a key, a retention rule, and a ruling on what
happens when a different tile is clicked mid-grill: switch threads, warn, or pin the conversation
and decouple it from focus. The third option changes what "focus-scoped" means.

***Closed 2026-08-11 by D7***: key `{global | repo}`, per-thread share-to-global toggle, and the
third option — pin the thread, repoint the inspector. Two things this ticket raised are **not**
closed with it, and they are different in kind:

- The **retention rule** (how many threads per repo survive, and for how long) is an undecided
  question, not a build detail. It is parked in *Not yet specified* and wants its own ticket before
  the keyed store is built — a store shipped without a retention rule grows without bound and the
  rule then has to be retrofitted onto live data.
- The **store shape** is delivery, not decision: `chat-store.ts` holds one global thread in
  `.data/chat-history.json` with no key at all, so keying is a migration with a backfill, not a
  field addition. That belongs to a roadmap slice, not to this map.

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
- **Thread retention** — how many threads per repo survive, and for how long. Left open by D7
  (2026-08-11), which fixed the *key* and the focus rule but not the lifecycle. Unlike the other
  entries here this one **is** statable today and reads as a grilling ticket, not fog: the shape is
  cap-by-count vs cap-by-age vs never-expire-but-archive, and it interacts with the store migration
  (retrofitting a rule onto accumulated threads costs more than declaring one first). Not minted as
  a ticket in this session — tracker numbers are not reservable, so create-then-reference is the
  right order and that is a charting call, not a ratification one.

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
