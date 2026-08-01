---
type: wayfinder-map
slug: control-plane-conductor
northstar: l2-ojfbot
tracker_issue: "#307"
status: charting
---

# Wayfinder — the control-plane conductor

## Destination

**One loop that conducts the others.** A conductor that knows what loops exist across ojfbot and
selfco, whether each fired, what it produced, whether anything consumed the product, and where two
loops overlap or contradict — and that does something about what it finds. Arrived means the
fleet's control plane has a single legible surface and a closure path, instead of 32 declared loops
whose health is reconstructible only by reading a 700-line registry.

**Portability is a property of the Destination, not a nice-to-have.** The conductor is built *for*
Claude Routines and must be re-pointable *off* them. The load-bearing rule: the conductor's body —
its inventory, its logic, its evidence, its decisions — lives in committed files and deterministic
scripts in this repo. The routine is only a **trigger adapter**. Anything the conductor knows must
be reconstructible from git, never from vendor-side state. If swapping the routine for a cron
entry, a systemd timer, a GitHub Actions schedule, or a hand-run script costs more than re-pointing
the trigger, the seam is in the wrong place and the design is wrong.

This is a **wrap**, not an absorb (`/adopt-stack` framing; cycle-5 §2a was itself an adopt-stack
call). The registry already carries the instinct — *"the `trigger:` value is a labeled adapter,
never the loop's identity"* — and this map makes that line explicit and testable.

Serves `ns:l2-ojfbot#P2` — work traces to a measurable property, with movement recorded rather than
asserted. Today the loops that generate that evidence are themselves unmeasured.

## Notes

Charted 2026-08-01. Re-charted the same day: the first pass fixed the Destination on *rail policy*
(how the registry describes a routine), after an option set that never named a conductor. The
operator corrected it — rail policy is a sub-problem; the conductor is the initiative. Surviving
tickets are marked below. The portability constraint was added by the operator mid-charting and is
now a standing constraint on every ticket.

**The operator affirmed all four sprawl failure modes as having real instances ("it's a mess"):**

1. **Loops die silently.** The selfco pair froze 53 days; `day-run` ran nowhere for a month;
   `weekly-measure` sits on the manual rail. `loops-liveness.mjs` detects this but is report-only
   and nothing reads its report on a cadence.
2. **Nobody can see the whole.** 32 declared loops across core / daily-logger / selfco /
   screenshot-organizer / mrplug, plus whatever is undeclared. Discovery means reading the registry.
3. **Outputs pile up unread.** Measurement snapshots, lint reports, defect sweeps, vault
   suggestions — produced faithfully, consumed by nobody. This is the cycle-1 "loops decide what
   happens next" gap, still open: convergent as *program*, absent as *runtime*.
4. **Loops overlap and contradict.** Six documents describe the retired selfco Notion path as live;
   telemetry ledgers carry competing definitions; harnesses measure overlapping things differently.

**Facts gathered during charting:**

- `loops-liveness.mjs` already does the *tracking* half — reads `cadence:` + `evidence_ref:`,
  verdicts OK · STALE · DOWN · UNVERIFIABLE · EXCLUDED, exits 0 always. A conductor that only
  tracks is a re-skin of a script that exists; its justification has to be the part that doesn't.
  This is why the authority question is charted rather than assumed.
- `loops-lint.mjs` defines `TRIGGERS = ['launchd','gh-actions','hook','watchpath','manual']` — no
  routine value. An authoring attempt already fell back to `trigger: hook`
  (`implementation-notes.md`).
- Rails today: 6 launchd · 6 gh-actions · 14 hook · 1 watchpath · 5 manual. 26 live, 6 disabled.
- Vantage tension: routines fire ephemeral cloud containers; Dolt (`127.0.0.1:3307`), `~/selfco`,
  and `~/.claude/*.jsonl` are local. A conductor that must read all three cannot be purely
  cloud-side today — a portability finding as much as a placement one.
- Doctrine that constrains any answer here: ADR-0086 (shadow-first, RIDM promotion), gate-0
  (humans merge), and the standing rule that a measurement never blocks.

**Staged input (2026-08-01):** `decisions/adr/draft-bead-substrate-stability.md` — audited
assumptions + gated slices for the bead data layer (durability, loud emissions, committed
digests, substrate RIDM). Its DS2 feeds #318, DS4/DS5 feed #309. Charted as *input to*
tickets, resolving none of them.

