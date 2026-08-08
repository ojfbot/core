# Multi-Agent SDLC & Observability Audit — 2026-07-04

Consolidated gap analysis of the ojfbot multi-agent development system: telemetry, priority/data
observability, decomposed orchestration, and self-improving evaluation (OPAV/OTAV) loops.
Audit-only — no code changes. Produced by four parallel read-only audit agents (one per dimension)
plus a cross-synthesis pass.

Repos audited on disk: **core**, **daily-logger**, **selfco**, **morning-cockpit**.
Sibling repos referenced by the northstar registry (f1-*, silicon-empires, cv-builder, shell, …)
were not in scope of this checkout; where their absence itself is a finding, it is flagged.

Builds on: `HARDENING-AUDIT-2026-03-30.md` (app-level security/resilience — not re-reported here),
`DEEPSTACK-ARCHITECTURE-EVALUATION-2026-06-13.md`, the OPAV gated-slice program
(ADR-0093, ADR-0094, ADR-0095; beads in `.handoff/`), and ADR-0086 (control-gated slices).

---

## Executive summary

The cluster's architecture of self-improvement is unusually sophisticated — and largely **built
but not running**. The dominant failure mode is not missing design; it is loops that were
architected, shipped to shadow stage, run once, and never re-entered. Five cross-cutting themes
explain ~80% of the findings:

1. **Measurement was built once and never re-run.** `skill-metrics` has exactly one snapshot
   (2026-04-28 baseline) against a claimed weekly cadence; `/vault sync` last ran 2026-06-11
   (23 days); TECHDEBT.md frozen since 2026-05-12 with 4 of 5 items open. Every loop's
   "re-measure" stage is aspirational.
2. **Shadow-mode purgatory.** ADR-0086 discipline (shadow → operational) is consistently applied
   on entry and never promoted on exit: roadmap/northstar lint, reconcile-tracking, skill-audit,
   selfco lint-gate (in-repo), verify-session — all observe-only, none wired into CI, no RIDM
   promotion decision ever recorded.
3. **Documented components that don't exist.** The docs describe a more robust system than the
   disk holds: daily-logger `src/bead-store.ts` + ADR-0043 filesystem fallback (absent),
   cockpit `adapters/github.ts` + `adapters/standup.ts` (absent), the deliverable-tracking
   spine's `packages/workflows/dist/` (never built) and `~/selfco/tracking/` ledger (absent in
   the vault), and the OPAV master plan `OPAV-LOOP-GATED-SLICE-PLAN-2026-06-13.md` itself —
   referenced by beads, ADRs, and the DeepStack evaluation, **never committed to any repo**.
4. **Three identity systems, no join.** `suggestion_id` (OPAV S0), the gate spine's
   `correlation_id`, and the two bead lineages (convoy `hq-convoy-*` vs roadmap `rm:…#S…`)
   are each internally sound and mutually unjoinable. A decomposed task cannot be traced
   prompt → suggestion → child agents → PR → merged movement.
5. **"Validate" means artifact-shaped, not correct.** day-runner marks a slice ✓ when a PR
   exists with a regex-matching proposal line — it never runs tests or the slice's `success:`
   criterion. techdebt apply "lands the patch as-given" with no re-check. daily-logger's
   truthfulness rests entirely on prompt obedience (TD-001, open since March, fired again
   today: the 2026-07-04 article on disk is a `generation-failed` stub). Council critiques are
   consumed once and discarded; personas have never been revised; there is no golden set, no
   LLM-judge regression, no before/after measurement anywhere in four repos.

The strongest assets to build on: **System B dispatch** (roadmap-compile → atomic CAS
queue-claim → day-runner worktree isolation + timeout → merge-gated record-movement odometer)
is genuinely engineered and concurrency-safe; the **cockpit's liveness derivation** refuses to
trust `agent_status` and counts what it drops; **selfco's Goodhart guardrail** ("an empty run
is a success state" + `_resolved-pairs.tsv` memory) is the best anti-metric-gaming design in
the cluster; and the **suggestion funnel has a real durable join key** since ADR-0093.

