# Fleet Coordination Extensions — Karpathy / Yegge / Pocock latest — 2026-07-04

> Cycle 4 (`DIA-CROSSCHECK-2026-07-08.md`) cross-checked this doc against an independent
> external survey; the §2 do-not-import list and F4's >5-agent rule both held.

Cycle 3 of the 2026-07-04 audit series. Cycle 1 (`MULTIAGENT-SDLC-AUDIT-…`) found the gaps;
cycle 2 (`AGENTIC-INTEGRATION-PLAN-…`) mapped industry eval/observability consensus onto them.
This cycle asks the three thinkers this cluster is already built on — **Karpathy** (selfco LLM
wiki), **Yegge** (beads / Gas Town / convoy vocabulary), **Pocock** (the four Pocock skills) —
what their late-2025→mid-2026 output changes about coordinating parallel work across the fleet,
with the human helped rather than buried. Three web-research passes back it; sources dated inline.

---

## 0. The convergent thesis

All three, independently, arrived at the audit's own conclusion: **the fleet's throughput is a
function of human attention allocation, not agent count.**

- **Karpathy** (No Priors, 2026-03-20): "If you don't feel very bounded by your ability to spend
  on tokens, then you are the bottleneck." He runs single-digit parallel agents on ~20-minute
  leashes, called the agent-swarm camp premature (X, 2026-01-26), and his only endorsed
  unattended loop — `autoresearch` (2026-03) — is maximally constrained: one editable file, one
  scalar metric, fixed time budget, human-authored program spec.
- **Yegge's community** (Maggie Appleton, Jan 2026): "Gas Town churns through implementation
  plans so quickly that you have to do a LOT of design and planning to keep the engine fed."
  DORA-correlated data (via Mike Mason, Jan 2026): high AI adoption ⇒ +91% review time, +154%
  PR size. Gas Town's v1.0 answer is machinery that *protects* the human: severity-routed
  escalation with the Overseer as final tier, a bisecting merge queue, watchdogs, and durable
  work-state so agents self-recover instead of asking.
- **Pocock** (Apr 2026 workshop): the pipeline exists to convert scarce human judgment into
  parallel-safe artifacts — grill → PRD → a **DAG of independently-grabbable issues**, each
  classified **HITL vs AFK at triage time**, then Ralph loops on the AFK set while the human
  QAs. "We are not producing slop here."

So the extension program below has one design goal: **every unit of your attention lands on the
highest-leverage decision, and everything else either self-propels or waits quietly.**

