---
type: wayfinder-map
slug: routine-rail-policy
northstar: l2-ojfbot
tracker_issue: "#307"
status: charting
---

# Wayfinder — Routine rail policy

## Destination

`harness-routine` becomes a first-class trigger adapter in this cluster's loop machinery: the
loops registry can **declare** a Claude Routine, `loops-lint.mjs` can **check** that declaration
in both directions, `loops-liveness.mjs` can **see** whether it fired, and a written rule says
which rail (routine · gh-actions · launchd · hook · manual) any *new* loop belongs on and why.
Arrived means a future operator authoring a loop does not have to re-derive the placement
argument — they read the rule, pick the rail, and the lint enforces the declaration.

Serves `ns:l2-ojfbot#P2` — every loop's activity traces to readable evidence rather than being
asserted from memory. A rail the registry cannot express is a loop the fleet cannot measure.

## Notes

Charted 2026-08-01. Facts gathered during charting (these inform the tickets; none of them
resolve one):

- **The policy exists and is unexecuted.** `LOOP-ENGINEERING-CROSSCHECK-2026-07-09.md` §2a
  returned **PARTIAL-ABSORB**: new schedule-plus-prompt loops default to harness-native
  primitives (routine or `/loop`) where no queue/worktree/oracle contract is involved; existing
  launchd rails stay ("working plists are not debt"); **REJECT** replacing the dispatch/verify
  layer. Nothing has been built against this verdict in the ~3 weeks since.
- **The registry cannot express a routine today.** `rm:rm-l2-ojfbot#S29`'s deliverable prose
  names `harness-routine` as a trigger value, but `scripts/loops-lint.mjs` defines
  `TRIGGERS = ['launchd','gh-actions','hook','watchpath','manual']`. A deviation in
  `implementation-notes.md` records an authoring attempt that had to fall back to `trigger: hook`
  because declaring `harness-routine` would have ERRORed.
- **The manual rail is where loops go to die.** Of 32 declared loops, 5 sit on `trigger: manual`
  (`day-runner`, `weekly-measure`, `defects-sweep`, `selfco-maintenance-report`,
  `selfco-hot-list`). S25's draft states the indictment plainly: *"it has run nowhere for a month
  — the ritual demonstrably doesn't happen unprompted."* Two selfco surfaces froze for 53 days
  before anything noticed.
- **The load-bearing tension is vantage, not scheduling.** Routines fire **cloud** sessions in
  ephemeral containers; several state spines are **local** — Dolt on `127.0.0.1:3307`, `~/selfco`,
  `~/.claude/*.jsonl`. §2a called the trigger layer "incidental plumbing a routine could carry",
  but that holds only for loops whose spine is reachable off-box. S25 Option C names the failure
  mode: *"a cloud trigger for a local-only body is a split-brain rail."*
- **Both lint directions assume a discoverable on-disk artifact.** `loops-lint.mjs` treats a
  declared `trigger_ref` that doesn't exist as ERROR and an undeclared discovered artifact (plist,
  workflow cron, hook registration) as WARN. A cloud routine has no file in the checkout — it is a
  `trig_…` object behind an authenticated API. Both directions need a ruling.
- **GH Actions cron is an existing cloud rail.** 6 loops already run there with no local
  dependency and no token cost. Any rail-selection rule that omits the routine-vs-Actions
  comparison is incomplete.

## Decisions so far

*(index only — the decision lives in its ticket/ADR)*

- *(none yet — charting session, zero tickets resolved)*

## Tickets

| Ticket (title, refer-by-name) | Type | Blocked by | Status |
|-------------------------------|------|------------|--------|
| What a Claude Routine actually guarantees (#308) | research | — | open |
| Which loop classes may sit on a cloud rail (#309) | grilling | What a Claude Routine actually guarantees | open |
| What evidence a fired routine leaves behind (#310) | prototype | What a Claude Routine actually guarantees | open |
| How a routine becomes declarable and lintable (#311) | grilling | What a Claude Routine actually guarantees; What evidence a fired routine leaves behind | open |
| The rail-selection rule (#312) | grilling | Which loop classes may sit on a cloud rail | open |
| Blast radius and shadow-stage posture for routine-fired sessions (#313) | grilling | Which loop classes may sit on a cloud rail | open |
| Whether the existing launchd rails migrate (#314) | grilling | The rail-selection rule | open |

**Frontier:** *What a Claude Routine actually guarantees* (open · unblocked · unclaimed).

> **Blocking edges are declared here and in each issue body, not natively in the tracker.** The
> charting session ran from a remote environment whose GitHub MCP surface exposes issue and
> sub-issue writes but no issue-dependency write. All 7 are wired as sub-issues of #307 and each
> body carries its `## Blocked by`, so the frontier is legible — but GitHub will not *render* it
> as blocked. Wire the native blocked-by edges in the UI (or from a session with a dependency
> tool) if tracker-side frontier rendering is wanted. Logged in `implementation-notes.md`.

## Not yet specified

In-scope fog — belongs to the Destination, question not yet statable precisely:

- **Per-loop placement for the 5 `manual`-rail loops.** Which of `weekly-measure`,
  `defects-sweep`, `selfco-maintenance-report`, `selfco-hot-list` moves to a routine is not
  askable per-loop until *Which loop classes may sit on a cloud rail* produces the
  classification. (`day-runner` is excluded — see Out of scope.)
- **Whether morning-cockpit's Loop pane renders routine liveness.** Depends on whether *How a
  routine becomes declarable and lintable* yields a readable `evidence_ref:` scheme at all.
- **Cluster-wide spend accounting for scheduled agent runs.** The selfco-box cost pause
  (2026-06-11) is the precedent that this can kill a rail. Not statable until *Blast radius and
  shadow-stage posture* sets the budget model.
- **Whether a future transport makes local spines cloud-reachable.** The selfco LiveSync
  migration is the precedent for a spine changing vantage. If this became real it would collapse
  the classification question — but the question is "what transport, for which spine", and
  neither half is answerable today.

## Out of scope

- **The S25 day-runner operating-mode decision itself** — ruled by the operator 2026-08-01 when
  fixing this map's Destination on rail policy rather than dispatch. This map's output is an
  *input* to S25 (as `LOOP-ENGINEERING-CROSSCHECK` §2a already framed it), not a replacement for
  it. S25 stays open and unsigned.
- **Migrating the dispatch/verify layer** — Dolt CAS queue-claim, day-runner worktrees, the
  5-clause slice contract, oracle predicates. REJECT standing from cycle-5 §2a; re-affirmed here.
- **Replacing session lifecycle hooks with routines** — hooks are event-triggered, routines are
  schedule-triggered. Different rail kinds, not substitutes; the 14 hook loops are not candidates.
- **Implementing `harness-routine` in `loops-lint.mjs`** — passes the placement litmus as a
  delivery (`success:` = lint accepts a routine entry and a broken fixture proves the ERROR path;
  `check:` = `node scripts/loops-lint.mjs --check`). It is a roadmap slice, handed off after *How
  a routine becomes declarable and lintable* closes — not a decision ticket.
