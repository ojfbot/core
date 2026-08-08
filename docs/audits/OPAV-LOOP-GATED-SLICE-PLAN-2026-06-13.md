# OPAV skill self-improvement loop — Control-Gated Slice plan (2026-06-13)

The full gated-slice decomposition (ADR-0086) of the **Observation → Planning → Acting → Verification**
loop that makes Claude Code skill usage self-auditing **and self-improving** across the fleet. Built and
adversarially stress-tested by an 11-agent workflow (run `wf_9c6f0a93-654`: 5 decompose → 5 red-team →
1 loop-closure critic; ~807k tokens). **Plan only** — each slice hands to `/plan-feature` → `/tdd`.

End goal: documents that let agents **spawn and verify completion** of every loop step:
suggestion → acceptance → suggested-skill **action** → trigger tracking → completion → **feedback**.

## Four findings that reshaped the plan (the stress-test earned its cost)

1. **The loop does NOT close as drafted — it's observability, not self-improvement.** No slice owned the
   **Routing-Feedback Writer** that mutates suggestion ranking from action data; closure was *asserted*
   in S5's last gate, not *engineered*. → promoted to a named deliverable (S5-C4b) with its own
   shadow→operational RIDM.
2. **Keystone blocker (new Slice 0): there is no durable `SUGGESTION_ID` in telemetry today** —
   verified **0 of 1,279** events carry one; joins are fuzzy temporal windows (session_id + 30 min).
   S1/S3/S4 each invent their own join key and silently disagree. Nothing is spawn/verify-able without it.
3. **The 0.8% baseline is false provenance** — the lone historical "follow" is a `skill:init`
   (beaverGame, 2026-04-27), i.e. `/init` acceptance, **not** a skill action. Must be discarded and
   AR0 re-derived after S1 lands.
4. **Confirmed live bug poisoning the denominator:** `suggest-skill.sh:57-84` marks a suggestion
   `ignored` unless it sees a `skill:suggestion-followed` event — which ADR-0092 killed for inline
   follows. So **all 575 `suggestion-ignored` events are inflated by genuine-but-uninstrumented follows.**
   Every downstream rate is built on this until S0 fixes it.

**Slice verdicts (red-team):** S0 new · S1 needs-additions · S2 needs-additions · **S3 unsafe-as-drafted
(stub)** · S4 needs-additions · S5 needs-additions. All additions are folded in below.

## Revised slice ladder (corrected order)

| # | Slice | OPAV | Ships |
|---|---|---|---|
| **S0** | **Suggestion identity + denominator repair** (NEW keystone) | Observation | a stable `SUGGESTION_ID` threaded everywhere + an un-poisoned denominator |
| S1 | Action instrumentation | Observation | a trustworthy, **two-source** action-rate number |
| S2 | Repo-scoped skill relevance | Planning | durable per-repo routing (ADR `repo-scoped-skill-relevance`) |
| S3 | Action-rate confidence gate | Verification | the RIDM gate that licenses autonomy |
| S4 | Duplex task queue | Planning+Acting | safe bead↔issue queue (ADR `duplex-work-item-sync`) |
| S5 | Autonomous multiagent loops **+ Routing-Feedback Writer** | Acting + loop-closure | autonomy + the writer that **closes** the loop |

**Order:** S0 first (keystone) → S1 (measure-first) → S3 re-baseline ∥ S2 (S2's labels need S1's usage
data — explicit dependency, not parallel-by-default) → S3 promotion → S4 (substrate in parallel; its
`op_id` **must be** the S0 identity) → S5 last, entrance **AND-gated** on (S3 action-rate RIDM) AND
(S4 fencing + reconciler-convergence) AND (S1 honesty-validator **ACTIVE**, not optional).

## Inputs considered and rejected (2026-06-13 DeepStack review)

The DeepStack review (`DEEPSTACK-ARCHITECTURE-EVALUATION-2026-06-13.md`) proposed one input that does **not** belong in this ladder and surfaced one that does:

- **Rejected — "rewrite skill descriptions to DeepStack's template as an early measurable routing win."** Our suggester is split: the mechanical path (`suggest-skills.mjs:104-198`) scores `triggers`/`tags`/`phase`/`suggested_after` and never reads the prose `description`, so a rewrite moves Layer A by zero; the agent-self-routing path (Layer B) had its real failure fixed behaviorally by ADR-0068. And it is not "cheap to test" — like everything here it is **S0-gated** (no trustworthy fire-rate denominator until `SUGGESTION_ID` + denominator repair land). Do **not** schedule description-prose rewrites as an early measurable slice.
- **Accepted as a candidate — multi-modal skill triggers (path globs + lifecycle events).** DeepStack's genuine lesson: our suggester is keyword-only. This is a distinct capability from S2 repo-relevance and is filed as a provisional **S2.5 / draft ADR `multi-modal-skill-triggers`** in `draft-repo-scoped-skill-relevance.md`, entrance-gated on S0 `SUGGESTION_ID` + S1 action instrumentation like the rest of the ladder.