A validating note first: this cluster is not behind. The Dolt bead bet is now the upstream
default (bd 1.0 embeds Dolt; JSONL demoted to interchange — beads README, 2026); your CAS
`queue-claim` is *ahead of* Wasteland phase-1 claim semantics ("claims are a signal of intent,
not a lock"); cockpit's recency-derived liveness matches Gas Town's event-derived model; your
merge-gated odometer is Karpathy's "oversight and scrutiny" line; and Anthropic itself
productized beads-shaped memory as Claude Code Tasks ("We took inspiration from projects like
Beads" — via paddo.dev). The gaps are specific, not structural.

---

## 1. Extension slices F1–F10

Continues the H (hardening) and I (integration) series; same ADR-0086 discipline. Ordered so
the attention-routing spine (F1–F3) lands first.

### F1 — Verifiability-sorted dispatch (Karpathy's autoresearch contract × Pocock's triage state machine)
The single most important upgrade to `/day-run`. Karpathy's rule: autonomy works only "for
anything that has objective metrics that are easy to evaluate" — without one, agents meander.
Pocock's current `/triage` is no longer a scoring rubric; it's a state machine whose key output
is **`ready-for-agent` vs `ready-for-human`** (mattpocock/skills, June 2026 state).
- **Build:** add `autonomy_fit` to the roadmap-slice schema, derived from one question: *does
  this slice carry a machine-checkable success command?* (`check:` — a test command, a script,
  a measurable target). `roadmap-compile` only queues `ready-for-agent` slices for overnight;
  everything else lands in the cockpit Pickup lane as `ready-for-human` with the reason.
  Extend `/triage` to Pocock's states (needs-triage / needs-info / ready-for-agent /
  ready-for-human / wontfix) + verify-the-claim-before-grilling + agent-brief emission (his
  AGENT-BRIEF.md maps 1:1 onto your bead brief type).
- **Ties to:** audit O2, I6; makes the I6 verification stage *checkable by construction*
  because AFK slices are metric-bearing by admission rule.
- **Measure:** % of overnight slices with a passing `check:` at PR time; % of queue items
  correctly routed (your morning reclassifications are the label).

### F2 — Self-propulsion: hook beads + GUPP + checkpointed slices (Gas Town MEOW lessons)
Your day-runner is push-dispatch; a crashed or timed-out session loses its progress and waits
for the next morning. Gas Town's answer: a pinned **hook** bead per agent + the GUPP law ("If
there is work on your Hook, YOU MUST RUN IT") + molecule checkpoint recovery ("If you would
curse losing the progress after a crash, set `pour = true`").
- **Build:** (a) hook bead per day-runner worker; the brief's first instruction is GUPP —
  resumed/restarted sessions self-continue from the hook instead of starting cold; (b) slice
  steps as child beads with completed-steps-stay-closed semantics, so a re-dispatched slice
  resumes at the checkpoint; (c) adopt the ephemeral/wisp class for patrol-ish records —
  Gas Town's 6,000-rows/day lesson says your `bead_events` needs a compaction story
  (`dolt gc` + semantic-decay summarization of old closed work).
- **Ties to:** O4 (retry semantics), H5; NDI ("nondeterministic idempotence") is the design
  name for what your queue already half-does — unreliable agents + durable beads + watchdogs
  ⇒ eventual completion.

### F3 — Push escalation to complement the pull cockpit (Gas Town escalation × your gate doctrine)
Morning-cockpit is pull-only: an overnight blocker waits silently until you look. Gas Town
routes `gt escalate -s HIGH` up Deacon → Mayor → **Overseer (you)**, CRITICAL adds SMS/email,
stale threshold 4h with max 2 auto re-escalations. Your own selfco canvas doctrine already
demands "needs-you-now first — each waiting gate as a clickable door + how many downstream
tasks it blocks"; this is that, mechanized.
- **Build:** an `escalation` bead type with severity + blocking-count; day-runner and the
  weekly measurement session emit them on quarantine, SLO breach, or repeated failure; a tiny
  notifier (launchd + push/email — same rail as pipeline-alert) pages only ≥HIGH; cockpit
  renders an escalations strip above the lanes, ordered by downstream-blocked count. Stale
  re-escalation with a hard cap of 2 — then it *stops paging* and waits in Pickup (respecting
  attention, both directions).
- **Measure:** time-to-acknowledge for HIGH; pages/week (should be near-zero in steady state —
  a noisy pager is a failed contract).

### F4 — Review that scales: conceptual rubric now, bisecting merge queue later
Two horizons. **Now** (any agent count): Karpathy's four failure patterns — *silent
assumptions, hypertrophy, collateral changes, missing success criteria* (X, 2026-01-26) —
become the merge-gate review rubric, and the PR template requires the agent to state **its
interpretation of the task and its success criterion** so you review the concept, not the
diff lines. Pocock's push-vs-pull rule slots here: implementer agents *pull* standards
(skills on demand); reviewer agents get standards *pushed* in-context. **Later** (>~5
concurrent agents): Refinery-style MR beads + batch verification + bisect-on-red — the serial
merge gate is the known throughput cliff; don't build it before the cliff is visible.
- **Ties to:** O2/I6 (the shadow test gate supplies the batch-verify primitive when the time
  comes); Sandcastle's model split is worth copying meanwhile — implementation and review in
  **separate fresh contexts**, reviewer on the stronger model.

### F5 — Problems-view taxonomy for the Overnight lane
Upgrade `deriveAgentLiveness`'s live/idle/dark to Gas Town's five states — **Working / Idle /
Stalled / Zombie / GUPP-violation** — each with an intervention affordance (nudge / handoff /
reclaim). Computed from `bead_events` recency + hook state (F2), which is exactly the data
cockpit already trusts. Cheap, high signal, directly "human-helping": the lane answers *what
needs intervention* instead of *what exists*.

### F6 — Context economics as enforced budget, not prose
Pocock's measured claim: quality degrades sharply past ~100k tokens — "shipping more dumb
zone" (X, 2026-03-19); his Ralph doctrine prefers **full context resets over compaction**
(fresh `claude -p` per iteration), which your bead re-anchoring already implements — keep it
and don't adopt `/compact`-style summarization for workers.
- **Build:** day-runner briefs declare a context budget and instruct re-anchoring (re-read
  brief + progress beads) rather than continuation past it; `/orchestrate`'s context-budgets
  doc gets the 100k number as a hard line. Two catalog audits from his June 2026 material:
  a **no-op-instruction lint** ("be thorough", "make it detailed" — delete on sight) and the
  **invocation-axis split** (user-invoked orchestration skills vs model-invoked discipline
  skills; his v1 restructure cut skill-description token cost 63%).
- **Ties to:** E-series (skill-audit gains two deterministic checks); O7.

### F7 — Refresh the four Pocock skills from their now-canonical upstream
mattpocock/skills (157k stars, June 2026) has evolved all four beyond your copies:
- `/tdd`: **seam pre-agreement** ("No test is written at an unconfirmed seam"), named
  anti-patterns (tautological tests, horizontal slicing), and "refactoring is not part of the
  loop" (it belongs to review).
- `/triage`: the state machine (F1) + an **`.out-of-scope/` knowledge base** checked before
  grilling — your cultivate `_resolved-pairs.tsv` pattern, generalized to work-intake.
- `/deepen`: the **deletion test**, interactive pick-and-grill, and **rejection-ADRs** so
  future reviews stop re-suggesting rejected refactors (anti-resuggestion memory — same
  Goodhart-adjacent guard as cultivate's declined list).
- `/grill-with-docs`: upstream decomposed into reusable model-invoked primitives
  (`/grilling`, `/domain-modeling`) other skills can call. Keep your "one highest-leverage
  question" default (it's better for daily use); adopt the decomposition and his
  decision-tree-exhaustion mode for pre-PRD sessions.
Run this as an `/adopt-stack` pass (wrap/absorb/reject per divergence), not a blind sync —
several of your variants are deliberate.

### F8 — Verification attestations: stamps + the yearbook rule (Wasteland, minus the federation)
Your merge gate is binary and your agents accumulate no track record. Wasteland's useful core,
extractable without any federation: **completion evidence reviewed and stamped by a non-author**
(the yearbook rule: you can't stamp your own work), stored as multi-dimensional data
(quality/reliability, each with confidence) on a persistent per-agent identity (Gas Town
polecats keep a "CV chain" across ephemeral sessions).
- **Build (shadow-first):** the I6 verification stage's output *is* a stamp once it's emitted
  by a separate reviewer session (F4's fresh-context reviewer); accumulate stamps on the agent
  bead. Downstream (an RIDM decision, months out): stamp history informs `autonomy_fit`
  thresholds per repo — the data-gated path to widening autonomy that the OPAV S5 firebreak
  requires.

### F9 — Memory consolidation + session archaeology
Direction, not urgency. Yegge's bd 1.0 folds memory into the bead store (`bd remember` →
`bd prime` injection; README: "do not create MEMORY.md files"), decays by summarization, and
adds **seance** — interrogate predecessor sessions discovered from events JSONL. You have all
the raw materials (session-telemetry, `.handoff/`, `/resume`'s ledger).
- **Build:** (a) a `seance`-style mode on `/resume` — query a prior session's transcript
  instead of only reading its beads; (b) evaluate Claude Code native Tasks as the
  session-level layer under Dolt beads (paddo.dev's layering: Tasks = session, beads =
  project); (c) selfco imports from the LLM-wiki community wave (rohitg00 v2, theaioperator,
  Ar9av — all 2026): **AI-first page formatting** (write for the retrieving LLM), per-claim
  confidence/provenance tags, retrieval that isn't whole-file reads past ~200 pages, and
  session history as a first-class ingest source. Your vault already leads on scheduled
  maintenance and supersession; these four are the genuine deltas. This also merges I7's
  lessons pipeline target: lessons live as beads/wiki claims, not a parallel MEMORY.md.

### F10 — Operational hygiene from Gas Town's scars (cheap, do early)
Each of these is a reported production failure upstream; your stack shares the substrate:
1. **Pin Dolt ≥ 2.1.0** — GC/writer deadlock fix (`ccf7bde206`); older builds can hang
   backup sync under write load (gascity README).
2. **One designated clone runs schema migrations** — beads' hard rule; violating it diverges
   remotes.
3. **JSONL export ≠ backup** — add a real restorable `dolt backup` path (compounds audit T9).
4. **Orphan-process sweep** — Gas Town leaked 141 headless Claude processes; add a day-runner
   post-run reap + a Monitor check.
5. **Recovery agents get stricter guardrails than workers** — the Deacon "serial killer
   sprees" lesson: any future janitor/watchdog (opportunity H in cycle 2) must be
   quarantine-only, never kill-and-restart, until RIDM-promoted.
6. **Consent allowlists for anything scheduled** — Gas Town's #3649 controversy (default
   formulas spent users' tokens on upstream repos, undisclosed): every cron/routine session
   declares what repos it may touch and what it may spend; log it.
7. **Roles stay in config/prompts, never in engine code** — Gas City exists because hardcoding
   roles in Go was the mistake (Yegge, Apr 2026). Your skills-catalog + registrations layout
   already complies; make it a stated invariant so a future executor (O1) doesn't violate it.

---

## 2. What NOT to import (as load-bearing as the imports)

- **Gas Town wholesale.** ~$100/hour ("Gas Town burns money, not gas" — DoltHub, 2026-01-15),
  months of "Clown Show" instability, and a scale posture (20–30 agents) that Karpathy calls
  premature and you don't need. Mine its designs (F2/F3/F5/F10); don't run it.
- **Persona/org-chart agent hierarchies.** paddo's "19-agent trap": persona agents optimize
  explainability, not effectiveness. Gas Town's roles that work are *operational* (coordinate,
  monitor, merge). Keep `/orchestrate` layers functional, never characters. (The daily-logger
  council is fine — it's an eval panel, not an org chart.)
- **Agent swarms beyond metric-verifiable work.** Karpathy's line, and F1 enforces it.
- **Wasteland federation.** Phase-1 claim races; you're ahead on claim semantics already.
  Stamps (F8) are the extractable part.
- **The viral "Karpathy internal CLAUDE.md".** Unauthenticated; he never confirmed it. Don't
  ingest it into the vault as his.
- **Unreviewed publishing.** Karpathy's "slopacolypse" (2026-01-26) points straight at
  auto-published daily prose. Reframe daily-logger per his own doctrine: as a **read-model
  that gets fleet state into your brain** it's load-bearing (his stated constraint: "directing
  agents is constrained by understanding"); as outward content it needs the human-taste pass —
  which the cycle-2 fact-checker (I5) plus editorial-accept gate already structure. Publish
  `accepted` only; `draft` stays internal. (Closes audit P7 with a doctrine, not just a fix.)

---

## 3. The operator interface, stated as a contract

The three-thinker synthesis, compressed into how your day should work once F1–F5 land:

- **Morning (pull, 15 min):** cockpit opens with the escalation strip (F3) — zero on a good
  day — then Overnight in problems-view taxonomy (F5): stamps green (F8), movement recorded,
  anything Stalled/Zombie has a one-key intervention. `/frame-standup` reads the same data and
  the SLO block (I8).
- **Daytime (push only):** you work interactively on `ready-for-human` items; the fleet pages
  you only ≥HIGH, max twice per item (F3). Review is conceptual (F4 rubric) on
  interpretation + criteria, not diff-skimming.
- **Evening:** `/triage` routes new work (F1); only metric-bearing slices enter the overnight
  queue; briefs carry the four-part delegation contract + `check:` command.
- **Overnight (AFK):** hook-propelled, checkpointed workers (F2) run metric-verifiable slices;
  failures quarantine with context after bounded retries; nothing merges itself; the odometer
  turns only at your merge.

That is the "human-helping" system: your attention buys design, routing decisions, conceptual
review, and promotions — and nothing else.

---

## 4. Sequencing into the existing program

```
Now (with H0/I2/I3):   F10 hygiene items 1-4  ·  F4 review rubric + PR interpretation section
Weeks 2-4 (with I4-I6): F1 autonomy_fit + triage state machine  ·  F5 problems view  ·  F6 budgets + catalog lints
Month 2 (with I6-I8):   F3 escalation beads + notifier  ·  F2 hooks + checkpoints  ·  F7 Pocock adopt-stack pass
Month 3+:               F8 stamps (shadow)  ·  F9 seance/memory consolidation  ·  F4 merge queue only if >5 concurrent
```

## Appendix — primary sources (dated)

- **Karpathy:** X 2026-01-26 (workflow flip, four failure patterns, swarm deflation,
  slopacolypse) · X ~2026-02-03 (vibe-coding retrospective) · github.com/karpathy/autoresearch
  (2026-03) · No Priors 2026-03-20 (loopy era, "you are the bottleneck") · Sequoia Ascent
  recap, karpathy.bearblog.dev (~2026-04, skills-as-md + LLM knowledge bases as new horizons) ·
  joined Anthropic 2026-05-19. LLM-wiki community: rohitg00 v2 gist (2026-07-04),
  theaioperator rebuild, Ar9av/obsidian-wiki.
- **Yegge:** Welcome to Gas Town (2026-01-01) · Clown Show to v1.0 (2026-04) · Welcome to Gas
  City (2026-04-24, roles-as-config) · Wasteland (2026-03-04, stamps/yearbook) ·
  github.com/gastownhall/{gastown,beads,gascity} docs (GUPP, MEOW/molecules, Refinery,
  escalation, problems view; current 2026-07) · DoltHub "A Day in Gas Town" (2026-01-15) ·
  community: Appleton (Jan 2026), Mike Mason (Jan 2026), paddo.dev (Tasks lineage, 19-agent
  trap), Tenzin Wangdhen (Feb 2026), gastown issue #3649 (consent).
- **Pocock:** github.com/mattpocock/skills (v1 restructure 2026-06-17) · AI Engineer workshop
  2026-04-24 (five-phase workflow, smart/dumb zone, push-vs-pull, HITL/AFK Ralph) ·
  aihero.dev Ralph posts (Jan 2026) · X 2026-03-19 (dumb zone), 2026-06-18 (skill imports),
  2026-06-24 (no-op instructions) · github.com/mattpocock/sandcastle · Evalite.
- Fetch caveat: X/Medium/aihero direct fetches were proxy-blocked; claims corroborated via
  ≥2 secondary sources or raw GitHub; spot-check verbatim quotes before external use.