**The risk this map must not walk into:** the conductor becomes loop #33 — watching 32 others, with
no verifier of its own, producing one more artifact nobody reads. *Who watches the conductor* exists
to make that a decision rather than a discovery.

## Decisions so far

*(index only — the decision lives in its ticket/ADR)*

- *(none yet — charting session, zero tickets resolved)*

## Tickets

| Ticket (title, refer-by-name) | Type | Blocked by | Status |
|-------------------------------|------|------------|--------|
| Census the control plane (#315) | task | — | open |
| What a scheduled-agent primitive gives you, generic vs vendor-specific (#308) | research | — | open |
| The portability seam and how the registry names a swappable trigger (#311) | grilling | What a scheduled-agent primitive gives you | open |
| Where the conductor runs and what it must reach (#309) | grilling | The portability seam | open |
| What authority the conductor holds (#313) | grilling | Census the control plane; What a scheduled-agent primitive gives you | open |
| What "consumed" means for a loop's output (#316) | grilling | Census the control plane | open |
| Report or consolidate: overlap and contradiction (#317) | grilling | Census the control plane | open |
| Who watches the conductor, and when is it retired (#318) | grilling | What authority the conductor holds | open |
| What evidence a fired routine leaves behind (#310) | prototype | Where the conductor runs | open |

**Frontier:** *Census the control plane* and *What a scheduled-agent primitive gives you* — both
open, unblocked, unclaimed. One ticket per session; take the census first for the higher leverage.

**Standing constraint on every ticket.** Each decision is answered twice: once for the routine
implementation, once for "what does this cost to re-point at another stack." A decision that cannot
survive the second answer is not settled. Concretely — no ticket may resolve in a way that puts
conductor state, logic, or history anywhere but committed files in this repo.

> **Blocking edges are declared here and in each issue body, not natively in the tracker.** This
> environment's GitHub MCP surface has issue and sub-issue writes but no issue-dependency write. All
> tickets are sub-issues of #307 with `## Blocked by` in their bodies. Wire native edges in the UI
> if tracker-side frontier rendering is wanted. Logged in `implementation-notes.md`.

## Not yet specified

In-scope fog — belongs to the Destination, question not yet statable precisely:

- **What the conductor's surface actually is.** Cockpit pane, committed report, standup input,
  issues/beads, or several. Not askable until *What authority the conductor holds* and *What
  "consumed" means* settle what it emits and to whom.
- **Whether selfco is conducted by the same loop or a federated peer.** selfco has its own vault
  semantics, its own disabled rails, and a different write posture. One conductor across both vs a
  conductor per domain sharing a schema is a real fork — but which is right depends on the census's
  overlap findings.
- **Cadence and spend for the conductor itself.** Depends on authority: a see-and-surface conductor
  is cheap and can run often; a supervisor must be rarer and better gated.
- **Whether any existing loop retires into the conductor.** Several may already be doing a fragment
  of this job (`loops-liveness`, `defects-lint`, `weekly-measure`, `audit-delivery-check`).
  Consolidation candidates are a census output, not chartable ahead of it.
- **The exit runbook.** The portability seam's *test* is chartable now; the actual "here is how you
  re-point this at cron / systemd / Actions / Temporal / n8n" document is a deliverable that follows
  the decisions, not a decision.

## Out of scope

- **The S25 day-runner operating-mode decision** — remains open and unsigned. This map may produce
  inputs to it; it does not resolve it.
- **Migrating the dispatch/verify layer** — Dolt CAS queue-claim, day-runner worktrees, the 5-clause
  slice contract, oracle predicates. REJECT standing from cycle-5 §2a. The conductor may *observe*
  dispatch; it does not replace it.
- **Replacing session lifecycle hooks with routines** — event-triggered vs schedule-triggered. The
  14 hook loops are conducted, not converted.
- **A general rail-selection rule for all new loops** (was #312) and **whether the existing launchd
  rails migrate** (was #314) — deferred 2026-08-01 when the Destination moved from rail policy to
  the conductor. Not wrong, not now: §2a's "working plists are not debt" holds, and the portability
  seam decided here is a better input to that rule than a standalone pass would have been.
- **Implementing anything.** The `harness-routine` lint value, the conductor script, the census
  tooling — all deliveries with statable `success:` + `check:`. They pass the placement litmus as
  roadmap slices and are handed off at the end of this map, not charted on it.