---

## S0 — Suggestion identity + denominator repair  *(keystone; ADR: `draft-suggestion-identity-and-denominator`)*
- **C0 mint `SUGGESTION_ID`** at suggestion time in `suggest-skill.sh`; echo on every downstream event.
  TPM: % of new `skill:suggested` carrying a unique id (baseline 0/1279) → pass 100%.
- **C1 fix ignored-detection** to recognize an inline funnel-close (a `skill:acted` or Stop-hook signal),
  so genuine follows stop being mislabeled `ignored`. TPM: replay the historical window — `ignored`
  count drops by the count of corroborated inline follows; pass = drop ≥ the corroborated-follow count, 0 regressions.
- **C2 discard 0.8%**; mark AR0 "to be re-derived post-S1" in writing.
- V&V: Verification (id integrity) + Validation (denominator now means what it says).

## S1 — Action instrumentation  *(Observation; ADR: `draft-skill-action-instrumentation`)*
Make "suggestion acted on" measurable for inline (Skill-tool-bypassing) follows. Gates:
- **C0** `skill:acted` event schema + honesty-contract spec (carries `SUGGESTION_ID`, `expected_artifact`,
  `mode`, `op_id`). Pass: 20/20 schema-lint, ≥18/20 join-resolve.
- **C1** agent-emitted emitter **+ an independent Stop-hook/PostToolUse-on-SKILL.md-Read reconciler from
  day one** (two-source — agent compliance alone is the exact 0.8% failure mode). TPM: capture-rate vs
  the *independent* signal ≥70%; **add a two-sided over-capture/false-emit TPM ≤10%** (cheap-to-emit,
  expensive-to-do gaming).
- **C2 (SHADOW)** outcome cross-check validator, observe-only. **Trace must be produced by a different
  mechanism than the emitter and be skill-specific** (an ADR stub for `/adr`, a CONTEXT.md diff for
  `/grill-with-docs`) — **ban self-written log-line-as-its-own-corroboration**. Add an adversarial
  trace-injection test (seed fake `skill:acted`, require the validator to catch them). Add a **third
  verdict (pending/indeterminate)** for slow/unconventional output. TPM: false-flag ≤5%, coverage ≥90%
  over ≥2wk/≥100 events.
- **C3** re-derived baseline action-rate readout, **raw and backed-only**; scope explicitly as
  `acted / suggested-uninstalled` (the inline-path denominator, tiny-N today ≈15) **with a minimum-N
  power gate** before S3 may consume it. Add a join correctness oracle (precision/recall vs a gold set),
  not just determinism.
- **C4 (RIDM)** promote validator shadow→active (quarantine unbacked out of the backed-only rate) on
  false-flag ≤5% + coverage ≥90% sustained + zero genuine-action exclusions in last 30 gold events;
  drift >2pp → auto-revert. **C4 is a HARD prerequisite for S5 autonomy, not optional.**
- *Idempotency:* `skill:acted` carries an `op_id` (S4 pattern) so retries + the reconciler don't double-count.