---

## OPAV program status (as reconstructed from beads + ADRs + git)

| Slice | Status | Evidence |
|---|---|---|
| S0 — suggestion identity + denominator | **Shipped** (ADR-0093 accepted) | `.handoff/20260613-1959-report-…`; `suggest-skill.sh` mints `suggestion_id`; replay corrected ignored 581→561 |
| S1 C0–C2 — skill-action instrumentation | **Shipped SHADOW** (ADR-0095, PRs #157/#158, merged 2026-06-14) | `.handoff/20260618-brief-…`; live source moved to `~/selfco/tracking/skill-dispositions.jsonl` |
| S1 C3 — litter/usage surface + capture verification | **Open** — brief written 2026-06-18, no ship bead since | `.handoff/20260618-brief-pickup-opav-s1-c3-litter-usage-signal.md` |
| S2–S5 | Not started; S2/S4 ADRs carry unfolded red-team addenda | program bead `2026-06-13-opav-loop-program.md` |
| Master plan file | **Never committed** — exists only on the operator's Mac | `git log --all -- OPAV-LOOP-…` empty; referenced by ≥3 beads + DeepStack eval |

The program's own keystone insight ("nothing is verifiable without identity") has not been
extended to the systems built *after* it: the northstar/day-runner stack (late June) minted a
fourth identity scheme (`ns:`/`rm:` refs) with no link back to suggestion/gate/convoy identity.

---

## Findings

Severity: HIGH = actively producing wrong data or silent loss today; MED = will bite under
load/failure or blocks the loop from closing; LOW = drift/hygiene.

### T — Telemetry pipeline

| # | Finding | Severity |
|---|---------|----------|
| T1 | **Dual source-of-truth schism.** `skill-metrics.mjs` reads the live `~/selfco/tracking/skill-dispositions.jsonl`; daily-logger `collect-telemetry.ts:93,113-129` still reads `skill-telemetry.jsonl` — dark since 2026-05-12 (ADR-0092 inline-follows bypass the Skill hook). The blog's skillTelemetry section silently under-reports adoption to ~0. `log-skill.sh` still writes the dead stream. | HIGH |
| T2 | **No rotation/retention/size bound on any JSONL sink** (`_lib.sh:77-82` unbounded append). `log-skill.sh:47-49` full-file `jq` scan of suggestion-telemetry on every invocation — O(n) per event, n grows forever. | HIGH |
| T3 | **No cross-agent trace model.** `session_id` only; no convoy/trace/parent-child key in tool/skill/session streams; Dolt beads and JSONL share no key; gate spine `correlation_id` unwired to either. | HIGH |
| T4 | **Silent loss under Dolt outage.** All bead emissions are `\|\| true` by design (`orchestrate/SKILL.md:373`); Dolt down ⇒ entire convoy lifecycle no-ops with no buffer, retry, or alarm. | HIGH |
| T5 | **No schema validation on telemetry write or read.** Writers hand-build JSON via `jq -nc`; no shared schema module, no `schema_version` field. daily-logger CLAUDE.md claims Zod `ToolEntry`/`BeadSchema` — neither exists. | HIGH |
| T6 | Concurrent appends from parallel agents rely on an unverified PIPE_BUF assumption (`_lib.sh:80`); lines with args/input_summary can exceed 4096B ⇒ torn lines, silently skipped by readers. No flock, no per-session shard. | MED |
| T7 | No idempotency on event emission (JSONL or `bead_events`); the gate spine has op_id idempotency but the pattern wasn't applied elsewhere. Suggestion dedup lives in `/tmp` (lost on reboot). | MED |
| T8 | **No latency, cost/tokens, duration, or success/failure fields anywhere.** `tool:used` has no exit status; `session:start` has no matching end. Adoption is measured; efficacy, speed, and spend are not. | MED |
| T9 | Exfil is `git push --force` to a single orphan branch (`sync-telemetry.sh:166`) — one racy run destroys synced history. Hardcoded `/Users/yuri` paths; live metrics source is an untracked vault dir owned by an external daemon. | MED |
| T10 | `standup-telemetry.jsonl` is emitted and audited but has no wired consumer (cockpit standup adapter absent). | LOW |
| T11 | daily-logger documented `src/bead-store.ts` filesystem-fallback (ADR-0043) does not exist; actual emitter is Dolt-only. | LOW |
| T12 | Quality-coverage logic duplicated in `analyze-telemetry.sh:177-201` and `collect-telemetry.ts:157-181`, both keyed on the dead stream (T1). | LOW |

### O — Orchestration & decomposed workflows

| # | Finding | Severity |
|---|---------|----------|
| O1 | **`/orchestrate`'s 4-layer pipeline is unenforced prose.** No executor script exists; worktree isolation, context budgets, the Step-3 human checkpoint, and L3 test-running are all model instructions with no mechanical enforcement. | HIGH |
| O2 | **day-runner's validation gate is structural, not correctness.** ✓ = claimed ∧ pushed ∧ PR-exists ∧ proposal-regex (`day-runner.mjs:213-221,265`). Tests are never run; the slice `success:` criterion is never checked. A red PR with a hand-typed proposal line passes. | HIGH |
| O3 | **`record-movement` manual path is an unguarded confabulation side door.** `--northstar --from --to --evidence` appends any movement with zero verification (`record-movement.mjs:111-124`); `actor` is unauthenticated free text. The merged-PR front door is well-guarded; the side door is not. | HIGH |
| O4 | No retry/backoff/dead-letter semantics: transient spawn failures are recorded and dropped; a repeatedly-failing slice churns claim→sweep→claim forever with no max-attempts or quarantine. | MED |
| O5 | `/frame-standup` Step 7b `queue-post` without `--bead-id` mints a fresh bead per run ⇒ duplicate available items for the same priority across mornings. | MED |
| O6 | Concurrent day-runner workers (`--max ≥2`) race on the shared repo `.git` (fetch / branch -D / worktree add against one checkout, `day-runner.mjs:181-186`). | MED |
| O7 | Context budgets are quality prose, not spend controls: no token cap, no dollar budget, no per-run cost accounting; the only numeric limit in the pipeline is `--max 2` sessions and a model-enforced 12-issue cap. | MED |
| O8 | Registry-vs-disk drift is silently skipped, not surfaced: unresolvable `roadmap_ref`s are filtered (`day-runner.mjs:159`); the registry itself notes L1s "authored but never registered". Roadmap slice rm-l2-ojfbot#S1 is literally a repair task for this drift. | MED |
| O9 | **Deliverable-tracking spine is non-functional:** `gate-event.mjs` imports `packages/workflows/dist/` which was never built; default ledger root `~/selfco/tracking` absent in the vault checkout. `/gated-slice`'s "canvas is a live projection" claim is aspirational. | MED |
| O10 | Shadow lints (`roadmap-lint --check`, `northstar-lint`, `reconcile-tracking`) have exit-code gates built but wired into no CI workflow — enforcement is permanently future. | MED |
| O11 | Two bead lineages (convoy vs roadmap-slice) share no join key (`reconstruct-state.mjs:24-25` says so explicitly); no rollback semantics if a merged PR is later reverted (odometer only moves forward). | MED |
| O12 | `/resume`'s anti-confabulation preflight is opt-in; day-runner does its own `worktree remove --force` + `branch -D` without STOP semantics. daily-logger has an empty `.handoff/` — no [READ] continuity tier there at all. | LOW |

### P — Priority & data observability

| # | Finding | Severity |
|---|---------|----------|
| P1 | **Cockpit documents two adapters that don't exist** (github.ts, standup.ts — CLAUDE.md:61-62). The Pickup lane's `pull_request`/`priority` branches are dead code; the Available lane never holds GitHub issues. Docs present 4 live sources; 2 are wired. | HIGH |
| P2 | **Fleet/Delivery/Critical-Path panels are hand-coded constants presented as a read-model.** `DELIVERY_PROGRESS = 0.58`, milestones, NEXT_MOVES, CRITICAL_CHAINS all hardcoded (`fleet-config.ts:36-108`); the #1 critical chain ("bead_events the empty log") contradicts the same app's own adapter — a *resolved* blocker shown as top blocker. | HIGH |
| P3 | **Fleet liveness lies by omission:** derived only from beads + `.handoff` (`fleet-derive.ts:12-25`); a repo with real git/PR activity but no beads renders `dark`, with no partial-signal indicator. Only ~3 repos have `.handoff/`. | HIGH |
| P4 | **daily-logger has no programmatic fact-check** — verification is prompt-level instructions; TD-001/TD-004 (open since March/May) name exactly this; `verifyFileExistenceClaims()` was designed and never built. Today's on-disk article is a `generation-failed` stub. | HIGH |
| P5 | **Northstar progress lives in 3 divergent representations** (hand-asserted `current%`, roadmap `moves_from/moves_to` predictions, `status.jsonl` ledger), reconciled only by shadow lint. rm-l2-ojfbot S1 (`moves_to:22`) and S2 (`moves_from:20`) both baseline off P2=20 — they cannot both merge without silent contradiction. `northstar-rollup.mjs --write` is "Later". | HIGH |
| P6 | **selfco repo read-model is 23–54 days stale** (last sync op 2026-06-11; 20 entity pages `last_synced: 2026-05-11`) and nothing automates sync (the box runs only cultivate). Entity pages describe pre-Fleet-era cockpit, pre-northstar core. | HIGH |
| P7 | Article status lifecycle is incoherent: docs say `draft\|published`, generator hardcodes `draft`, reader recognizes `draft\|accepted\|rejected`, and **33 of 84 articles have no status → "implicitly accepted"** and published by silent default. | MED |
| P8 | selfco's committed staleness detectors key on git-mtime/inbound-links, not `last_synced` — sync-staleness is visible only in an Obsidian-only Base. The most important staleness signal has no headless surface. | MED |
| P9 | Three hand-maintained repo inventories (northstar registry, cockpit `REPO_META`, selfco entities) with no reconciler; l1-silicon-empires and l1-f1-press-room exist in core's registry, absent from the vault. | MED |
| P10 | Northstar lint false-positives when sibling checkouts sit on feature branches (the recorded l1-cv-builder "missing" ERROR was a working-copy artifact) — the observability layer reported a failure that didn't exist on main. | MED |
| P11 | LLM-produced numbers (`commitCount`, `reposActive`, quality-coverage %) ride in article frontmatter verbatim with no cross-check against the injected data. | MED |
| P12 | No read-model reports its own input-age; ADR-0014 (materialized read-model with tracked staleness) is still Draft. CLAUDE-MD-ROLLOUT tracker is inert without its cron and indistinguishable from paused. | LOW |

### E — Evaluation & self-improvement loops

| # | Finding | Severity |
|---|---------|----------|
| E1 | **skill-metrics — the instrument meant to close every other loop — has run once** (`docs/skill-metrics-2026-04-28.md`, the baseline). Claimed weekly/monthly cadence; zero subsequent snapshots; the interpretation-guide's observe→interpret→act→**re-measure** never reaches re-measure. | HIGH |
| E2 | **No telemetry finding has ever changed skill-catalog.json** — git history shows only feature additions, never a trigger tuned from observed adoption data. The observe→act edge is unexercised. | HIGH |
| E3 | **Council-of-experts is a write-only critic:** notes consumed once in synthesis and discarded; personas never revised since creation; no persistence, no aggregation of recurring critiques, no measurement of whether the council improves articles. `feedback/` holds one unrelated file. | HIGH |
| E4 | **Zero evals/regression tests for any LLM output across four repos.** CI validates schema + section presence only; no golden set, no judge scoring, no prompt-regression harness. A degraded synthesis prompt ships silently and passes CI. | HIGH |
| E5 | Observe-only skills (validate, spec-review, lint-audit, test-expand, skill-audit, council-review) terminate at a human, and the queue is untracked — findings-emitted vs findings-resolved is uncounted; non-techdebt findings evaporate at session end. | MED |
| E6 | techdebt apply — the one closed core loop — lacks its Validate stage: "the patch lands as-given" with no post-apply re-check (SKILL.md:83). | MED |
| E7 | TECHDEBT.md near-static: last updated 2026-05-12, 1 of 5 fixed, TD-001 open since 2026-03-11. | MED |
| E8 | selfco's real gate (`lint --gate`, exit 1, override env) runs only on the off-disk selfco-box push path; the repo has **no CI at all**, so the GitHub mirror has no independent gate. | MED |
| E9 | No error-budget/SLO concept anywhere: alerting is binary (`pipeline-alert`); staleness thresholds advisory; ADR-0044–0050 numeric targets exist and are unmeasured (E1). | MED |
| E10 | Goodhart guardrails exist in exactly one place (cultivate). Volume-gameable acting loops (techdebt, sweep, daily-cleaner, council) have no "produce nothing when nothing is warranted" guard. | LOW |
| E11 | No published-article quality signal feeds back to the drafter despite TD-001 documenting the exact failure mode. | LOW |

---

## Hardening plan — control-gated slices (ADR-0086 idiom)

Ordered by leverage; each slice is independently shippable, shadow-first where it takes action.
H0–H2 are the keystone: they make everything downstream *measurable* — the same logic that made
OPAV S0 first.

### H0 — Commit the ground truth; make docs stop lying *(1 PR, no runtime change)*
- Commit `OPAV-LOOP-GATED-SLICE-PLAN-2026-06-13.md` to core (the program's constitution must
  survive the laptop).
- Fix or flag every documented-but-absent component: daily-logger CLAUDE.md (bead-store/ADR-0043,
  Zod claims), cockpit CLAUDE.md (github/standup adapters → "Slice 1/2 — NOT BUILT"), cockpit
  Critical-Path seeded chains (label `seeded/stale` in the UI or refresh), `/gated-slice` spine
  claims (mark "requires `pnpm --filter @core/workflows build` + ledger scaffold — currently
  non-functional").
- **Entrance:** none. **Success (TPM):** zero references to nonexistent files in the four
  CLAUDE.mds; OPAV plan resolvable from a clean clone. Verifiable by a 20-line doc-drift script
  (candidate future shadow lint).

### H1 — One trace identity across the four ID systems *(the S0 move, cluster-wide)*
- Define `trace_id` minted at the earliest entry point (standup priority / queue-post /
  orchestrate L0) and threaded: queue bead → day-runner brief env → child session telemetry →
  convoy beads → PR body line (`Trace: …`) → record-movement ledger line → gate-spine
  `correlation_id`.
- Ship as a small shared schema module (Zod) + `schema_version` field; writers validate on
  emit (fail-open: log-to-stderr, never block).
- **Entrance:** H0 merged. **Success:** one `rm:…#S…` slice traceable end-to-end
  (prompt→PR→movement) by a single grep/join script; demo committed as the exit-gate evidence.
- **Stage:** SHADOW (ids emitted, nothing consumes them yet). Promotion to "consumers require
  trace_id" is a later RIDM decision.

### H2 — Re-point dead consumers; retire the frozen stream *(closes T1)*
- daily-logger `collect-telemetry.ts` reads `skill-dispositions.jsonl` (ADR-0095 source) with
  the frozen `skill-telemetry.jsonl` as explicit fallback labeled `legacy`; blog's telemetry
  section states its source + freshness.
- Extract the duplicated quality-coverage computation (T12) into one shared implementation.
- **Success:** blog skillTelemetry section shows non-zero adoption matching `skill-metrics.mjs`
  output for the same window.

### H3 — Telemetry durability floor *(T2, T4, T6, T7, T9)*
- Rotation: size/age-capped `~/.claude/*.jsonl` with monthly compaction (keep aggregates).
- Concurrency: `flock` or per-session shard files merged on read.
- Dolt outage buffer: `bead-emit.mjs` appends to a local WAL file when the socket is down;
  a replay verb drains it (at-least-once + the op_id idempotency the gate spine already has,
  applied to `emitEvent`).
- Replace `git push --force` exfil with append-only branch or force-with-lease.
- **Stage:** each behavior lands fail-open. **Success:** kill Dolt mid-convoy in a test run;
  zero events lost after replay.

### H4 — Close the day-runner validation gate *(O2, O3 — the correctness gate)*
- day-runner post-session verify runs the target repo's declared test command in the worktree
  and evaluates the slice's `success:` line (even as an LLM-judge check to start); result
  recorded on the `pr-created` bead as `checks: {tests: pass|fail|skipped, success_criterion: …}`.
  SHADOW first: record, don't block. Promote to "red ⇒ task-failed" by RIDM after N runs.
- Guard the `record-movement` manual path: require `--override-reason`, stamp
  `source:"manual-unverified"` in the ledger line, and have northstar-lint WARN on any manual
  movement older than a grace period without a corroborating PR.
- **Success:** a deliberately-red test PR produces `checks.tests: fail` on its bead.

### H5 — Give the runner retry semantics and dedup *(O4, O5, O6)*
- `attempts` counter on queue beads; max-attempts ⇒ `queue=quarantined` + a Pickup-lane item.
- `queue-post` from standup uses a deterministic `--bead-id` derived from priority content hash.
- Serialize per-repo git ops in day-runner (one mutex per repoDir) or per-worker clones.

### H6 — Promote one shadow gate to operational per fortnight *(the RIDM ratchet — E-series)*
The pattern exists everywhere and has never been exercised. Candidates in promotion order:
1. `roadmap-lint --check` + `northstar-lint` into core CI (data files only — low blast radius).
2. selfco: add minimal CI on the mirror running `lint.py --gate` (the box stops being the only gate).
3. cockpit: contract-drift gate already operational — use as the reference precedent.
4. day-runner test-check from H4 shadow → blocking.
Each promotion is a recorded RIDM decision (a dated note in the ADR or northstar ledger), which
also finally exercises ADR-0086 end-to-end.

### H7 — Scheduled re-measurement with teeth *(E1, E2, E5, E9, P6)*
- A weekly routine (cron/launchd/`/schedule` — same rail as CLAUDE-MD-ROLLOUT) that runs:
  `skill-metrics.mjs` snapshot → `docs/skill-metrics-YYYY-MM-DD.md` (append, diff vs prior),
  `/vault sync --since=7d`, and a findings-ledger refresh.
- Findings ledger: one JSONL (`~/selfco/tracking/findings.jsonl` or `core/decisions/findings/`)
  where validate/lint-audit/skill-audit/council append `{id, source, severity, status}`;
  the weekly job reports open-findings age. This is the missing lifecycle for E5.
- SLOs with teeth, minimal set: *telemetry freshness* (any stream silent > 7d ⇒ alert — the
  T1 dark-stream failure becomes detected, not discovered), *sync age* (> 14d ⇒ alert),
  *snapshot cadence* (missed week ⇒ alert). Binary alerts are fine; budgets can come later.
- **Success:** two consecutive weekly snapshots exist and at least one skill-catalog trigger
  change cites snapshot data in its commit message (closes E2 for the first time).

### H8 — First LLM-output eval loop *(E3, E4, P4, P11 — pick daily-logger, it has the corpus)*
- Build TD-001's `verifyFileExistenceClaims()`: post-generation, extract file/branch/PR claims
  from the draft and check them against the collected context; failures demote the article to
  `draft` + a `verification-failed` tag. (Deterministic, no LLM needed.)
- Cross-check `commitCount`/`reposActive` frontmatter against the injected commit list (pure
  arithmetic).
- Persist council notes to `feedback/YYYY-MM-DD.json`; monthly, aggregate recurring critiques
  into a proposed persona diff (human-merged) — the council finally feeds back.
- Golden set: pin 3 historical context-fixtures + rubric; run the drafter against them in CI
  weekly (advisory), so prompt regressions are visible before they ship.
- **Success:** one article demoted or corrected by the verifier; one persona revision PR citing
  aggregated council data.

### H9 — Single pane of glass, honestly scoped *(P1–P3, P5, P9, P12)*
- Cockpit reads `decisions/northstar/status.jsonl` + registry (read-only file adapter — matches
  its standalone posture) and replaces the hand-coded Delivery/Critical-Path constants, or at
  minimum renders `seeded:true` data visibly badged "editorial, not derived".
- Every cockpit panel shows input-age (`generatedAt` per source) — this is ADR-0014; promote it
  from Draft and ship the staleness surface first.
- One reconciler script diffs the three repo inventories (northstar registry / REPO_META /
  selfco entities) — shadow report, candidate for the H6 ratchet.
- Build the documented `adapters/github.ts` (collectors already exist in daily-logger to copy)
  so Pickup/Available lanes stop being structurally under-fed — or delete the lanes' dead
  branches and the doc claims (H0 covers the interim).

### Sequencing

```
H0 (docs truth)  ──►  H1 (trace identity)  ──►  H4 (validation gate)  ──►  H6 ratchet (ongoing)
        │                    │
        ├──►  H2 (repoint consumers)  ──►  H7 (weekly re-measure + SLOs)
        │                                        │
        ├──►  H3 (durability floor)              └──►  H8 (first LLM eval loop)
        └──►  H5 (retry/dedup)        H9 (pane of glass) — parallel, after H0
```

Deliberately **not** proposed: autonomous suggestion re-ranking (OPAV S5) or any widening of
autonomy — the program brief's firebreak stands; every acting slice above is shadow-first and
human-promoted. Also not proposed: merging the two decomposition systems (A and B); System A
(`/orchestrate`) should either gain a thin executor that reuses day-runner's primitives
(worktree, timeout, verify, beads) or be explicitly repositioned as the *interactive* mode of
System B — that is an architecture decision worth its own `/grill-with-docs` session, not a
unilateral audit edit.

---

## Quick wins (< 1 day each, no architecture)

1. Commit the OPAV plan file (H0, 5 minutes, highest leverage-to-effort in this audit).
2. Cockpit: badge `seeded:true` chains as editorial + delete the stale "bead_events empty log" chain (P2).
3. daily-logger: point `collect-telemetry.ts` at `skill-dispositions.jsonl` (T1/H2 core of it).
4. `frame-standup` Step 7b: derive `--bead-id` from a content hash (O5).
5. `record-movement`: stamp `source:"manual-unverified"` on the manual path (O3, non-breaking).
6. build-api: treat missing article status as `draft`, not implicitly-accepted — or backfill the 33 statusless articles (P7).
7. Run `/vault sync` and put a recurring reminder on the same scheduler as CLAUDE-MD-ROLLOUT (P6).
8. Add `pnpm --filter @core/workflows build` to whatever bootstraps the gate spine, or gate-event
   should build-on-demand — unbreak `gate-event.mjs` (O9).

---

## Appendix — method

Four parallel read-only audit agents (telemetry / orchestration / priority-observability /
evaluation-loops), each with full-repo search access, reporting evidence as file:line;
findings above are the synthesis with per-dimension prefixes (T/O/P/E) preserving each agent's
numbering where possible. Date anchor: 2026-07-04. Full agent transcripts were not committed;
every finding retained here carries its own evidence reference and was spot-checkable against
the working tree at commit time.