## S2 — Repo-scoped skill relevance  *(Planning; ADR: `draft-repo-scoped-skill-relevance`, already filed)*
Gates C0 ground-truth → C1 schema (`applies_to`/`lang` + `repo-profile.json`) → **C2 SHADOW
report-would-prune** → C3 operational per-repo PR-gated → C4 fleet convergence. **Red-team addenda
(must fold into the ADR):**
- **Label/filter independence:** golden labels must NOT derive from the same audit doc as `applies_to`;
  ground contested-band labels in **observed usage** + a 2nd labeler (Cohen's κ ≥ 0.7), sealed hold-out repo.
- **Per-repo worst-case** false-prune ≤1% (never a fleet average); recall/precision **on the contested
  band only** (agent-debug, lint-audit, screenshot-audit, council-review, rag-audit).
- **Suggester architecture:** `suggest-skill.sh` runs the scorer at `--limit=1`, so a suppressor only
  ever sees the top-1 winner — a confusion matrix is impossible there. The filter must run **inside
  `suggest-skills.mjs` against the full scored set** (pre-limit), or drop the suggester confusion-matrix
  claim and gate on a live follow-rate A/B.
- Demote `PRUNE_VOLUME` to a non-gating diagnostic; gate on **identity** (which skills), not count.
- Fail-open **fault-injected and proven** (malformed profile/catalog ⇒ keep-all), not asserted.
- Add an **`autonomy_safety` field distinct from relevance** (relevance ≠ autonomy-safe).

## S3 — Action-rate confidence gate  *(Verification; ADR: rebuild from stub — `draft-action-rate-gate`)*
**Was unsafe-as-drafted (a one-gate stub, id literally "test").** Rebuilt per red-team:
- **C0** re-baseline: discard 0.8%; recompute AR0 under the corroborated `SUGGESTION_ID` definition after
  S1; state number + capture window. Self-reported and corroborated are **separate TPMs; their divergence
  is an alarm.**
- **C1 (SHADOW)** friction-reduction nudges — observe corrected-rate movement, no auto-install.
- **C2 (SHADOW)** auto-install of hot skills — log "would install X", **no FS mutation**, checked against
  S2 relevance.
- **C3 (OPERATIONAL, RIDM)** auto-install live. RIDM TPMs (all numeric): corrected-action-rate sustained
  ≥ X over N sessions; self-vs-corroborated divergence ≤ Y (breach → quarantine skill + halt); data-quality
  null-id rate ≤ Z; **+ minimum-N power floor** and a **telemetry-freshness SLO** (no promotion on a feed
  not provably live — the stale-green guard).
- This slice's sustained corrected-action-rate TPM **is** the autonomy-licensing gate for S5 (co-equal
  with S4-C6).

## S4 — Duplex task queue  *(Planning+Acting; ADR: `duplex-work-item-sync`, already filed)*
Gates turn the ADR invariants into zero-tolerance soak TPMs: C0 projector + divergence telemetry → C1
op_id outbox (T1 duplicate-intake = 0 over ≥10k create-before-ref races) → C2 fencing (T2 double-completion
= 0 over ≥5k zombie-overlap) → C3 rev/tombstone (T3 resurrection = 0) → C4 liveness (MAX_LEASE + dead-letter)
→ C5 reconciler SHADOW → **C6 reconciler operational + single-claim-with-fencing certified (T6 = 0 safety
incidents over ≥72h sustained duplex load)**. **Red-team addenda (fold into the ADR):**
- **New intake gate before C2: task autonomy-safety classification** (fenceable/idempotent vs human-gated;
  fail-closed). 0 un-fenceable-non-idempotent tasks admitted to a reclaimable lease.
- **Split completion TPM into bead-side AND instrumented-sink-side** (an external side effect can
  double-fire while the bead row reads green — the catastrophic case under S5 load). Promotion needs both.
- Reconciler **detection-recall** TPM (injected divergences detected = 1.00), separate from repair correctness.
- Validate C1/C3 against a **real GitHub sandbox replaying captured webhook traces** (at-least-once,
  multi-hour redelivery, reorder); tombstone-retention ≥ max-redelivery-horizon.
- Borrow S1's honesty contract for **completion** (independent side-effect trace, not a bead row alone).

## S5 — Autonomous loops + Routing-Feedback Writer  *(Acting + loop-closure)*
- **C0** autonomy-safety classification + entrance cert (TPM2 false-safe = 0 on adversarial sample **with
  exposure floor** — 0/100 ⇒ ≤~3% at 95% CI, not "zero").
- **C1 (SHADOW)** propose-pickup / human-approve (Cockpit gated Handoff-Emission; cite by slug per ADR-0087,
  not "ADR-0005/0006"). TPM3 acceptance ≥80% with **≥2 approvers, edit-then-accept counts against the bar.**
- **C2** bounded autonomous delivery, **runtime AND-gate:** fires only if `autonomy_class==safe` **AND**
  valid S4 fence at the sink **AND** op_id honored. TPM6 fencing-violation = EXACTLY 0 over ≥200 deliveries
  → any violation reverts to C1. **Run an S4×S5 contention game-day BEFORE C2** (S5 is S4's first real stressor).
- **C3** autonomous verify + honesty cross-check. TPM9 self/artifact agreement ≥98% **AND-gated with TPM10
  independent human-audited correctness** before any unattended close (gaming agent acts-false + verifies-false).
- **C4a** staged concurrency ramp (N=1→2→3), each its own RIDM with reconciler-convergence-under-contention.
- **C4b (the loop closure) — Routing-Feedback Writer:** reads corroborated action-rate per (skill, archetype)
  from S1+S3 and would-prune precision from S2; **adjusts SUGGESTION RANKING ONLY**; runs SHADOW
  ("would-reweight" deltas vs a frozen-scorer control) → operational via RIDM using **difference-in-differences
  / interleaved A/B** (not a raw trend — avoids reading S3 coattails as routing lift); per-cycle delta caps +
  anti-windup; gated on the **independent** correctness signal (TPM10), never agent self-green.

---

## Cross-slice invariants (global — must hold across all slices)
1. **Identity unity:** one `SUGGESTION_ID` (S0) is the single join key through suggested→acted (S1)→
   action-rate (S3)→queue op_id/fence (S4)→delivery (S5). No event without it.
2. **No step "done" without an independent, causally-derived artifact** — one honesty contract reused in
   S1, S4-completion, S5-verify (not three).
3. **Fail-direction is opposite by domain:** S2 relevance fails **open** (unclassified ⇒ keep); S4/S5
   autonomy fails **closed** (unclassified ⇒ human-gated). Never conflate — hence `autonomy_safety` ≠ relevance.
4. **Event-type partition:** `would-prune`/`would-suppress` (S2) vs `skill:acted` (S1) vs suggestion events
   are hard-partitioned; S3's rate filters by type so S2 prune volume can't pollute the autonomy baseline.
5. **Dedup/idempotency everywhere a retry can double-count** (S1 emit, S4 intake/completion, S5 delivery).
6. **Telemetry-freshness SLO:** no RIDM promotion fires on a feed not provably live (the stale-green guard —
   skill-telemetry's signature failure is *silent* staleness).
7. **Firebreak (most important once the loop closes):** routing feedback adjusts **suggestion ranking ONLY** —
   never the autonomy classifier, eligibility filter, or human-gated boundary. **Autonomy cannot widen its own scope.**
8. **Runtime AND-gate:** an autonomous action fires only on `autonomy_class==safe` AND valid sink fence AND
   honored op_id. Classification is a filter, never a substitute for runtime fencing.
9. **Exposure floors** on every `=0`/`=100%` bar (S3 rate, S5 TPM2/TPM6/TPM13) — a clean window on tiny
   exposure cannot promote.

## Spawn / verify readiness (the end goal) — currently **NO**
`can_spawn_each_step: false · can_verify_each_completion: false`. To reach the end goal, build (in order):
1. **`SUGGESTION_ID`** (S0) — without it no completion can be independently joined → nothing verifiable. *Biggest blocker.*
2. **S3 slice body** — it's a stub; write C0–C3 + RIDM before it's spawnable.
3. **Per-skill `expected_artifact` map** (S1) — without it "action completed" has no machine-verifiable definition.
4. **Independent (non-self-report) action-detection channel** (S1 Stop-hook) — only 13 `skill:invoked` + 1
   init-follow exist in all history; verification of the action step is otherwise impossible.
5. **Re-derived AR0** (post-S1) — the inherited 0.8% measured `/init`, not skill action.
6. **A spawn/verify harness contract per step:** (a) a spawn trigger keyed on `SUGGESTION_ID`, (b) a
   completion predicate over a verifiable artifact. Steps *act / track / feedback* have no predicate today.
7. **S4 reconciler convergence + the S4×S5 contention game-day** — autonomous spawn isn't verify-safe until
   the reconciler provably converges under S5's concurrency.

## Top risks
- **Loop never closes** (feedback writer was unowned) → mitigated: S5-C4b named deliverable + own RIDM.
- **Identity drift** (no `SUGGESTION_ID`) → S0 keystone.
- **Baseline on false provenance** (0.8% = `/init`) → re-derive AR0, discard in writing.
- **Self-report gaming survives to autonomy** → S1-C4 HARD prereq for S5; AND-gate unattended close on TPM10.
- **Self-reinforcing routing loop** → diff-in-diff A/B + delta caps + anti-windup; gate on independent correctness.
- **Stale-green promotion** → telemetry-freshness SLO everywhere.
- **Bead-green while sink double-fires** (catastrophic under S5 load) → split bead-vs-sink completion; game-day before C2.
- **Autonomy scope creep** → the firebreak invariant.

## ADR map + next
| Slice | ADR | Status |
|---|---|---|
| S0 | `draft-suggestion-identity-and-denominator` | **to write (this pass)** |
| S1 | `draft-skill-action-instrumentation` | **to write (this pass)** |
| S2 | `draft-repo-scoped-skill-relevance` | filed — needs red-team addenda |
| S3 | `draft-action-rate-gate` | to write (rebuild from stub) |
| S4 | `draft-duplex-work-item-sync` | filed — needs red-team addenda |
| S5 | `draft-autonomous-loops-and-routing-feedback` | to write |

**Next:** accept S0 + S1 ADRs → hand S0 to `/plan-feature` → `/tdd` (it's the unblocker, ~1 PR). Everything
else waits on S0's `SUGGESTION_ID` landing. Pickup bead: `core/.handoff/2026-06-13-opav-loop-program.md`.
