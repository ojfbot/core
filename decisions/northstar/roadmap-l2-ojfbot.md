---
type: roadmap
slug: rm-l2-ojfbot
northstar: l2-ojfbot
status: active
phases:
  - id: PH1
    name: "Skill-ify the northstar relay"
    goal: "The roadtrip's brief → voice-confirm → land loop is a repeatable skill pair (CC-side /northstar-leg + chat-side voice skill), not a hand-driven runbook."
  - id: PH2
    name: "Land the remaining legs"
    goal: "All 26 itinerary apps have a registered, lint-clean L1 northstar with ladder-stress verdicts logged; northstar-lint reports 0 missing files."
  - id: PH3
    name: "Audit hardening program (2026-07-04) — make the fleet's work self-measuring"
    goal: "The tranche-1 slices of MULTIAGENT-SDLC-AUDIT / AGENTIC-INTEGRATION-PLAN / FLEET-COORDINATION-EXTENSIONS are merged, verified DELIVERED by scripts/audit-delivery-check.mjs, and the program shows movement at least every 14 days (the verifier's staleness gate)."
  - id: PH4
    name: "Audit tranche 2 — the evaluation layer"
    goal: "The measurement machinery tranche 1 built starts learning: the first shadow-gate promoted to CI (RIDM), a failure taxonomy feeding golden suites, human outcomes captured as eval signal, one calibrated judge, and trace identity joining queue -> session -> PR."
  - id: PH5
    name: "Audit tranche 3 — close the OPAV skill loop, first meta-loop"
    goal: "OPAV S1 completes C3->C4 (the cluster's second RIDM promotion), the disposition stream becomes the single skill-usage truth with no dark consumers, the day-runner's operating mode is a recorded decision with a live proof, the weekly error-analysis ritual becomes a proposal-only scheduled agent, and the external DIA survey is reconciled into the audit series with explicit accept/defer/reject verdicts."
  - id: PH6
    name: "Audit cycle 5 (2026-07-09) — loop-engineering cross-check: loop legibility + liveness"
    goal: "The loop-engineering / Advisor-tool cross-check is filed as audit cycle 5 with explicit verdicts, every loop in the cluster is declared in one lintable registry (trigger, state spine, verifier, stop rule), and dead loops become detectable from the registry instead of by operator absence-noticing."
  - id: PH7
    name: "Core decomposition (2026-08-08) — one repo, three legible personas"
    goal: "core stops blurring harness / fleet-ledger / personal-corpus. Fleet membership has one reconciler instead of four hand-maintained inventories (TD-007), operator-personal material lives outside the repo, dead structure is gone, and every distribution list is derived from a manifest rather than asserted in a script."
  - id: PH8
    name: "Agent trust build — Phase 0: owner setup and the authority service"
    goal: "The Macs can no longer administer the NAS; the authority service runs under its own account with a hash-chained journal; one real promote is approved by Face ID and spent once; the GitHub Apps exist with their keys held only by the token issuer; the terminal login has no settings power."
  - id: PH9
    name: "Agent trust build — Phase 1: enforcement (watch-only on staging)"
    goal: "Every enforcer (token issuer, FleetRunner, listener and wake) asks the authority service before it admits work, and every refusal it would make is recorded in watch-only mode on staging. Nothing blocks yet."
  - id: PH10
    name: "Agent trust build — Outside security review, then enforcement go-live"
    goal: "One outside human security review of phase 1 on staging is filed privately; each finding is a build check or an owner decision; only then are the phase 1 enforcers switched from watch-only to enforcing, one owner tap each."
  - id: PH11
    name: "Agent trust build — Phase 2: evidence"
    goal: "One staging action rebuilds from raw records, with a status per link, through every journal; journals are hash-chained and witnessed; the ask-first gate and the merge proof are on."
  - id: PH12
    name: "Agent trust build — Phase 3: seats and stops"
    goal: "A stop is proven or reported “not complete”; ending a record ends everything below it; child seats, succession, baskets, check-ups and the lost-phone drill work as ruled."
  - id: PH13
    name: "Agent trust build — Tests lane (runs alongside, one slice at a time)"
    goal: "Model tests, the three scores, factory measures and guided PR review are measured and shown on the board with honest labels."
slices:
  - id: S1
    phase: PH1
    title: "Repair l1-cv-builder — registered northstar absent from the working copy"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 20
    moves_to: 22
    deliverable: "cv-builder working copy carries .claude/northstar.md; northstar-lint 0 errors. FINDING (2026-07-03): the file was never missing from origin/main — its tip IS the northstar commit (2a88ec1). The lint ERROR is a working-copy artifact: the checkout sits on docs/claude-md-routing (ADR-0081 rollout WIP, uncommitted changes, cut before the northstar landed). Remaining action: land/rebase that branch or switch the checkout to main — owner's call, do not touch the dirty branch."
    entrance: "northstar-lint currently ERRORs: registered-but-absent l1-cv-builder (working-copy artifact per the 2026-07-03 finding; self-heals when the rollout branch lands)."
    success: "node core/scripts/northstar-lint.mjs shows 7/7 files present, 0 errors."
    autonomy: gate-0
    claimable_by: either
    kind: s
    repo: cv-builder
    status: ready
  - id: S2
    phase: PH1
    title: "CC-side /northstar-leg skill — survey, brief, land"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 20
    moves_to: 24
    deliverable: "core/.claude/skills/northstar-leg/ + catalog entry: picks next queued itinerary apps, runs the evidence survey, writes briefing cards to the Notion relay; on --land, writes confirmed .claude/northstar.md files, registers, lints, logs ladder-stress verdicts, marks the itinerary cursor, appends the synthesis ledger."
    entrance: "Offsite harness + Notion relay exist (itinerary.md, schema-evolution-log.md, relay contract page); leg-1 transcript available as the worked example."
    success: "A dry run against one queued app produces a briefing card matching the leg-1 format; --land applied to the already-CONFIRMED Frame block lands lint-clean files."
    autonomy: gate-0
    claimable_by: either
    kind: m
    repo: core
    status: ready
  - id: S3
    phase: PH1
    title: "Chat-side voice skill for the northstar conversation"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 24
    moves_to: 28
    deliverable: "Chat skill canonical at core/.claude/skills/northstar-voice/ (selfco-ingest precedent: git canonical in core, RE-UPLOAD to claude.ai to go live): reads a leg's briefing cards from Notion, runs the Socratic vision conversation voice-first, writes the CONFIRMED block + ladder-stress verdicts back to Notion. Chat stays above the evidence line — it never asserts repo facts, only refines the staged brief."
    entrance: "S2 merged (the briefing-card contract it consumes is fixed by /northstar-leg)."
    success: "One leg conversation run end-to-end from a phone in voice mode produces a CONFIRMED block that /northstar-leg --land accepts without manual repair."
    autonomy: gate-0
    claimable_by: either
    kind: m
    repo: core
    status: queued
    depends_on: "rm:rm-l2-ojfbot#S2"
  - id: S4
    phase: PH2
    title: "Land the Frame leg (shell) — already voice-CONFIRMED"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 20
    moves_to: 23
    deliverable: "shell/.claude/northstar.md landed from the existing CONFIRMED relay block (instance-federation framing: shell=authorizing surface, core=spawn), registered, lint clean, ladder-stress verdicts appended."
    entrance: "The Frame leg CONFIRMED block exists in the Notion relay (confirmed in voice 2026-06-28/29); no new conversation needed."
    success: "Registry gains l1-shell (or the confirmed slug); northstar-lint 0 errors; ladder-stress.jsonl gains the leg's verdicts; itinerary cursor → landed."
    autonomy: gate-0
    claimable_by: human_only
    kind: s
    repo: shell
    status: ready
  - id: S5
    phase: PH2
    title: "Leg 2 — purefoy, daily-logger, seh-study, bldgblog-corpus"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 28
    moves_to: 40
    deliverable: "4 landed L1 northstars via the skill pair (brief → voice confirm → land); ledger + verdicts appended; itinerary cursor advanced."
    entrance: "PH1 skills merged; leg-2 briefing cards written and voice-CONFIRMED in the relay."
    success: "4 new registry entries, lint clean, ladder-stress logged per parent property."
    autonomy: gate-0
    claimable_by: human_only
    kind: l
    repo: core
    status: queued
  - id: S6
    phase: PH2
    title: "Leg 3 — golf platform cluster, jocdive-sdi-mcp, dms-core"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 40
    moves_to: 48
    deliverable: "Leg-3 L1s landed via the skill pair; first candidate for the designed-but-unbuilt cluster tier (golf) — if the leg needs it, that is the evidence gate the schema-evolution log is waiting on."
    entrance: "Leg 2 landed; leg-3 briefing cards voice-CONFIRMED."
    success: "Registry entries + lint clean + verdicts; any cluster-tier need logged as a schema-evolution iteration, not improvised."
    autonomy: gate-0
    claimable_by: human_only
    kind: l
    repo: core
    status: queued
  - id: S7
    phase: PH2
    title: "Leg 4 — asset-foundry, beaverGame, lofi-beaver, foundry-recipes"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 48
    moves_to: 56
    deliverable: "Leg-4 L1s landed via the skill pair; ledger + verdicts appended."
    entrance: "Leg 3 landed; leg-4 briefing cards voice-CONFIRMED."
    success: "Registry entries + lint clean + verdicts logged."
    autonomy: gate-0
    claimable_by: human_only
    kind: l
    repo: core
    status: queued
  - id: S8
    phase: PH2
    title: "Leg 5 — blogengine, lean-canvas, core-reader, frame-ui-components, landing"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 56
    moves_to: 64
    deliverable: "Leg-5 L1s landed via the skill pair; ledger + verdicts appended."
    entrance: "Leg 4 landed; leg-5 briefing cards voice-CONFIRMED."
    success: "Registry entries + lint clean + verdicts logged."
    autonomy: gate-0
    claimable_by: human_only
    kind: l
    repo: core
    status: queued
  - id: S9
    phase: PH2
    title: "Leg 6 — gastown-pilot, workstation-yuri, github-actions (+ l2-selfco decision)"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 64
    moves_to: 72
    deliverable: "Final leg landed; decide and record whether l2-selfco graduates from deferred (it lives in the vault at ~/selfco/tracking/, never in core) — a decision line in the synthesis ledger either way."
    entrance: "Leg 5 landed; leg-6 briefing cards voice-CONFIRMED."
    success: "Itinerary shows 26/26 landed or explicitly retired; registry + lint clean; l2-selfco decision recorded."
    autonomy: gate-0
    claimable_by: human_only
    kind: l
    repo: core
    status: queued
  - id: S10
    phase: PH3
    title: "H0 ground truth — commit the OPAV master plan into core"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 20
    moves_to: 21
    deliverable: "OPAV-LOOP-GATED-SLICE-PLAN-2026-06-13.md committed to core (root or decisions/) so the program constitution survives the laptop; referenced beads stop pointing at a file that exists nowhere."
    entrance: "The file exists on the operator's Mac (referenced by 3+ beads and the DeepStack evaluation). Copy it in — do not reconstruct it."
    success: "node scripts/audit-delivery-check.mjs shows H0.1 DELIVERED."
    autonomy: gate-0
    claimable_by: human_only
    kind: s
    repo: core
    status: merged
  - id: S11
    phase: PH3
    title: "daily-logger truth pipeline — repoint dead telemetry consumer + deterministic fact-check"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 21
    moves_to: 22
    deliverable: "collect-telemetry.ts reads skill-dispositions.jsonl (frozen stream demoted to labeled legacy fallback); verifyFileExistenceClaims() built per TD-001 and wired post-generation; build-api.ts stops treating missing article status as implicitly accepted; CLAUDE.md purged of the phantom bead-store.ts claim."
    entrance: "Audit findings T1, P4, P7, T11 confirmed current (re-run the verifier: H2.1, I5.1, I5.2, H0.3 all MISSING)."
    success: "audit-delivery-check.mjs shows H2.1, I5.1, I5.2, H0.3 DELIVERED; pnpm test green in daily-logger."
    autonomy: gate-0
    claimable_by: agent_eligible
    kind: m
    repo: daily-logger
    status: merged
  - id: S12
    phase: PH3
    title: "cockpit honesty pass — stale seeded chain, adapter doc claims, problems-view states"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 22
    moves_to: 23
    deliverable: "fleet-config.ts stale 'bead_events empty log' critical chain removed or seeded-badged in the UI; CLAUDE.md marks github/standup adapters NOT BUILT (or builds github.ts from daily-logger's collectors); deriveAgentLiveness extended with Stalled/Zombie states per the Gas Town problems-view taxonomy."
    entrance: "Audit findings P1, P2, F5 confirmed current (verifier: H0.4, F5.1, F5.2 MISSING)."
    success: "audit-delivery-check.mjs shows H0.4 (at least PARTIAL), F5.1, F5.2 DELIVERED; pnpm test green in morning-cockpit."
    autonomy: gate-0
    claimable_by: agent_eligible
    kind: m
    repo: morning-cockpit
    status: merged
  - id: S13
    phase: PH3
    title: "Re-measurement cadence — weekly measurement routine with the delivery oracle inside"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 23
    moves_to: 24
    deliverable: "A scheduled weekly routine (launchd/cron/frame-standup extension) that runs skill-metrics.mjs to docs/skill-metrics-YYYY-MM-DD.md, runs audit-delivery-check.mjs --json and files the diff vs last week, and nags on vault-sync age. First run produces the cluster's second-ever metrics snapshot."
    entrance: "audit-delivery-check.mjs merged (this PR); skill-metrics.mjs runs clean against live telemetry."
    success: "audit-delivery-check.mjs shows H7.1 DELIVERED (>1 snapshot); two consecutive weekly artifacts exist after 14 days."
    autonomy: gate-0
    claimable_by: either
    kind: m
    repo: core
    status: merged
  - id: S14
    phase: PH3
    title: "day-runner verification stage (SHADOW) + record-movement manual-path guard"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 24
    moves_to: 25
    deliverable: "Post-session, day-runner runs the target repo's check command in the worktree and records checks:{tests,success_criterion} on the pr-created bead + PR body (record only, never blocks — promotion to blocking is a later RIDM decision after ~20 shadow runs); record-movement's --northstar manual path requires --override-reason and stamps source:manual-unverified."
    entrance: "S13 merged (the weekly routine is what will surface shadow-agreement data for the eventual promotion decision)."
    success: "audit-delivery-check.mjs shows H4.1, H4.2 DELIVERED; next overnight run's beads carry the checks field."
    autonomy: gate-0
    claimable_by: agent_eligible
    kind: m
    repo: core
    status: merged
    depends_on: "rm:rm-l2-ojfbot#S13"
  - id: S15
    phase: PH3
    title: "Verifiability-sorted dispatch — autonomy_fit + machine check field in the roadmap schema"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 25
    moves_to: 26
    deliverable: "Roadmap schema v1.x adds an optional check: field (machine-runnable success command) and autonomy_fit derived from its presence; roadmap-compile only queues agent_eligible slices that carry check:; /triage refreshed toward the ready-for-agent/ready-for-human state machine (Pocock upstream, June 2026)."
    entrance: "S14 merged (the verification stage is what makes check: enforceable at the slice boundary)."
    success: "audit-delivery-check.mjs shows F1.1 DELIVERED; roadmap-lint clean; a compiled bead carries the field."
    autonomy: gate-0
    claimable_by: agent_eligible
    kind: m
    repo: core
    check: "pnpm test && node scripts/roadmap-lint.mjs --check"
    status: merged
    depends_on: "rm:rm-l2-ojfbot#S14"
  - id: S16
    phase: PH4
    title: "Promote roadmap-lint + northstar-lint into core CI (first shadow-to-operational RIDM)"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 26
    moves_to: 27
    deliverable: "core CI workflow runs roadmap-lint --check + northstar-lint on PRs touching decisions/northstar/** (blocking on ERRORs only; WARNs stay shadow); the promotion recorded as a dated RIDM note in the northstar README — the cluster's first-ever shadow-gate promotion, exercising ADR-0086 end-to-end."
    entrance: "Tranche 1 merged; both lints run clean-of-new-errors on main; the 5 pre-existing missing-file ERRORs are working-copy artifacts that must be scoped out (lint only registry entries whose repos the runner can see, or fix the registry) before the gate can block."
    success: "A PR introducing a broken advances: ref fails CI; a clean PR passes; RIDM note committed."
    check: "node scripts/roadmap-lint.mjs --check && grep -rq roadmap-lint .github/workflows/"
    autonomy: gate-0
    claimable_by: agent_eligible
    kind: m
    repo: core
    status: merged
  - id: S17
    phase: PH4
    title: "First error-analysis ritual — failure-taxonomy.md v1 (open coding with the operator)"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 27
    moves_to: 28
    deliverable: "decisions/failure-taxonomy.md v1: 20-30 recent traces/beads/articles sampled (including the 2026-07-04 generation-failed article), failures open-coded, clusters proposed by the agent and approved by the operator; every future finding/incident gets a taxonomy tag at triage."
    entrance: "Operator has 30-60 focused minutes (morning work). The single highest-leverage sitting in the integration plan (I3) — evals built without it measure failures we do not have."
    success: "failure-taxonomy.md committed with >=5 evidence-linked clusters; the taxonomy names which eval to build first (feeds S19)."
    autonomy: gate-0
    claimable_by: human_only
    kind: m
    repo: core
    status: merged
  - id: S18
    phase: PH4
    title: "Outcome capture — accepted|edited|rejected|abandoned where humans touch agent output (I2)"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 28
    moves_to: 29
    deliverable: "bead-emit close/quarantine verbs accept and record an outcome field; daily-logger editorial-accept and ADR-0038 revise paths stamp outcome on the article; a weekly cron candidate files every rejected/edited item as a candidate golden task. Own edits/rejections become the implicit-feedback eval signal."
    entrance: "Tranche 1 merged (checks field established the labels-extension pattern in bead-emit)."
    success: "audit-delivery-check I2.1 DELIVERED; one real item carries an outcome after a live session."
    check: "pnpm test && grep -q outcome scripts/hooks/bead-emit.mjs"
    autonomy: gate-0
    claimable_by: agent_eligible
    kind: m
    repo: core
    status: merged
  - id: S19
    phase: PH4
    title: "First golden suite — daily-logger, 5-15 tasks seeded from the taxonomy (I4)"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 29
    moves_to: 30
    deliverable: "daily-logger evals/ with 5-15 tasks (input fixture + deterministic assertions where possible), seeded exclusively from S17's taxonomy + real failures; vitest harness, >=3 trials for stochastic paths; CI-advisory (posts the diff vs last run, never blocks — blocking is a later S16-pattern promotion)."
    entrance: "S17 merged (the taxonomy names which failures the suite must cover)."
    success: "audit-delivery-check I4.1 DELIVERED; suite runs in CI advisory on a daily-logger PR."
    check: "pnpm test"
    autonomy: gate-0
    claimable_by: agent_eligible
    kind: m
    repo: daily-logger
    status: merged
    depends_on: "rm:rm-l2-ojfbot#S17"
  - id: S20
    phase: PH4
    title: "Calibrate judge #1 — daily-logger article accuracy against operator labels (I5)"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 30
    moves_to: 31
    deliverable: "Operator labels 30-50 historical articles pass/fail + one-line critique; judge prompt iterated to >=90% agreement; 10 labeled articles frozen as the judge-regression set, re-run monthly and on model upgrades; judge from a different model family than the drafter where feasible. This judge is the entrance criterion for ever evaluating slice success_criterion mechanically (S14's evaluated:false) and for any future prompt optimization."
    entrance: "Operator has labeling time (can be spread over days); S19 harness merged to host the judge-regression set."
    success: "Judge-vs-operator agreement >=90% on held-out labels; frozen regression set committed; agreement number recorded."
    autonomy: gate-0
    claimable_by: human_only
    kind: l
    repo: daily-logger
    status: queued
    depends_on: "rm:rm-l2-ojfbot#S19"
  - id: S21
    phase: PH4
    title: "Trace identity — trace_id threaded queue -> session -> PR (I1/H1)"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 31
    moves_to: 32
    deliverable: "A trace_id minted at queue-post/compile, carried on the bead, injected into the day-runner brief + session env, echoed in the PR body (Trace: line), and joined by a demo script proving one slice traceable prompt->PR end-to-end. Shadow: emitted, nothing consumes it yet. Field names follow OTel gen_ai vocabulary where applicable."
    entrance: "Tranche 1 merged; the four identity systems (suggestion_id, gate correlation_id, convoy beads, rm: refs) documented in the audit remain unjoined."
    success: "The H1 exit gate: one dispatched slice traceable end-to-end via a single join script committed as evidence."
    check: "pnpm test && grep -q trace_id scripts/hooks/bead-emit.mjs"
    autonomy: gate-0
    claimable_by: agent_eligible
    kind: m
    repo: core
    status: merged
  - id: S22
    phase: PH5
    title: "OPAV S1-C3 — capture-quality verification, 30-label gold set, litter surface, re-derived AR0"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 32
    moves_to: 34
    deliverable: "Per the 2026-06-18 pickup brief (.handoff/20260618-brief-pickup-opav-s1-c3-litter-usage-signal.md), in strict order: (a) capture-quality verification script (scripts/opav-capture-quality.mjs) proving path-independence (follow-inline / Skill-tool / script-exec all captured) and use-vs-maintenance disambiguation against known sessions — motivated by the degenerate accumulated distribution (190 ignored / 3 engaged_no_act / 0 acted / 0 capture_miss over 24 days of heavy real skill use, measured 2026-07-08); (b) gold set decisions/opav/gold-set-v1.jsonl — 30 operator-labeled dispositions (acted/engaged_no_act/capture_miss per ADR-0095) with measured capture>=70% and false-emit<=10% against it; (c) litter/absence surface — skill catalog JOIN live dispositions as a /skill-metrics mode (zero-use tail + last-seen recency, exclusions logged) — ships ONLY after (a)+(b) pass, since on bad capture it condemns ~51 live skills; (d) AR0 re-derived from dispositions and recorded in an ADR-0095 addendum. No removal action of any kind — shadow observation only."
    entrance: "ADR-0095 C3 data gate SATISFIED (193 events / ~24 days in ~/selfco/tracking/skill-dispositions.jsonl, verified 2026-07-08); PR #165 runtime merged; S24 merged (so the measurement runs against the single-truth stream); operator has one 30-45 min labeling sitting."
    success: "Capture-quality report committed with capture>=70% and false-emit<=10% vs the gold set; gold-set-v1.jsonl has >=30 labeled rows; litter surface runs with a logged denominator; AR0 number recorded in the ADR addendum."
    check: "pnpm test && node scripts/opav-capture-quality.mjs --check"
    autonomy: gate-0
    claimable_by: either
    kind: l
    repo: core
    status: queued
    depends_on: "rm:rm-l2-ojfbot#S24"
  - id: S23
    phase: PH5
    title: "OPAV S1-C4 — validator shadow->active, the cluster's second RIDM promotion"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 34
    moves_to: 35
    deliverable: "RIDM note (S16 pattern) promoting the skill-action validator from shadow to active: promotion criteria restated from ADR-0095 BEFORE evaluation (capture>=70%, false-emit<=10%, >=30 gold, >=30 days), TPM values recorded against each, operator sign-off line, and the corrective path (breach -> stay shadow) stated. 'Active' means the disposition stream becomes a trusted input to skill-metrics/litter reporting — it does NOT gate or remove anything (S1 scope: observe; removal stays a human PR decision; the S5 firebreak is untouched)."
    entrance: "S22 merged; the 30-day accumulation gate clears ~2026-07-14; all TPMs green on the S22 gold set."
    success: "Dated RIDM note committed to decisions/opav/ citing each TPM vs its bar; a PR demonstrating one consumer (skill-metrics litter mode) switched from shadow/untrusted to active labeling."
    check: "grep -rq 'RIDM' decisions/opav/ && node scripts/opav-capture-quality.mjs --check"
    autonomy: gate-0
    claimable_by: human_only
    kind: s
    repo: core
    status: queued
    depends_on: "rm:rm-l2-ojfbot#S22"
  - id: S24
    phase: PH5
    title: "Single skill-usage truth — retire legacy skill-telemetry consumers + wire CI to telemetry/daily"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 32
    moves_to: 33
    deliverable: "Every consumer still reading ~/.claude/skill-telemetry.jsonl as primary (pr-skill-audit.sh lines 19-25, weekly-measure.mjs, analyze-telemetry.sh, generate-skill-report.sh, the suggest-skill path per the 2026-06-18 brief) repointed to skill-dispositions.jsonl / session-telemetry with the frozen stream demoted to a labeled legacy fallback (the S11 pattern, applied to core's own scripts); core's claude-skill-audit.yml checks out origin/telemetry/daily and sets TELEMETRY_DIR so the CI audit finally consumes what sync-telemetry.sh pushes; daily-logger's claude-skill-audit.yml fetch fixed to pull the branch from ojfbot/core (today it fetches its own origin where the branch does not exist and silently no-ops via '|| exit 0'); install-agents.sh gains an idempotence guard so a hook path can never be registered twice in ~/.claude/settings.json (root cause of the duplicate Stop hook found 2026-07-08)."
    entrance: "Duplicate Stop-hook registration removed by hand first (one-line settings.json fix) so the stream this slice canonicalizes is not being double-processed; findings verified 2026-07-08 (core CI has zero telemetry references; legacy stream frozen since 2026-06-18)."
    success: "No core script names skill-telemetry.jsonl except as an explicitly-labeled fallback; a CI run of claude-skill-audit shows telemetry-derived output; running install-agents.sh twice produces zero duplicate hook entries."
    check: "pnpm test"
    autonomy: gate-0
    claimable_by: agent_eligible
    kind: m
    repo: core
    status: merged
  - id: S25
    phase: PH5
    title: "day-runner operating mode — recorded decision (manual ritual vs schedule) + the owed live proof"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 35
    moves_to: 36
    deliverable: "An ADR (or RIDM-style note) deciding how day-run actually runs — verified 2026-07-08: it runs NOWHERE (crontab empty, no launchd plist) — choosing manual-ritual (a /frame-standup evening step) or scheduled (launchd, following the com.ojfbot.skill-architecture-audit rail), with the F10.6 consent allowlist (repos it may touch + spend budget) declared either way; plus the owed live end-to-end proof: one real `day-run --once` against an agent_eligible check-bearing slice, producing a PR whose bead carries S14's checks field and S21's trace_id."
    entrance: "S15 verifiability-sorted dispatch merged; at least one agent_eligible slice with check: is open (S24 qualifies); the proof was owed by the tranche-2 pickup brief."
    success: "Decision doc committed naming mode + allowlist + spend cap; one live-run PR exists whose bead shows checks:{...} and a Trace: line — the S21 join script resolves it end-to-end."
    check: "node scripts/trace-join.mjs --latest"
    autonomy: gate-0
    claimable_by: human_only
    kind: m
    repo: core
    status: ready
  - id: S26
    phase: PH5
    title: "Trace-mining triager — the weekly error-analysis ritual as a proposal-only scheduled agent (I3 / opportunity B)"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 36
    moves_to: 37
    deliverable: "A headless session (launchd weekly, skill-architecture-audit rail) with a 4-part delegation contract (objective, output format, tool guidance, boundaries) that samples 20-30 recent traces/beads/articles (joined via S21 trace_id), open-codes failures against decisions/failure-taxonomy.md, and opens a PR proposing (a) taxonomy deltas and (b) candidate golden tasks for S19's suite — NEVER self-merges, never edits the taxonomy in place. Anti-Goodhart contract wired in per AGENTIC-INTEGRATION-PLAN §4: the run report states its denominator and what was not sampled (§4.6); 'nothing above threshold' is a logged success outcome producing NO PR (§4.1); frozen holdouts are named out-of-bounds in the brief (§4.2); F10.6 consent allowlist declared. First two runs operator-triggered (shadow-equivalent supervision) before the schedule is enabled."
    entrance: "S17 taxonomy v1 + S18 outcome capture + S21 trace_id merged (all verified merged 2026-07-06); S24 merged so sampling reads live streams; run-report format agreed with operator before the first run."
    success: "Two consecutive runs each producing either a well-formed proposal PR or a logged empty-run report with denominator; >=1 proposed item accepted by the operator OR a valid empty result; zero self-merged changes; taxonomy-coverage % reported per run (I3's TPM)."
    check: "pnpm test"
    autonomy: gate-0
    claimable_by: agent_eligible
    kind: l
    repo: core
    status: queued
    depends_on: "rm:rm-l2-ojfbot#S24"
  - id: S27
    phase: PH5
    title: "Cycle-4 synthesis — external DIA survey reconciled against cycles 2-3, verdict per delta"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 37
    moves_to: 38
    deliverable: "DIA-CROSSCHECK-2026-07-08.md appended to the audit series (cycle 4): (1) what the operator's external DIA SOTA survey confirms of AGENTIC-INTEGRATION-PLAN + FLEET-COORDINATION-EXTENSIONS (expected: most of it); (2) the 4 genuine deltas, each with an explicit VERDICT: ACCEPT/DEFER/REJECT line + rationale consistent with the 'nothing here needs weights' stance and the OPAV S5 firebreak — (a) SIA harness+weights co-evolution, (b) test-time-compute allocation policy, (c) consensus voting for high-impact actions, (d) CLHF continuously-retrained evaluators; (3) a line stating whether any verdict reorders tranche 3+."
    entrance: "Cycles 2-3 committed (verified); operator supplied the DIA survey material 2026-07-08; S20 referenced as the standing judge posture the CLHF verdict must reconcile with."
    success: "Doc committed with exactly 4 grep-able 'VERDICT:' lines, cross-references from the cycle-2/3 headers, and the ordering-impact line; verdicts carry operator sign-off at PR merge."
    check: "test -f docs/audits/DIA-CROSSCHECK-2026-07-08.md && [ $(grep -c '^VERDICT' docs/audits/DIA-CROSSCHECK-2026-07-08.md) -eq 4 ]"
    autonomy: gate-0
    claimable_by: either
    kind: m
    repo: core
    status: merged
  - id: S28
    phase: PH6
    title: "Cycle-5 synthesis — loop-engineering + Advisor tool reconciled against cycles 1-4, verdict per delta"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 38
    moves_to: 39
    deliverable: "LOOP-ENGINEERING-CROSSCHECK-2026-07-09.md appended to the audit series (cycle 5): (1) the convergent bulk — loop-engineering building blocks (Cherny/Osmani/Greyling/Masood) mapped onto live/programmed machinery; (2) five deltas each with a grep-able VERDICT line — (a) harness-native loop primitives vs the bespoke layer (PARTIAL-ABSORB policy, trigger layer only), (b) the Advisor tool (paper adjudication, DEFER behind T8; corrects the 'Advisor-Executor' misnomer against the primary source), (c) loops registry (BUILD -> S29), (d) loop liveness (BUILD -> S30), (e) loop closure (CONVERGENT with OPAV S3/S5); (3) ordering-impact line. Verdicts stay consistent with the S20 static-judge posture and the OPAV S5 firebreak."
    entrance: "Cycles 1-4 committed (verified); operator supplied the Dia loop-engineering thread 2026-07-09; Advisor-tool facts verified against platform.claude.com primary docs, not the thread."
    success: "Doc committed with exactly 5 grep-able 'VERDICT:' lines, cross-references to the cycle-1..4 headers, and the ordering-impact line; verdicts carry operator sign-off at PR merge."
    check: "test -f docs/audits/LOOP-ENGINEERING-CROSSCHECK-2026-07-09.md && [ $(grep -c '^VERDICT' docs/audits/LOOP-ENGINEERING-CROSSCHECK-2026-07-09.md) -eq 5 ]"
    autonomy: gate-0
    claimable_by: either
    kind: m
    repo: core
    status: merged
  - id: S29
    phase: PH6
    title: "Loops registry — every loop declared as a first-class resource, lint cross-checks declared vs actual"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 39
    moves_to: 40
    deliverable: "decisions/loops/loops.md — a constrained-frontmatter registry (northstar-fm style) declaring every loop in the cluster (the 3 launchd rails, daily-logger Actions crons, session hooks, day-runner, weekly measure cadence): slug, purpose, trigger kind+ref (launchd|gh-actions|hook|manual|harness-routine as a labeled adapter field), state spine location, verifier, stop rule/budget, owner, declared cadence, last-run evidence pointer. Plus scripts/loops-lint.mjs cross-checking both directions: declared-but-absent trigger artifact = ERROR, discovered-but-undeclared loop (plist / workflow cron / registered hook) = WARN. GLOSSARY.md gains the 'Loops registry' entry (ubiquitous-language rule). Registry answers cycle-5 2c; addresses the O8/P12/T4 pattern (drift and death are silent) and the S25 surprise (day-run 'runs NOWHERE' was discoverable by nobody)."
    entrance: "S28 merged (the verdict this slice implements); northstar-fm.mjs parser + northstar-lint.mjs precedent in place (operational since S16)."
    success: "Registry committed covering every trigger artifact found on disk (lint WARN count 0 at merge); loops-lint runs clean; one deliberately-broken fixture proves both ERROR and WARN paths in tests."
    check: "node scripts/loops-lint.mjs --check"
    autonomy: gate-0
    claimable_by: agent_eligible
    kind: m
    repo: core
    status: merged
    depends_on: "rm:rm-l2-ojfbot#S28"
  - id: S30
    phase: PH6
    title: "Loop liveness — dead-loop detection from the registry, report-only shadow"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 40
    moves_to: 41
    deliverable: "scripts/loops-liveness.mjs — reads the S29 registry, checks each declared loop's last-run evidence (ledger append recency, gh workflow run timestamp, launchd last-fire) against its declared cadence, and reports stale/dead loops with the evidence gap stated. Detection only, shadow posture per ADR-0086: emits a report consumable by the cockpit Overnight lane / a bead — it does NOT page (that is F3's escalation rail; this becomes an F3 emitter when F3 lands) and does NOT restart anything (auto-restart is an automated control requiring its own shadow stage). Closes the T4-shaped gap for infrastructure loops (Dolt down, plist stopped firing, Actions cron disabled by the A2 issue-close gotcha) that F5's agent-liveness states do not cover."
    entrance: "S29 merged (there is no liveness check without a registry declaring cadence + evidence pointers)."
    success: "Liveness report runs against the live registry; a simulated dead loop (fixture with stale evidence) is flagged with its cadence breach; zero paging/restart side effects verified in tests."
    check: "node scripts/loops-liveness.mjs --check"
    autonomy: gate-0
    claimable_by: agent_eligible
    kind: s
    repo: core
    status: merged
    depends_on: "rm:rm-l2-ojfbot#S29"
  - id: S31
    phase: PH6
    title: "OPM pilot verdict — daily-logger shadow-lint clock, keep/kill/revise per ADR-0102"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 41
    moves_to: 43
    deliverable: "The ADR-0102 S2 pilot run to its verdict per the improvement-loop contract (adr:pocock-lifecycle-absorption): ledger = /opm lint --json findings accumulating from daily-logger's observe-only CI step (its ADR-0039); check = /opm lint (3-pass: syntax, anchor resolution, reality-probe); schedule = that CI step on PRs touching src/ or opm/; verdict = after the TPM window (>=1 real drift caught OR model judged accurate across 4 weeks from the CI step going live), a dated decisions/research/ note records keep (promote lint per RIDM + start S3 cockpit pane discussions) / kill (stop at documentation-only per the ADR's kill criterion) / revise. The first manual lint run's findings (posted on daily-logger PR #243) are the clock's t0 baseline."
    entrance: "core PR #255 + daily-logger PR #243 merged; the ADR-0039 observe-only CI step live on daily-logger main."
    success: "The verdict note exists in decisions/research/, cites the accumulated lint findings and the TPM outcome, and ADR-0102's rollout section is updated with the outcome; on kill, the model files remain as documentation and no gate ever activated."
    check: "test -n \"$(ls decisions/research/*opm-pilot-verdict* 2>/dev/null)\""
    autonomy: gate-0
    claimable_by: human_only
    kind: s
    repo: core
    status: queued
  - id: S32
    phase: PH6
    title: "Make the bead-ledger closure loop real and measurable — correct the registry entry, shadow bead-lint, close the event-loop liveness blind spot"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 43
    moves_to: 45
    deliverable: "Five artifacts closing TD-006 (amended 2026-08-02 from three, while still queued: the two additions make S33's 'no new machinery' claim true — its tool today writes reports that retire nothing). (1) decisions/loops/loops.md: the hook-bead-session entry corrected to what scripts/hooks/bead-session.sh actually does (a PostToolUse skill/bash recorder), with the absent session-close report-bead loop declared honestly as its own entry or explicitly marked unimplemented — an entry that lies is worse than a missing one. (2) scripts/bead-lint.mjs, dep-free .mjs in the northstar-lint.mjs mould, reusing parseFM/loadRegistry/repoRootOf from scripts/lib/northstar-fm.mjs: frontmatter parses; type in brief|report|decision|discovery (flag `kind:`); status in live|closed|superseded; id present and equal to the filename stem (the bead-schemas.md invariant replay.py depends on); report responding_to resolves; per-repo open-hook count and age. Plus .github/workflows/bead-lint.yml mirroring northstar-lint.yml including its vantage scoping — sibling repos unreachable from a single-repo checkout downgrade to WARN, never failing a PR over a checkout it cannot see. Also a --sweep mode in the defects-lint.mjs mould (adr:defect-ledger-and-closure-loop): probe each open hook's github:/rm: refs against merged PRs and delivered slices, verdicts evidence-shipped/no-evidence/probe-error, proposal-only — the sweep never writes a closure; probe failure is never a verdict. (3) The event-loop liveness blind spot closed: either loops-liveness.mjs evaluates cadence: event loops against evidence_ref recency, or event loops are required to declare a verifier — pick one and record why in the slice's PR. (4) .claude/skills/resume/scripts/verify-session.mjs backfill fixed to resolve responding_to (explicit github: ref match in an open brief's hook:/refs:, else brief-slug × headRefName tokens, else unique time-window; ambiguous stays null + labels.responding_to_ambiguous — never guess toward closed), so a backfilled report actually retires its hook in orient.py's formula. (5) Forward-only hook convention: briefs created after this slice merges should carry a machine key (github:owner/repo#N or rm:<roadmap>#S<n>) in hook: or refs: — WARN in bead-lint, never blocking; documented in the /bead skill's schema reference and templates; backfill of pre-existing drifted beads stays S33's job."
    entrance: "TD-006 filed in TECHDEBT.md with the fleet audit numbers; the 28-open-hook baseline recorded as the TPM t0."
    success: "bead-lint runs across the fleet and reports the 28-hook baseline without failing any PR (shadow/WARN-only per ADR-0086 — enforcing before S33 backfills would red-wall every PR on day one); the hook-bead-session registry entry matches the script's real behaviour; loops-liveness no longer silently skips the loop class this defect hid in."
    check: "node scripts/bead-lint.mjs --check"
    autonomy: gate-0
    claimable_by: either
    kind: m
    repo: core
    status: ready
  - id: S33
    phase: PH6
    title: "Backfill the bead ledger — resolve the 28 open hooks to shipped-or-pending, then promote bead-lint from shadow"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 45
    moves_to: 47
    deliverable: "The fleet's open hooks driven down to the verified-pending set using the existing /resume --verify, which already backfills git-grounded report beads for work that shipped with no self-report — no new machinery. Worked by concentration: core (11), morning-cockpit (5), lofi-beaver (3), then the remainder. Each hook resolves to shipped (write the report bead, flip the brief to closed) or genuinely pending (leave live, and say why). The split between those two is the finding and belongs in the slice's report bead: if most were shipped, the ledger was actively misleading rather than merely stale. Also installs the bead skill in the 8 repos that have a .handoff/ but no .claude/skills/bead (bldgblog-corpus, capture-agent (formerly gcgcca), lofi-beaver, mc-motion, mc-perf, morning-cockpit, silicon-empires, virtualLight) via scripts/install-agents.sh, and records whether bead-skill presence belongs in /fleet-onboard's reconcile checklist. NOTE 2026-07-30: capture-agent is already done - bead skill + bead-session hook installed and committed ahead of this gate on explicit operator instruction, alongside adr:installed-harness-is-tracked. The remaining list is 7, not 8. Evidence found there and worth carrying into this slice: the repo held 9 beads with no bead skill, and its settings.json was missing the bead-session hook entirely despite a full install-agents run on 2026-07-28 - so 'has .handoff/ but no bead skill' understates the gap, and the hook merge should be checked separately from skill presence."
    entrance: "rm:rm-l2-ojfbot#S32 merged — bead-lint reporting in shadow so the backfill has a baseline to move."
    success: "Open hooks equal the verified-pending set with each closure git-grounded; the shipped-vs-pending split is recorded; schema errors promoted from WARN to blocking in bead-lint.yml (the RIDM step S32 set up) with the fleet clean at promotion time."
    check: "node scripts/bead-lint.mjs --check --max-open-hook-age-days=30"
    autonomy: gate-0
    claimable_by: human_only
    kind: m
    repo: core
    status: ready
    depends_on: "rm:rm-l2-ojfbot#S32"
  - id: S34
    phase: PH7
    title: "Fleet reconciler in shadow — one derived view of fleet membership across every enumeration surface"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 47
    moves_to: 48
    deliverable: "scripts/fleet-manifest.mjs reconciles the northstar registry against all 13 enumeration surfaces (core CLAUDE.md table, frame-standup lists, daily-logger collect/api, cockpit REPO_META, launcher registrations, domain-knowledge manifest, …) and reports DRIFT/OK/MANUAL/AUTO per surface; shadow mode, exit 0 always; a reconcile CI job runs it on every PR."
    entrance: "TD-007 filed with four hand-maintained inventories named and evidence that registered repos are invisible on some of them."
    success: "The reconciler runs green in CI, names real drift (f1-learning-studio stale on the CLAUDE.md table, gcgcca stale in daily-logger build-api.ts, fieldwork-1 registered-but-on-no-surface), and never gates a PR."
    check: "test -f scripts/fleet-manifest.mjs && node scripts/fleet-manifest.mjs > /dev/null"
    autonomy: gate-0
    claimable_by: agent_eligible
    kind: m
    repo: core
    status: merged
  - id: S35
    phase: PH7
    title: "Personal exile + attic + dead-structure delete — core carries no operator-personal material"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 48
    moves_to: 49
    deliverable: "personal-knowledge/ moved to ~/selfco/career/ (gitignored both ends); install-agents.sh's job-doc distribution phase deleted rather than retargeted; career framing stripped from the fleet-symlinked frame-os-context.md; 9 dated audits + SURVEY.md moved to docs/audits/ with an index; empty skills/, packages/cli and packages/vscode-extension deleted with every README/docs claim about them corrected."
    entrance: "S34 merged — the reconciler catches any reference this slice misses."
    success: "Installer re-run is idempotent fleet-wide with zero dead symlinks and creates no personal-knowledge/; no live reference to a deleted path; reconciler drift unchanged or reduced."
    check: "test ! -d skills && test ! -d packages/cli && test ! -d packages/vscode-extension && test -d docs/audits && ! grep -q 'PERSONAL_SRC' scripts/install-agents.sh"
    autonomy: gate-0
    claimable_by: agent_eligible
    kind: m
    repo: core
    status: merged
    depends_on: "rm:rm-l2-ojfbot#S34"
  - id: S36
    phase: PH7
    title: "Manifest-driven domain-knowledge — universal/ + apps/ replace two hardcoded lists in the installer"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 49
    moves_to: 50
    deliverable: "domain-knowledge/manifest.json as the single source of truth for what install-agents.sh distributes; sources split into universal/ (13, every repo) and apps/ (13, mapped repos only); the UNIVERSAL=() array and the case \"$REPO_NAME\" switch deleted; targets keep a flat domain-knowledge/<file>; the reconciler's arch-doc surface retargeted to the manifest."
    entrance: "S35 merged; the flat target contract confirmed as what all 30 sibling repos consume."
    success: "Installer links the manifest's universal set plus mapped app files, resolves repo aliases, stays idempotent with zero dead symlinks; fleet-manifest shows no new drift; full suite green. Fixes the verified gap where coding-standards.md, diagram-conventions.md and opm-modeling.md were read by fleet-distributed skills but shipped to nobody."
    check: "test -f domain-knowledge/manifest.json && node -e \"const m=require('./domain-knowledge/manifest.json');process.exit(m.universal?.length&&Object.keys(m.apps||{}).length?0:1)\" && ! grep -q 'UNIVERSAL=(' scripts/install-agents.sh"
    autonomy: gate-0
    claimable_by: agent_eligible
    kind: m
    repo: core
    status: merged
    depends_on: "rm:rm-l2-ojfbot#S35"
  - id: S37
    phase: PH7
    title: "Decisions hygiene — engagements/ split and governs: tags, selfco ADRs tagged not moved"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 50
    moves_to: 51
    deliverable: "decisions/ re-layered so client-engagement records live under engagements/ and every ADR carries a governs: tag naming what it binds; selfco-scoped ADRs are tagged in place, never relocated (the x33 decisions/ symlink makes moves fleet-visible)."
    entrance: "S36 merged; the disclosure-seam ruling for engagement records confirmed with the operator."
    success: "Every ADR resolves a governs: tag; no decisions/ path referenced by a sibling repo changes; adr-provenance CI stays green."
    check: "node scripts/adr-provenance.mjs --check || node scripts/northstar-lint.mjs --check"
    autonomy: gate-0
    claimable_by: human_only
    kind: m
    repo: core
    status: queued
    depends_on: "rm:rm-l2-ojfbot#S36"
  - id: S38
    phase: PH7
    title: "Honest caches — generated skill-catalog and a fleet.json the CLAUDE.md table points at"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 51
    moves_to: 52
    deliverable: "skill-catalog.json generated from the skill directories rather than hand-maintained, and core's CLAUDE.md ecosystem table replaced by a pointer to a derived fleet.json — so the two largest hand-copied caches in the repo stop being independently editable assertions."
    entrance: "S37 merged; the reconciler has run long enough in shadow to show which surfaces drift most."
    success: "Both caches are regenerated by a script with a CI check that fails on staleness; the reconciler reports the CLAUDE.md-table surface as AUTO rather than DRIFT."
    check: "node scripts/fleet-manifest.mjs --check"
    autonomy: gate-0
    claimable_by: agent_eligible
    kind: m
    repo: core
    status: queued
    depends_on: "rm:rm-l2-ojfbot#S37"
  - id: S39
    phase: PH7
    title: "Promote the reconciler from shadow to blocking — RIDM on observed drift"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 52
    moves_to: 53
    deliverable: "fleet-manifest --check wired as a blocking CI gate, promoted only on evidence: a shadow-period record showing the reconciler's findings were real and actionable, with the remaining MANUAL surfaces either machine-diffable or explicitly exempted."
    entrance: "S38 merged; a shadow-period record exists showing zero false-positive DRIFT reports, and every surface is AUTO, OK, or an explicit documented exemption."
    success: "A PR that removes a repo from one surface fails CI; the promotion decision is recorded as a data-gated RIDM citing the shadow record."
    check: "node scripts/fleet-manifest.mjs --check"
    autonomy: gate-0
    claimable_by: human_only
    kind: m
    repo: core
    status: queued
    depends_on: "rm:rm-l2-ojfbot#S38"
  - id: S40
    phase: PH8
    title: "P0-PROBE — Write the NAS admin refusal probe (the #667 E10 test)"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 30
    moves_to: 30
    deliverable: "A reviewed PR closing ojfbot/LocalHelp#126 (trust build slice P0-PROBE)."
    entrance: "None. Can start now."
    success: "A read-only script, run from a Mac with the agent key, tries a fixed list of harmless admin reads and reports each as refused, allowed or unknown. Any “allowed” or “unknown” fails it. It changes nothing on the NAS. It has a self-test mode against a fake NAS."
    check: "bash scripts/check-nas-admin-refused --self-test"
    autonomy: gate-0
    claimable_by: human_only
    kind: s
    repo: LocalHelp
    status: queued
  - id: S41
    phase: PH8
    title: "OW-0 — (owner-only) Owner: take NAS admin away from the Macs (slice 0)"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 30
    moves_to: 30
    deliverable: "Owner step recorded on ojfbot/LocalHelp#127 (trust build slice OW-0)."
    entrance: "P0-PROBE merged."
    success: "Agents hold only a stage-and-status key. The owner has a deploy and promote path agents cannot drive (a touch-to-use hardware key or the NAS admin login). Other NAS trust material that sits on a Mac moves off the Macs (the list is in the private triage note)."
    check: "bash scripts/check-nas-admin-refused"
    autonomy: gate-0
    claimable_by: human_only
    kind: l
    repo: LocalHelp
    status: queued
    depends_on: "rm:rm-l2-ojfbot#S40"
  - id: S42
    phase: PH8
    title: "P0-WIZ — Owner-setup wizard for the GitHub Apps, key enrolment and the terminal token switch (#681 S1 wizard part)"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 30
    moves_to: 30
    deliverable: "A reviewed PR closing ojfbot/LocalHelp#128 (trust build slice P0-WIZ)."
    entrance: "None. Can start now."
    success: "An interactive script (made with `/wizard`) walks the owner through OW-1a, OW-1b and OW-2: which permissions to tick, where each key goes (the token issuer only), and how to revoke the old classic token. Secrets are typed hidden and never echoed or written to a Mac file. Agents never run it. It also ships the read-only after-checks `scripts/check-github-app-permissions` (OW-1a) and `scripts/check-terminal-token-refused` (OW-2)."
    check: "bash scripts/owner-setup-github --dry-run"
    autonomy: gate-0
    claimable_by: human_only
    kind: s
    repo: LocalHelp
    status: queued
  - id: S43
    phase: PH8
    title: "AU-1a — Authority service skeleton: own account and key, hash-chained journal, replay and read-only status"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 30
    moves_to: 30
    deliverable: "A reviewed PR closing ojfbot/LocalHelp#129 (trust build slice AU-1a)."
    entrance: "None to build and test locally. Its first staging install, under its own account, happens at AU-1b after OW-SVC."
    success: "A new package `packages/authority`, built and tested on a local test copy with fixtures (its staging install under its own account follows OW-SVC, at AU-1b). Every record goes into an append-only, hash-chained journal with replay (`has_more`, `latest_sequence`) from day one. It serves a read-only status for the status display. It relays no messages, reads no tickets or posts, and holds no GitHub keys."
    check: "pnpm --fail-if-no-match --filter @localhelp/authority build && pnpm --fail-if-no-match --filter @localhelp/authority exec vitest run AU-1a.test"
    autonomy: gate-0
    claimable_by: human_only
    kind: l
    repo: LocalHelp
    status: queued
  - id: S44
    phase: PH8
    title: "OW-SVC — (owner-only) Owner: create a NAS account and key for each new service (authority service, token issuer, checker, data layer)"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 30
    moves_to: 30
    deliverable: "Owner step recorded on ojfbot/LocalHelp#199 (trust build slice OW-SVC)."
    entrance: "OW-0 done (only the owner can create accounts now)."
    success: "Each of the four new services has its own NAS account and its own key, made by the owner, for staging and for go-live. No Mac account can administer them. The checker and data-layer accounts may be made now or just before DA-1a and CK-1a."
    check: "bash scripts/check-nas-admin-refused --services"
    autonomy: gate-0
    claimable_by: human_only
    kind: m
    repo: LocalHelp
    status: queued
    depends_on: "rm:rm-l2-ojfbot#S41"
  - id: S45
    phase: PH8
    title: "AU-1b — Signing keys, the pinned first key and the passkey signing page"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 30
    moves_to: 30
    deliverable: "A reviewed PR closing ojfbot/LocalHelp#130 (trust build slice AU-1b)."
    entrance: "AU-1a merged; OW-SVC done (the service accounts exist)."
    success: "The authority service is installed on staging under its own owner-made account. A signing-key log and the support for adding the first key at the NAS and pinning it on one Mac, proven with test keys and fixtures. The real first key is added by the owner at OW-K1. The authority service serves the signing page, so what the owner sees comes from the service that records it. The canonical record bytes include the challenge nonce, so a checker can re-verify from stored data alone."
    check: "pnpm --fail-if-no-match --filter @localhelp/authority build && pnpm --fail-if-no-match --filter @localhelp/authority exec vitest run AU-1b.test"
    autonomy: gate-0
    claimable_by: human_only
    kind: l
    repo: LocalHelp
    status: queued
    depends_on: "rm:rm-l2-ojfbot#S43"
  - id: S46
    phase: PH8
    title: "AU-1c — Approval records and the spent-approval ledger"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 30
    moves_to: 30
    deliverable: "A reviewed PR closing ojfbot/LocalHelp#132 (trust build slice AU-1c)."
    entrance: "AU-1b merged."
    success: "An approval names one action, one target, one environment and who may spend it. It lapses at 24 hours. It is spent once per decision, keyed by its ID, never by the wording of a quote. Until AU-2a exists, “who may spend it” is checked against the session named in the approval only, and that limit is written on the record."
    check: "pnpm --fail-if-no-match --filter @localhelp/authority build && pnpm --fail-if-no-match --filter @localhelp/authority exec vitest run AU-1c.test"
    autonomy: gate-0
    claimable_by: human_only
    kind: l
    repo: LocalHelp
    status: queued
    depends_on: "rm:rm-l2-ojfbot#S45"
  - id: S47
    phase: PH8
    title: "AU-1d — `helpdesk-promote` spends an approval ID at the authority service (closes LocalHelp#124)"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 30
    moves_to: 30
    deliverable: "A reviewed PR closing ojfbot/LocalHelp#133 (trust build slice AU-1d)."
    entrance: "AU-1c merged."
    success: "`scripts/helpdesk-promote` takes an approval ID, asks the authority service to spend it for that revision and environment, and refuses on any other answer, including no answer. The old text-hash used-approval record (`promote.log`) is imported into the spent-approval ledger as spent, so nothing approved under the old rule can be spent again, and then the text-hash check is retired."
    check: "pnpm --fail-if-no-match --filter @localhelp/authority build && pnpm --fail-if-no-match --filter @localhelp/authority exec vitest run AU-1d.test && bash scripts/test-helpdesk-promote.sh"
    autonomy: gate-0
    claimable_by: human_only
    kind: m
    repo: LocalHelp
    status: queued
    depends_on: "rm:rm-l2-ojfbot#S46"
  - id: S48
    phase: PH8
    title: "TI-1a — Token issuer skeleton: own account, key store and enrolment, no minting yet"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 30
    moves_to: 30
    deliverable: "A reviewed PR closing ojfbot/LocalHelp#136 (trust build slice TI-1a)."
    entrance: "OW-0 and OW-SVC done (the issuer runs under an owner-made account, and its keys must sit where no Mac can read them)."
    success: "A new package `packages/token-issuer` runs on staging under its own account. It can enrol GitHub App keys and the gate App key, and holds them where no Mac account can read them. It has no settings or secrets power and mints nothing yet. It serves a read-only status."
    check: "pnpm --fail-if-no-match --filter @localhelp/token-issuer build && pnpm --fail-if-no-match --filter @localhelp/token-issuer exec vitest run TI-1a.test"
    autonomy: gate-0
    claimable_by: human_only
    kind: l
    repo: LocalHelp
    status: queued
    depends_on: "rm:rm-l2-ojfbot#S44"
  - id: S49
    phase: PH8
    title: "OW-BK-AU — (owner-only) Owner: add the authority service data and the issuer's keys to the NAS backup (separate reviewed change)"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 30
    moves_to: 30
    deliverable: "Owner step recorded on ojfbot/LocalHelp#141 (trust build slice OW-BK-AU)."
    entrance: "AU-1b and TI-1a on staging."
    success: "The authority journal and the issuer's key store are in the NAS backup, through a separately reviewed change applied by the owner. An agent may draft that change as a PR only when the owner asks."
    check: "the reviewed change's own restore test (named in that PR)"
    autonomy: gate-0
    claimable_by: human_only
    kind: m
    repo: LocalHelp
    status: queued
    depends_on: "rm:rm-l2-ojfbot#S45"
  - id: S50
    phase: PH8
    title: "P0-GL — Install the authority service and the token issuer at the go-live level (one owner tap)"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 30
    moves_to: 30
    deliverable: "A reviewed PR closing ojfbot/LocalHelp#200 (trust build slice P0-GL)."
    entrance: "AU-1d and TI-1a merged; OW-SVC and OW-BK-AU done."
    success: "The authority service and the token issuer are installed at the go-live level under their own accounts, with one owner tap. This is the instance the owner's real keys go into (OW-K1, OW-1b). It is the one go-live install #674 places before the outside review, for the Face ID promote only: no enforcement is switched on."
    check: "pnpm --fail-if-no-match --filter @localhelp/authority build && pnpm --fail-if-no-match --filter @localhelp/authority exec vitest run AU-golive.test && pnpm --fail-if-no-match --filter @localhelp/token-issuer build && pnpm --fail-if-no-match --filter @localhelp/token-issuer exec vitest run TI-golive.test"
    autonomy: gate-0
    claimable_by: human_only
    kind: m
    repo: LocalHelp
    status: queued
    depends_on: "rm:rm-l2-ojfbot#S47"
  - id: S51
    phase: PH8
    title: "OW-K1 — (owner-only) Owner: add the first signing key at the NAS and pin it on one Mac"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 30
    moves_to: 30
    deliverable: "Owner step recorded on ojfbot/LocalHelp#131 (trust build slice OW-K1)."
    entrance: "P0-GL done (the go-live authority service exists)."
    success: "The first passkey is added at the NAS to the go-live authority service, not from a Mac, and its fingerprint is pinned on one Mac. Agents never touch the key."
    check: "pnpm --fail-if-no-match --filter @localhelp/authority build && pnpm --fail-if-no-match --filter @localhelp/authority exec vitest run AU-1b-pinned.test"
    autonomy: gate-0
    claimable_by: human_only
    kind: m
    repo: LocalHelp
    status: queued
    depends_on: "rm:rm-l2-ojfbot#S50"
  - id: S52
    phase: PH8
    title: "OW-FID — (owner-only) Owner: the first Face ID promote approval, end to end"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 30
    moves_to: 30
    deliverable: "Owner step recorded on ojfbot/LocalHelp#134 (trust build slice OW-FID)."
    entrance: "AU-1d on staging; OW-K1 done."
    success: "The owner approves one real promote on the phone with Face ID; promote spends that approval ID once; a second promote with the same ID is refused."
    check: "pnpm --fail-if-no-match --filter @localhelp/authority build && pnpm --fail-if-no-match --filter @localhelp/authority exec vitest run AU-1-e2e.test"
    autonomy: gate-0
    claimable_by: human_only
    kind: m
    repo: LocalHelp
    status: queued
    depends_on: "rm:rm-l2-ojfbot#S47"
  - id: S53
    phase: PH8
    title: "OW-ACK — (owner-only) Owner: re-make one listener acknowledgement in the confirmed format, at a real terminal, before that Mac's gated listener upgrade"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 30
    moves_to: 30
    deliverable: "Owner step recorded on ojfbot/LocalHelp#135 (trust build slice OW-ACK)."
    entrance: "None. Must be done before the gated 0.9.15 listener upgrade on that Mac (ojfbot/LocalHelp#113 doctor)."
    success: "The owner re-makes one old-format listener acknowledgement for an “unknown” delivery, at a real terminal on that Mac (a terminal check, then typing the delivery-ID prefix). The 0.9.15 doctor then passes it."
    check: "the 0.9.15 doctor on that Mac reports the acknowledgement as confirmed (read-only; ojfbot/LocalHelp#113)"
    autonomy: gate-0
    claimable_by: human_only
    kind: s
    repo: LocalHelp
    status: queued
  - id: S54
    phase: PH8
    title: "OW-1a — (owner-only) Owner: create one GitHub App per Mac and the check-only gate App"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 30
    moves_to: 30
    deliverable: "Owner step recorded on ojfbot/LocalHelp#137 (trust build slice OW-1a)."
    entrance: "P0-WIZ merged."
    success: "One App per Mac with Contents, Pull requests, Issues, Checks and Statuses write, Actions and Administration read, and no Administration or Secrets write, installed on the fleet repos. A check-only gate App. The owner decides here whether the Apps get Actions write, so a stop can cancel Actions runs."
    check: "bash scripts/check-github-app-permissions"
    autonomy: gate-0
    claimable_by: human_only
    kind: m
    repo: LocalHelp
    status: queued
    depends_on: "rm:rm-l2-ojfbot#S42"
  - id: S55
    phase: PH8
    title: "OW-1b — (owner-only) Owner: generate each App key and enrol it in the token issuer only"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 30
    moves_to: 30
    deliverable: "Owner step recorded on ojfbot/LocalHelp#138 (trust build slice OW-1b)."
    entrance: "OW-1a and P0-GL done (the go-live issuer exists)."
    success: "Each App's private key, and the gate App's key, is generated and enrolled straight into the go-live issuer, never stored on a Mac. Staging uses separate test Apps or test keys only."
    check: "bash scripts/check-no-app-keys-on-mac"
    autonomy: gate-0
    claimable_by: human_only
    kind: m
    repo: LocalHelp
    status: queued
    depends_on: "rm:rm-l2-ojfbot#S54"
  - id: S56
    phase: PH8
    title: "OW-2 — (owner-only) Owner: switch the terminal login to a token with no settings power"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 30
    moves_to: 30
    deliverable: "Owner step recorded on ojfbot/LocalHelp#139 (trust build slice OW-2)."
    entrance: "P0-WIZ merged."
    success: "A fine-grained terminal token per Mac with no Administration or Secrets write; `gh` signed in with it; the old classic token revoked. The time is noted as “the switch”."
    check: "bash scripts/check-terminal-token-refused"
    autonomy: gate-0
    claimable_by: human_only
    kind: m
    repo: LocalHelp
    status: queued
    depends_on: "rm:rm-l2-ojfbot#S42"
  - id: S57
    phase: PH8
    title: "OW-6 — (owner-only) Owner: review the third-party apps authorized on the owner's login (#681 owner step 7)"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 30
    moves_to: 30
    deliverable: "Owner step recorded on ojfbot/LocalHelp#140 (trust build slice OW-6)."
    entrance: "None."
    success: "Every third-party app with access to the owner's login is listed and kept or removed on purpose."
    autonomy: gate-0
    claimable_by: human_only
    kind: s
    repo: LocalHelp
    status: queued
  - id: S58
    phase: PH8
    title: "RETRO-0 — Layer retro: phase 0 done, re-check phase 1 assumptions"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 30
    moves_to: 30
    deliverable: "A reviewed PR closing ojfbot/core#694 (trust build slice RETRO-0)."
    entrance: "Every other phase 0 slice closed."
    success: "The conductor (or a fresh session) re-reads the discoveries issue and every phase 0 slice's “Deviations and discoveries” section; re-checks each phase 1 entrance condition and the unknowns it touches; re-plans any phase 1 slice whose assumptions moved; and sends any change to a ruled decision to the owner through the conductor. The retro is recorded as a comment on the phase 0 epic."
    check: "node scripts/check-trust-phase-proof.mjs --phase PH8"
    autonomy: gate-0
    claimable_by: human_only
    kind: s
    repo: core
    status: queued
    depends_on: "rm:rm-l2-ojfbot#S52"
  - id: S59
    phase: PH9
    title: "HD-1a — Registration proof stored, and lifecycle events in replay (#666 item 2)"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 30
    moves_to: 30
    deliverable: "A reviewed PR closing ojfbot/LocalHelp#142 (trust build slice HD-1a)."
    entrance: "RETRO-0 done."
    success: "Each registration keeps the handshake challenge bytes, the session key's signature, the device key's vouching signature, and HelpDesk's sequence and time; a rotation also keeps the old key's endorsement. Replay returns registration, rotation, reclaim and retire events. A fresh checker re-verifies a registration from stored bytes alone."
    check: "pnpm --fail-if-no-match --filter @localhelp/helpdesk build && pnpm --fail-if-no-match --filter @localhelp/helpdesk exec vitest run HD-1a.test"
    autonomy: gate-0
    claimable_by: human_only
    kind: l
    repo: LocalHelp
    status: queued
    depends_on: "rm:rm-l2-ojfbot#S58"
  - id: S60
    phase: PH9
    title: "HD-1b — Signed holder-state read, and a renewal keeps the holder live (#666 checks 3 and 7)"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 30
    moves_to: 30
    deliverable: "A reviewed PR closing ojfbot/LocalHelp#143 (trust build slice HD-1b)."
    entrance: "HD-1a merged."
    success: "HelpDesk serves a signed read of a named holder's current state (latest registration, expiry, retired, reclaimed or rotated) that any device and the authority service can fetch. If it can't be fetched, the state is unknown. Across 24 hours of 6-hour renewals the holder stays live."
    check: "pnpm --fail-if-no-match --filter @localhelp/helpdesk build && pnpm --fail-if-no-match --filter @localhelp/helpdesk exec vitest run HD-1b.test"
    autonomy: gate-0
    claimable_by: human_only
    kind: m
    repo: LocalHelp
    status: queued
    depends_on: "rm:rm-l2-ojfbot#S59"
  - id: S61
    phase: PH9
    title: "AU-2a — Charter of top seats and the seat check (service side)"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 30
    moves_to: 30
    deliverable: "A reviewed PR closing ojfbot/LocalHelp#144 (trust build slice AU-2a)."
    entrance: "AU-1c and HD-1b merged."
    success: "The charter record (top seats, standbys, standing exceptions) with its `replaces` chain. Seats bind to session name and key ID, and any live registration of that key counts. The seat check reads HelpDesk's holder state when work is admitted and again right before the effect, and uses the newest charter. Replay returns owner records. AU-1c's spender check now uses the charter."
    check: "pnpm --fail-if-no-match --filter @localhelp/authority build && pnpm --fail-if-no-match --filter @localhelp/authority exec vitest run AU-2a.test"
    autonomy: gate-0
    claimable_by: human_only
    kind: l
    repo: LocalHelp
    status: queued
    depends_on: "rm:rm-l2-ojfbot#S46"
  - id: S62
    phase: PH9
    title: "AU-2b — Mac-side record checker in the device client"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 30
    moves_to: 30
    deliverable: "A reviewed PR closing ojfbot/LocalHelp#145 (trust build slice AU-2b)."
    entrance: "AU-2a merged."
    success: "The device client replays owner records and the charter to the end (`has_more` false, up to the latest sequence at check time) and checks each against the Mac's pinned first key, without trusting the host. If replay can't finish, the result is unknown and risky actions stop. It remembers the newest charter sequence it has seen. It is labelled declared, never enforcement."
    check: "pnpm --fail-if-no-match --filter @localhelp/helpdesk-device build && pnpm --fail-if-no-match --filter @localhelp/helpdesk-device exec vitest run AU-2b.test"
    autonomy: gate-0
    claimable_by: human_only
    kind: l
    repo: LocalHelp
    status: queued
    depends_on: "rm:rm-l2-ojfbot#S61"
  - id: S63
    phase: PH9
    title: "AU-3a — Work-grant records with hops and validity windows (service side)"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 30
    moves_to: 30
    deliverable: "A reviewed PR closing ojfbot/LocalHelp#146 (trust build slice AU-3a)."
    entrance: "AU-2a merged."
    success: "Work-grant records that narrow scope and validity at both ends, carry hops left (at most the parent's minus 1 and the count left from the nearest seat), never authorize ask-first or never actions, and stop risky actions when records contradict. Nothing is honored before the charter and this check exist. A key rotation pauses only the rotated holder's own authority."
    check: "pnpm --fail-if-no-match --filter @localhelp/authority build && pnpm --fail-if-no-match --filter @localhelp/authority exec vitest run AU-3a.test"
    autonomy: gate-0
    claimable_by: human_only
    kind: l
    repo: LocalHelp
    status: queued
    depends_on: "rm:rm-l2-ojfbot#S61"
  - id: S64
    phase: PH9
    title: "AU-3b — Two-link checker on each Mac, and replay returns grant records"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 30
    moves_to: 30
    deliverable: "A reviewed PR closing ojfbot/LocalHelp#147 (trust build slice AU-3b)."
    entrance: "AU-3a and AU-2b merged."
    success: "Replay returns work-grant and set-aside records. The Mac-side checker verifies a two-hop chain from raw records alone up to the owner's passkey."
    check: "pnpm --fail-if-no-match --filter @localhelp/helpdesk-device build && pnpm --fail-if-no-match --filter @localhelp/helpdesk-device exec vitest run AU-3b.test"
    autonomy: gate-0
    claimable_by: human_only
    kind: m
    repo: LocalHelp
    status: queued
    depends_on: "rm:rm-l2-ojfbot#S63"
  - id: S65
    phase: PH9
    title: "AU-4a — Live grant check: one call verifies a chain and records an observed answer"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 30
    moves_to: 30
    deliverable: "A reviewed PR closing ojfbot/LocalHelp#148 (trust build slice AU-4a)."
    entrance: "AU-3a merged."
    success: "One signed live call answers “is this allowed?” for a named grant and its chain, using the newest charter and HelpDesk's holder state. Every answer, yes or no, is an observed record in the authority journal naming the grant by ID and fingerprint and the asking service's request. Which actions count as risky per service is written down here."
    check: "pnpm --fail-if-no-match --filter @localhelp/authority build && pnpm --fail-if-no-match --filter @localhelp/authority exec vitest run AU-4a.test"
    autonomy: gate-0
    claimable_by: human_only
    kind: l
    repo: LocalHelp
    status: queued
    depends_on: "rm:rm-l2-ojfbot#S63"
  - id: S66
    phase: PH9
    title: "AU-4b — Shared run counter and reservations"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 30
    moves_to: 30
    deliverable: "A reviewed PR closing ojfbot/LocalHelp#149 (trust build slice AU-4b)."
    entrance: "AU-4a merged."
    success: "One counter: set-asides plus reserved runs never exceed the pot at any level. Each reservation is made in the same call as the grant check. Unused runs return only when accounted for; unknown use stays counted. While the authority service can't be reached, nothing is reserved."
    check: "pnpm --fail-if-no-match --filter @localhelp/authority build && pnpm --fail-if-no-match --filter @localhelp/authority exec vitest run AU-4b.test"
    autonomy: gate-0
    claimable_by: human_only
    kind: l
    repo: LocalHelp
    status: queued
    depends_on: "rm:rm-l2-ojfbot#S65"
  - id: S67
    phase: PH9
    title: "AU-4c — Grant-end notice to the issuer (expiry and single-record end)"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 30
    moves_to: 30
    deliverable: "A reviewed PR closing ojfbot/LocalHelp#150 (trust build slice AU-4c)."
    entrance: "AU-4b merged."
    success: "When a grant expires or one record is ended, the authority service tells the token issuer by a signed call, and records that it did. The full cascade stays in AU-9."
    check: "pnpm --fail-if-no-match --filter @localhelp/authority build && pnpm --fail-if-no-match --filter @localhelp/authority exec vitest run AU-4c.test"
    autonomy: gate-0
    claimable_by: human_only
    kind: m
    repo: LocalHelp
    status: queued
    depends_on: "rm:rm-l2-ojfbot#S66"
  - id: S68
    phase: PH9
    title: "TI-1b — Mint one-hour repo-limited tokens only after the grant check (watch-only first)"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 30
    moves_to: 30
    deliverable: "A reviewed PR closing ojfbot/LocalHelp#151 (trust build slice TI-1b)."
    entrance: "TI-1a, AU-4b and OW-1b done."
    success: "The issuer mints a one-hour token limited to the grant's repos only after the authority service's check and one reserved run. It fails closed when the authority service can't be reached. On staging it first runs watch-only: it records every refusal it would make and a weekly count."
    check: "pnpm --fail-if-no-match --filter @localhelp/token-issuer build && pnpm --fail-if-no-match --filter @localhelp/token-issuer exec vitest run TI-1b.test"
    autonomy: gate-0
    claimable_by: human_only
    kind: l
    repo: LocalHelp
    status: queued
    depends_on: "rm:rm-l2-ojfbot#S48"
  - id: S69
    phase: PH9
    title: "CH-1b — Pin agent sessions to the Mac's App: token helper and session settings (#681 S1)"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 30
    moves_to: 30
    deliverable: "A reviewed PR closing ojfbot/core#695 (trust build slice CH-1b)."
    entrance: "TI-1b on staging; OW-2 done."
    success: "A token helper asks the issuer for one-hour repo-limited tokens; Claude Code and Codex session settings wire it into `gh` and git. A G1 preflight shows agent work under the Mac's App; a G2 refusal test shows a settings change refused. Written plainly as setup, not a lock."
    check: "pnpm vitest run CH-1b.test"
    autonomy: gate-0
    claimable_by: human_only
    kind: m
    repo: core
    status: queued
    depends_on: "rm:rm-l2-ojfbot#S68"
  - id: S70
    phase: PH9
    title: "TI-2 — Revoke live tokens on grant end, and the issuer's rollback guard"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 30
    moves_to: 30
    deliverable: "A reviewed PR closing ojfbot/LocalHelp#152 (trust build slice TI-2)."
    entrance: "TI-1b and AU-4c merged."
    success: "On a grant-end notice the issuer revokes every live token it minted for that grant with GitHub's revoke call and records the time GitHub took. It remembers the newest authority sequence it has seen and refuses to mint against an authority service that has gone back to older data."
    check: "pnpm --fail-if-no-match --filter @localhelp/token-issuer build && pnpm --fail-if-no-match --filter @localhelp/token-issuer exec vitest run TI-2.test"
    autonomy: gate-0
    claimable_by: human_only
    kind: l
    repo: LocalHelp
    status: queued
    depends_on: "rm:rm-l2-ojfbot#S68"
  - id: S71
    phase: PH9
    title: "FR-1 — Enqueue checks the grant; every claim reserves a run (watch-only first)"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 30
    moves_to: 30
    deliverable: "A reviewed PR closing ojfbot/core#696 (trust build slice FR-1)."
    entrance: "AU-4b merged."
    success: "Enqueue checks the grant live. The first claim, a retry after failure and a re-claim after release each make a live grant check and reserve one run before the job is handed out. While the authority service is down, nothing is claimed and queued jobs wait; an attempt already claimed carries on under its fence. Watch-only first on staging."
    check: "pnpm vitest run --dir packages/fleet-runner FR-1.test"
    autonomy: gate-0
    claimable_by: human_only
    kind: m
    repo: core
    status: queued
    depends_on: "rm:rm-l2-ojfbot#S66"
  - id: S72
    phase: PH9
    title: "HD-2 — Listeners and wakes check and reserve before a TASK runs, with the signed-sender list"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 30
    moves_to: 30
    deliverable: "A reviewed PR closing ojfbot/LocalHelp#153 (trust build slice HD-2)."
    entrance: "AU-4b merged."
    success: "Before a TASK runs, the listener or wake checks the grant and reserves a run at the authority service; it acts only on signed TASKs from sessions on that Mac's list. If the authority service can't be reached, no new TASK starts. Watch-only first."
    check: "pnpm --fail-if-no-match --filter @localhelp/helpdesk-device build && pnpm --fail-if-no-match --filter @localhelp/helpdesk-device exec vitest run HD-2.test"
    autonomy: gate-0
    claimable_by: human_only
    kind: m
    repo: LocalHelp
    status: queued
    depends_on: "rm:rm-l2-ojfbot#S66"
  - id: S73
    phase: PH9
    title: "AU-5 — Rollback guard for authority records"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 30
    moves_to: 30
    deliverable: "A reviewed PR closing ojfbot/LocalHelp#154 (trust build slice AU-5)."
    entrance: "AU-4b merged."
    success: "After a restore that loses authority records, the authority service admits nothing and reserves no run until the owner re-signs the charter. Test: snapshot, spend the last run and end the grant, restore, then reserve → refused."
    check: "pnpm --fail-if-no-match --filter @localhelp/authority build && pnpm --fail-if-no-match --filter @localhelp/authority exec vitest run AU-5.test"
    autonomy: gate-0
    claimable_by: human_only
    kind: l
    repo: LocalHelp
    status: queued
    depends_on: "rm:rm-l2-ojfbot#S66"
  - id: S74
    phase: PH9
    title: "FR-4 — FleetRunner rollback guard"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 30
    moves_to: 30
    deliverable: "A reviewed PR closing ojfbot/core#697 (trust build slice FR-4)."
    entrance: "FR-1 merged."
    success: "FleetRunner remembers the newest authority sequence it has seen and refuses to admit or claim against an authority service that has gone back to older data."
    check: "pnpm vitest run --dir packages/fleet-runner FR-4.test"
    autonomy: gate-0
    claimable_by: human_only
    kind: m
    repo: core
    status: queued
    depends_on: "rm:rm-l2-ojfbot#S71"
  - id: S75
    phase: PH9
    title: "HD-3 — Rollback guard for registration records"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 30
    moves_to: 30
    deliverable: "A reviewed PR closing ojfbot/LocalHelp#155 (trust build slice HD-3)."
    entrance: "HD-1a merged."
    success: "After a HelpDesk restore that loses newer registration records, receivers do not honor a holder that a newer handover, reclaim or rotation replaced; the owner gets one BLOCKER. Mac memory of the newest sequence is a declared backup, not enforcement."
    check: "pnpm --fail-if-no-match --filter @localhelp/helpdesk build && pnpm --fail-if-no-match --filter @localhelp/helpdesk exec vitest run HD-3.test"
    autonomy: gate-0
    claimable_by: human_only
    kind: m
    repo: LocalHelp
    status: queued
    depends_on: "rm:rm-l2-ojfbot#S59"
  - id: S76
    phase: PH9
    title: "CH-2 — Speed-bump settings for Claude Code and Codex (#667 slice 7)"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 30
    moves_to: 30
    deliverable: "A reviewed PR closing ojfbot/core#698 (trust build slice CH-2)."
    entrance: "RETRO-0 done."
    success: "Settings that slow down risky local actions (declared, installed by the owner at OW-7), with their limits stated. The Codex part is marked unknown if Codex has no equal setting."
    check: "pnpm vitest run CH-2.test"
    autonomy: gate-0
    claimable_by: human_only
    kind: s
    repo: core
    status: queued
    depends_on: "rm:rm-l2-ojfbot#S58"
  - id: S77
    phase: PH9
    title: "RETRO-1 — Layer retro: phase 1 watch-only data, re-check the outside review's assumptions"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 30
    moves_to: 30
    deliverable: "A reviewed PR closing ojfbot/core#699 (trust build slice RETRO-1)."
    entrance: "Every other phase 1 slice closed and running watch-only on staging for at least one week."
    success: "As RETRO-0, plus: the watch-only counts for each enforcer (would-refuse, wrong refusals, unknowns) are summarised with their thresholds for going live. A wrong refusal or an unexplained unknown keeps that enforcer in watch-only. The review packet (OR-PACK) scope is confirmed."
    check: "node scripts/check-trust-phase-proof.mjs --phase PH9"
    autonomy: gate-0
    claimable_by: human_only
    kind: m
    repo: core
    status: queued
    depends_on: "rm:rm-l2-ojfbot#S72"
  - id: S78
    phase: PH10
    title: "OW-8a — (owner-only) Owner: choose the outside security reviewer and the budget"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 30
    moves_to: 30
    deliverable: "Owner step recorded on ojfbot/LocalHelp#157 (trust build slice OW-8a)."
    entrance: "None; must be done before OW-8."
    success: "One outside human reviewer is chosen and booked, with a budget and a private agreement on handling."
    autonomy: gate-0
    claimable_by: human_only
    kind: s
    repo: LocalHelp
    status: queued
  - id: S79
    phase: PH10
    title: "OR-PACK — Prepare the private review packet for the outside reviewer"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 30
    moves_to: 30
    deliverable: "A reviewed PR closing ojfbot/LocalHelp#158 (trust build slice OR-PACK)."
    entrance: "RETRO-1 done."
    success: "A private packet, kept outside Git: scope (phase 1 on staging), how to reach staging, the rulings, the watch-only data, and the known limits (a compromised NAS, one Mac account). Nothing from the private threat notes goes into any repo or issue."
    check: 'test -r "$PRIVATE_REVIEW_DIR/packet.md" && test -r "$PRIVATE_REVIEW_DIR/denylist.txt" && { git grep -n -f "$PRIVATE_REVIEW_DIR/denylist.txt"; test $? -eq 1; }'
    autonomy: gate-0
    claimable_by: human_only
    kind: s
    repo: LocalHelp
    status: queued
    depends_on: "rm:rm-l2-ojfbot#S77"
  - id: S80
    phase: PH10
    title: "OW-8 — (owner-only) Owner: commission and receive the outside security review of phase 1 on staging"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 30
    moves_to: 30
    deliverable: "Owner step recorded on ojfbot/LocalHelp#159 (trust build slice OW-8)."
    entrance: "OW-8a and OR-PACK done."
    success: "The report is filed privately. No phase 1 slice goes live without it."
    check: 'test -f "$PRIVATE_REVIEW_DIR/report.md"'
    autonomy: gate-0
    claimable_by: human_only
    kind: m
    repo: LocalHelp
    status: queued
    depends_on: "rm:rm-l2-ojfbot#S78"
  - id: S81
    phase: PH10
    title: "OR-TRIAGE — Triage the outside review: each finding becomes a build check or an owner decision"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 30
    moves_to: 30
    deliverable: "A reviewed PR closing ojfbot/LocalHelp#160 (trust build slice OR-TRIAGE)."
    entrance: "OW-8 done."
    success: "Each finding is classed (as in the challenge triage: decision, detail, duplicate, doesn't hold). Details become build checks on the named slices (edited into their issues, without attack detail). Decisions go to the owner through the conductor. A short public summary goes on the phase 1 epic."
    check: 'bash scripts/check-review-triage "$PRIVATE_REVIEW_DIR"'
    autonomy: gate-0
    claimable_by: human_only
    kind: m
    repo: LocalHelp
    status: queued
    depends_on: "rm:rm-l2-ojfbot#S80"
  - id: S82
    phase: PH10
    title: "P1-GL-LH — Switch the LocalHelp enforcers from watch-only to enforcing (one owner tap each)"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 30
    moves_to: 30
    deliverable: "A reviewed PR closing ojfbot/LocalHelp#161 (trust build slice P1-GL-LH)."
    entrance: "OR-TRIAGE done, and every build check it added to a LocalHelp phase 1 slice is merged."
    success: "For the token issuer, the listener and wake, the authority service's refusals, and HelpDesk's phase 1 changes (HD-1a, HD-1b, HD-3, which stay switched off in production until now): the watch-only data clears RETRO-1's thresholds, then each is switched to enforcing at the go-live install level with one owner tap. A breach after the switch rolls that enforcer back to watch-only."
    check: "pnpm --fail-if-no-match --filter @localhelp/authority build && pnpm --fail-if-no-match --filter @localhelp/authority exec vitest run AU-mode.test && pnpm --fail-if-no-match --filter @localhelp/token-issuer build && pnpm --fail-if-no-match --filter @localhelp/token-issuer exec vitest run TI-mode.test && pnpm --fail-if-no-match --filter @localhelp/helpdesk-device build && pnpm --fail-if-no-match --filter @localhelp/helpdesk-device exec vitest run HD-2-mode.test && pnpm --fail-if-no-match --filter @localhelp/helpdesk build && pnpm --fail-if-no-match --filter @localhelp/helpdesk exec vitest run HD-1-mode.test"
    autonomy: gate-0
    claimable_by: human_only
    kind: m
    repo: LocalHelp
    status: queued
    depends_on: "rm:rm-l2-ojfbot#S81"
  - id: S83
    phase: PH10
    title: "P1-GL-FR — Switch FleetRunner's grant check and rollback guard from watch-only to enforcing (one owner tap)"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 30
    moves_to: 30
    deliverable: "A reviewed PR closing ojfbot/core#700 (trust build slice P1-GL-FR)."
    entrance: "OR-TRIAGE done, and its build checks for FR-1 and FR-4 merged."
    success: "As P1-GL-LH, for FleetRunner."
    check: "pnpm vitest run --dir packages/fleet-runner FR-mode.test"
    autonomy: gate-0
    claimable_by: human_only
    kind: s
    repo: core
    status: queued
    depends_on: "rm:rm-l2-ojfbot#S81"
  - id: S84
    phase: PH10
    title: "OW-7 — (owner-only) Owner: install the speed-bump settings on both Macs"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 30
    moves_to: 30
    deliverable: "Owner step recorded on ojfbot/LocalHelp#156 (trust build slice OW-7)."
    entrance: "CH-2 merged and OR-TRIAGE done: nothing from phase 1 goes live before the outside review."
    success: "The owner installs CH-2's settings on both Macs."
    check: "(cd ../core && pnpm vitest run CH-2-installed.test)"
    autonomy: gate-0
    claimable_by: human_only
    kind: s
    repo: LocalHelp
    status: queued
    depends_on: "rm:rm-l2-ojfbot#S76"
  - id: S85
    phase: PH10
    title: "RETRO-2 — Layer retro: enforcement is live, re-check phase 2 assumptions"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 30
    moves_to: 30
    deliverable: "A reviewed PR closing ojfbot/core#701 (trust build slice RETRO-2)."
    entrance: "P1-GL-LH and P1-GL-FR done."
    success: "As RETRO-0, for phase 2. Includes a check that #668's sequencing rule still holds (the ask-first gate switches on only with signed approvals, which exist since AU-1)."
    check: "node scripts/check-trust-phase-proof.mjs --phase PH10"
    autonomy: gate-0
    claimable_by: human_only
    kind: s
    repo: core
    status: queued
    depends_on: "rm:rm-l2-ojfbot#S82"
  - id: S86
    phase: PH11
    title: "DA-1a — Data layer: add-only store with signed receipts and a hash-chained journal"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 30
    moves_to: 30
    deliverable: "A reviewed PR closing ojfbot/LocalHelp#162 (trust build slice DA-1a)."
    entrance: "RETRO-2 done."
    success: "A new package `packages/data-layer` on staging, under its own account and key. It only adds: an edit or delete is refused. Each write gets a signed receipt; the journal is hash-chained; it serves a read-only status. It is a same-host copy, never the independent witness."
    check: "pnpm --fail-if-no-match --filter @localhelp/data-layer build && pnpm --fail-if-no-match --filter @localhelp/data-layer exec vitest run DA-1a.test"
    autonomy: gate-0
    claimable_by: human_only
    kind: l
    repo: LocalHelp
    status: queued
    depends_on: "rm:rm-l2-ojfbot#S85"
  - id: S87
    phase: PH11
    title: "CK-1a — Checker skeleton: read-only, own account and key, signed findings only"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 30
    moves_to: 30
    deliverable: "A reviewed PR closing ojfbot/LocalHelp#168 (trust build slice CK-1a)."
    entrance: "RETRO-2 done."
    success: "A new package `packages/checker` on staging. It reads only; it writes only its own signed findings; it accepts no writes from a Mac; it allows or blocks nothing. It lints that nothing on a Mac is credited as enforcement. It serves a read-only status."
    check: "pnpm --fail-if-no-match --filter @localhelp/checker build && pnpm --fail-if-no-match --filter @localhelp/checker exec vitest run CK-1a.test"
    autonomy: gate-0
    claimable_by: human_only
    kind: m
    repo: LocalHelp
    status: queued
    depends_on: "rm:rm-l2-ojfbot#S85"
  - id: S88
    phase: PH11
    title: "P2-INST — Install the data layer and the checker at the go-live level (one owner tap)"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 30
    moves_to: 30
    deliverable: "A reviewed PR closing ojfbot/LocalHelp#205 (trust build slice P2-INST)."
    entrance: "DA-1a and CK-1a merged; OW-SVC done."
    success: "The data layer and the checker are installed at the go-live level under their own owner-made accounts, with one owner tap. The checker stays read-only and reports only; nothing it finds blocks anything."
    check: "pnpm --fail-if-no-match --filter @localhelp/data-layer build && pnpm --fail-if-no-match --filter @localhelp/data-layer exec vitest run DA-golive.test && pnpm --fail-if-no-match --filter @localhelp/checker build && pnpm --fail-if-no-match --filter @localhelp/checker exec vitest run CK-golive.test"
    autonomy: gate-0
    claimable_by: human_only
    kind: m
    repo: LocalHelp
    status: queued
    depends_on: "rm:rm-l2-ojfbot#S86"
  - id: S89
    phase: PH11
    title: "OW-BK-DA — (owner-only) Owner: add the data-layer store to the NAS backup (separate reviewed change)"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 30
    moves_to: 30
    deliverable: "Owner step recorded on ojfbot/LocalHelp#163 (trust build slice OW-BK-DA)."
    entrance: "P2-INST done (the go-live data layer exists)."
    success: "The data-layer store is in the NAS backup through a separately reviewed change applied by the owner."
    check: "the reviewed change's own restore test (named in that PR)"
    autonomy: gate-0
    claimable_by: human_only
    kind: m
    repo: LocalHelp
    status: queued
    depends_on: "rm:rm-l2-ojfbot#S88"
  - id: S90
    phase: PH11
    title: "CH-7 — Hook logs: identifiers only, numbered, with an end-of-run count, copied to the data layer"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 30
    moves_to: 30
    deliverable: "A reviewed PR closing ojfbot/core#702 (trust build slice CH-7)."
    entrance: "DA-1a on staging."
    success: "Hook logs carry identifiers only, are numbered, end each run with a count, and are copied to the data layer. They stay private and claimed."
    check: "pnpm vitest run CH-7.test"
    autonomy: gate-0
    claimable_by: human_only
    kind: m
    repo: core
    status: queued
    depends_on: "rm:rm-l2-ojfbot#S86"
  - id: S91
    phase: PH11
    title: "HD-4a — HelpDesk: stored request signatures with full inputs, and hash-chained events"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 30
    moves_to: 30
    deliverable: "A reviewed PR closing ojfbot/LocalHelp#164 (trust build slice HD-4a)."
    entrance: "RETRO-2 done."
    success: "Each stored request signature keeps its full signed inputs (method, exact target, time, nonce, body digest), so a checker can re-verify it. The `events` table is hash-chained."
    check: "pnpm --fail-if-no-match --filter @localhelp/helpdesk build && pnpm --fail-if-no-match --filter @localhelp/helpdesk exec vitest run HD-4a.test"
    autonomy: gate-0
    claimable_by: human_only
    kind: l
    repo: LocalHelp
    status: queued
    depends_on: "rm:rm-l2-ojfbot#S85"
  - id: S92
    phase: PH11
    title: "HD-4b — HelpDesk: parent links on TASK and RESULT, journaled listener grants, verdict split from posting"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 30
    moves_to: 30
    deliverable: "A reviewed PR closing ojfbot/LocalHelp#165 (trust build slice HD-4b)."
    entrance: "HD-4a merged."
    success: "TASK and RESULT carry the parent ID and digest. Listener grants are journaled. A RESULT is split into the verdict (claimed) and the posting (observed), so a wake PASS is claimed."
    check: "pnpm --fail-if-no-match --filter @localhelp/helpdesk build && pnpm --fail-if-no-match --filter @localhelp/helpdesk exec vitest run HD-4b.test"
    autonomy: gate-0
    claimable_by: human_only
    kind: m
    repo: LocalHelp
    status: queued
    depends_on: "rm:rm-l2-ojfbot#S91"
  - id: S93
    phase: PH11
    title: "FR-2 — FleetRunner chain fields: admitter, output digest, attempt ID"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 30
    moves_to: 30
    deliverable: "A reviewed PR closing ojfbot/core#703 (trust build slice FR-2)."
    entrance: "RETRO-2 done."
    success: "Each job names who admitted it and its parent by ID and digest (the grant check or TASK that caused it), each attempt has its own ID, and each output carries a digest. FleetRunner's journal is hash-chained, so editing one row breaks the chain. Worker output stays claimed."
    check: "pnpm vitest run --dir packages/fleet-runner FR-2.test"
    autonomy: gate-0
    claimable_by: human_only
    kind: m
    repo: core
    status: queued
    depends_on: "rm:rm-l2-ojfbot#S85"
  - id: S94
    phase: PH11
    title: "AU-W — Authority journal sends its fingerprint on every append or once a minute"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 30
    moves_to: 30
    deliverable: "A reviewed PR closing ojfbot/LocalHelp#166 (trust build slice AU-W)."
    entrance: "DA-1a on staging."
    success: "The authority service sends its latest journal fingerprint on every append or at least once a minute to the device client's copies and to the data layer."
    check: "pnpm --fail-if-no-match --filter @localhelp/authority build && pnpm --fail-if-no-match --filter @localhelp/authority exec vitest run AU-W.test"
    autonomy: gate-0
    claimable_by: human_only
    kind: s
    repo: LocalHelp
    status: queued
    depends_on: "rm:rm-l2-ojfbot#S86"
  - id: S95
    phase: PH11
    title: "FR-W — FleetRunner journal sends its fingerprint on every append or once a minute"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 30
    moves_to: 30
    deliverable: "A reviewed PR closing ojfbot/core#704 (trust build slice FR-W)."
    entrance: "DA-1a on staging; FR-2 merged."
    success: "As AU-W, for FleetRunner's journal."
    check: "pnpm vitest run --dir packages/fleet-runner FR-W.test"
    autonomy: gate-0
    claimable_by: human_only
    kind: s
    repo: core
    status: queued
    depends_on: "rm:rm-l2-ojfbot#S86"
  - id: S96
    phase: PH11
    title: "DA-W — Data layer journal sends its fingerprint on every append or once a minute"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 30
    moves_to: 30
    deliverable: "A reviewed PR closing ojfbot/LocalHelp#201 (trust build slice DA-W)."
    entrance: "DA-1a merged."
    success: "As AU-W, for the data layer's own journal: its latest fingerprint goes to the device client's copies on each Mac."
    check: "pnpm --fail-if-no-match --filter @localhelp/data-layer build && pnpm --fail-if-no-match --filter @localhelp/data-layer exec vitest run DA-W.test"
    autonomy: gate-0
    claimable_by: human_only
    kind: s
    repo: LocalHelp
    status: queued
    depends_on: "rm:rm-l2-ojfbot#S86"
  - id: S97
    phase: PH11
    title: "HD-5 — HelpDesk sends fingerprints, and the device client keeps witness copies on each Mac"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 30
    moves_to: 30
    deliverable: "A reviewed PR closing ojfbot/LocalHelp#167 (trust build slice HD-5)."
    entrance: "HD-4a merged; DA-1a on staging."
    success: "HelpDesk sends its fingerprint like AU-W. The device client on each Mac keeps copies of every journal's fingerprints (authority service, HelpDesk, FleetRunner, data layer)."
    check: "pnpm --fail-if-no-match --filter @localhelp/helpdesk build && pnpm --fail-if-no-match --filter @localhelp/helpdesk exec vitest run HD-5.test && pnpm --fail-if-no-match --filter @localhelp/helpdesk-device build && pnpm --fail-if-no-match --filter @localhelp/helpdesk-device exec vitest run HD-5.test"
    autonomy: gate-0
    claimable_by: human_only
    kind: m
    repo: LocalHelp
    status: queued
    depends_on: "rm:rm-l2-ojfbot#S91"
  - id: S98
    phase: PH11
    title: "OW-CK — (owner-only) Owner: give the checker a read-only GitHub credential and its settings-event source"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 30
    moves_to: 30
    deliverable: "Owner step recorded on ojfbot/LocalHelp#202 (trust build slice OW-CK)."
    entrance: "P2-INST done (the go-live checker exists)."
    success: "The go-live checker gets a read-only GitHub credential (no write anywhere) and the settings-event source CK-4 needs (security log access or a webhook), set up by the owner."
    check: "pnpm --fail-if-no-match --filter @localhelp/checker build && pnpm --fail-if-no-match --filter @localhelp/checker exec vitest run CK-credential.test"
    autonomy: gate-0
    claimable_by: human_only
    kind: m
    repo: LocalHelp
    status: queued
    depends_on: "rm:rm-l2-ojfbot#S88"
  - id: S99
    phase: PH11
    title: "CK-1b — Linker: rebuild one staging action from raw records, with a status per link"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 30
    moves_to: 30
    deliverable: "A reviewed PR closing ojfbot/LocalHelp#169 (trust build slice CK-1b)."
    entrance: "CK-1a, HD-1a, HD-4b and FR-2 merged."
    success: "The checker rebuilds one staging action through the authority journal, HelpDesk and FleetRunner, with one of #663's statuses per link. A rebuild passes only if every link to the owner's record is verified; a fixture with every link claimed fails. Ask-first is reported only."
    check: "pnpm --fail-if-no-match --filter @localhelp/checker build && pnpm --fail-if-no-match --filter @localhelp/checker exec vitest run CK-1b.test"
    autonomy: gate-0
    claimable_by: human_only
    kind: l
    repo: LocalHelp
    status: queued
    depends_on: "rm:rm-l2-ojfbot#S87"
  - id: S100
    phase: PH11
    title: "CK-2 — Scope check after the fact"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 30
    moves_to: 30
    deliverable: "A reviewed PR closing ojfbot/LocalHelp#170 (trust build slice CK-2)."
    entrance: "CK-1b merged."
    success: "An out-of-scope result is caught after the fact from records the agent can't write. A gap or a self-report-only effect counts as unknown. It also sweeps agent work that did not appear under the Mac's App."
    check: "pnpm --fail-if-no-match --filter @localhelp/checker build && pnpm --fail-if-no-match --filter @localhelp/checker exec vitest run CK-2.test"
    autonomy: gate-0
    claimable_by: human_only
    kind: m
    repo: LocalHelp
    status: queued
    depends_on: "rm:rm-l2-ojfbot#S99"
  - id: S101
    phase: PH11
    title: "CK-5 — Compare witness copies and report which witnesses are independent"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 30
    moves_to: 30
    deliverable: "A reviewed PR closing ojfbot/LocalHelp#171 (trust build slice CK-5)."
    entrance: "HD-5, AU-W, FR-W, DA-W and CK-1a merged."
    success: "The checker compares each journal with its witness copies, reports truncation inside the window and a same-host rewrite of two journals, and says which witnesses are independent (only a copy held off the host counts)."
    check: "pnpm --fail-if-no-match --filter @localhelp/checker build && pnpm --fail-if-no-match --filter @localhelp/checker exec vitest run CK-5.test"
    autonomy: gate-0
    claimable_by: human_only
    kind: m
    repo: LocalHelp
    status: queued
    depends_on: "rm:rm-l2-ojfbot#S97"
  - id: S102
    phase: PH11
    title: "DLG-1 — DailyLogger publish door record"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 30
    moves_to: 30
    deliverable: "A reviewed PR closing ojfbot/daily-logger#595 (trust build slice DLG-1)."
    entrance: "RETRO-2 done."
    success: "Every publish writes a door record: what was published, when, by which writer, and its digest."
    check: "pnpm vitest run DLG-1.test"
    autonomy: gate-0
    claimable_by: human_only
    kind: s
    repo: daily-logger
    status: queued
    depends_on: "rm:rm-l2-ojfbot#S85"
  - id: S103
    phase: PH11
    title: "AU-6 — Ask-first gate with a fixed prediction at the spend"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 30
    moves_to: 30
    deliverable: "A reviewed PR closing ojfbot/LocalHelp#172 (trust build slice AU-6)."
    entrance: "RETRO-2 done (AU-1c and AU-2a exist)."
    success: "An ask-first action needs an approval that is verified by a named procedure, with its predicted impact fixed in the approval, and clean links; anything claimed, inferred, unknown, unchecked or disputed stops it. Go-live approvals for DailyLogger publishing merges and the standing exception for articles live here."
    check: "pnpm --fail-if-no-match --filter @localhelp/authority build && pnpm --fail-if-no-match --filter @localhelp/authority exec vitest run AU-6.test"
    autonomy: gate-0
    claimable_by: human_only
    kind: l
    repo: LocalHelp
    status: queued
    depends_on: "rm:rm-l2-ojfbot#S85"
  - id: S104
    phase: PH11
    title: "TI-4 — Gate App posts the merge-proof check only on a verified, unspent approval at that head"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 30
    moves_to: 30
    deliverable: "A reviewed PR closing ojfbot/LocalHelp#173 (trust build slice TI-4)."
    entrance: "AU-6 and TI-1b merged."
    success: "The check-only gate App, with its key in the issuer, posts a required check on a PR only when the authority service confirms a verified, unspent approval for that exact head. Covers go-live merges, DailyLogger publishing merges (with the standing exception) and high-risk PRs. It also ships `scripts/check-rulesets`, a read-only check the owner runs after OW-5a and OW-5b."
    check: "pnpm --fail-if-no-match --filter @localhelp/token-issuer build && pnpm --fail-if-no-match --filter @localhelp/token-issuer exec vitest run TI-4.test"
    autonomy: gate-0
    claimable_by: human_only
    kind: l
    repo: LocalHelp
    status: queued
    depends_on: "rm:rm-l2-ojfbot#S103"
  - id: S105
    phase: PH11
    title: "DLG-5 — Publishing merges need the merge proof or the written standing exception"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 30
    moves_to: 30
    deliverable: "A reviewed PR closing ojfbot/daily-logger#596 (trust build slice DLG-5)."
    entrance: "TI-4 merged."
    success: "A merge that publishes needs TI-4's check, unless it is a daily article inside the standing exception's exact scope."
    check: "pnpm vitest run DLG-5.test"
    autonomy: gate-0
    claimable_by: human_only
    kind: m
    repo: daily-logger
    status: queued
    depends_on: "rm:rm-l2-ojfbot#S104"
  - id: S106
    phase: PH11
    title: "OW-4 — (owner-only) Owner: approve the daily-article standing exception once, as written"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 30
    moves_to: 30
    deliverable: "Owner step recorded on ojfbot/LocalHelp#174 (trust build slice OW-4)."
    entrance: "AU-6 on staging."
    success: "The standing exception is signed once in the charter with its exact scope."
    check: "pnpm --fail-if-no-match --filter @localhelp/authority build && pnpm --fail-if-no-match --filter @localhelp/authority exec vitest run AU-6-exception.test"
    autonomy: gate-0
    claimable_by: human_only
    kind: s
    repo: LocalHelp
    status: queued
    depends_on: "rm:rm-l2-ojfbot#S103"
  - id: S107
    phase: PH11
    title: "P2-GL — Switch the ask-first gate and the merge proof from watch-only to enforcing (one owner tap each)"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 30
    moves_to: 30
    deliverable: "A reviewed PR closing ojfbot/LocalHelp#203 (trust build slice P2-GL)."
    entrance: "AU-6, TI-4 and OW-4 done, with at least one week of watch-only data."
    success: "The ask-first gate (AU-6) and the gate App's merge proof (TI-4) clear their numeric thresholds in watch-only (wrong stops, unknowns), then each is switched to enforcing at the go-live install level with one owner tap. A breach after the switch rolls it back to watch-only in one step."
    check: "pnpm --fail-if-no-match --filter @localhelp/authority build && pnpm --fail-if-no-match --filter @localhelp/authority exec vitest run AU-6-mode.test && pnpm --fail-if-no-match --filter @localhelp/token-issuer build && pnpm --fail-if-no-match --filter @localhelp/token-issuer exec vitest run TI-4-mode.test"
    autonomy: gate-0
    claimable_by: human_only
    kind: m
    repo: LocalHelp
    status: queued
    depends_on: "rm:rm-l2-ojfbot#S103"
  - id: S108
    phase: PH11
    title: "OW-5a — (owner-only) Owner: rulesets that require the merge-proof check, and no direct push to main"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 30
    moves_to: 30
    deliverable: "Owner step recorded on ojfbot/LocalHelp#175 (trust build slice OW-5a)."
    entrance: "P2-GL done (the merge proof is enforcing) and DLG-5 merged."
    success: "Rulesets make the merge-proof check required on go-live, publishing and high-risk merges where ruled, and no identity on the Macs can bypass it or push to main."
    check: "bash scripts/check-rulesets"
    autonomy: gate-0
    claimable_by: human_only
    kind: m
    repo: LocalHelp
    status: queued
    depends_on: "rm:rm-l2-ojfbot#S107"
  - id: S109
    phase: PH11
    title: "CK-3 — Critical-violation alarms through HelpDesk's alert route"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 30
    moves_to: 30
    deliverable: "A reviewed PR closing ojfbot/LocalHelp#176 (trust build slice CK-3)."
    entrance: "CK-1b merged."
    success: "A live critical violation alerts the owner through HelpDesk's alert route and holds growth until closed. Agent-supplied content is claimed; support text changing never changes a verdict."
    check: "pnpm --fail-if-no-match --filter @localhelp/checker build && pnpm --fail-if-no-match --filter @localhelp/checker exec vitest run CK-3.test"
    autonomy: gate-0
    claimable_by: human_only
    kind: m
    repo: LocalHelp
    status: queued
    depends_on: "rm:rm-l2-ojfbot#S99"
  - id: S110
    phase: PH11
    title: "CK-4 — Settings watcher: every settings change reaches the phone within the deadline"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 30
    moves_to: 30
    deliverable: "A reviewed PR closing ojfbot/LocalHelp#177 (trust build slice CK-4)."
    entrance: "CK-1a merged."
    success: "Settings changes come from an event source (security log or webhook), not a state poll; each reaches the owner within 15 minutes, on its own alert budget outside the general cap; a change reverted between two polls still alerts."
    check: "pnpm --fail-if-no-match --filter @localhelp/checker build && pnpm --fail-if-no-match --filter @localhelp/checker exec vitest run CK-4.test"
    autonomy: gate-0
    claimable_by: human_only
    kind: m
    repo: LocalHelp
    status: queued
    depends_on: "rm:rm-l2-ojfbot#S87"
  - id: S111
    phase: PH11
    title: "RETRO-3 — Layer retro: evidence is in, re-check phase 3 assumptions"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 30
    moves_to: 30
    deliverable: "A reviewed PR closing ojfbot/core#705 (trust build slice RETRO-3)."
    entrance: "Every other phase 2 slice closed."
    success: "As RETRO-0, for phase 3. Confirms P2-GL switched the ask-first gate and merge proof to enforcing, or records why they stay watch-only."
    check: "node scripts/check-trust-phase-proof.mjs --phase PH11"
    autonomy: gate-0
    claimable_by: human_only
    kind: s
    repo: core
    status: queued
    depends_on: "rm:rm-l2-ojfbot#S89"
  - id: S112
    phase: PH12
    title: "HD-6 — Wake stop-now: abort and check a running review on pause or revoke"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 30
    moves_to: 30
    deliverable: "A reviewed PR closing ojfbot/LocalHelp#178 (trust build slice HD-6)."
    entrance: "RETRO-3 done."
    success: "A stop ends a running wake review now. “Stopped” needs a process check that succeeds and finds no member; a failed listing is unknown. The abort is checked right before each outside call, and nothing spawns on an aborted signal. A found marker counts only on a comment by this Mac's App whose body hash matches."
    check: "pnpm --fail-if-no-match --filter @localhelp/helpdesk-device build && pnpm --fail-if-no-match --filter @localhelp/helpdesk-device exec vitest run HD-6.test"
    autonomy: gate-0
    claimable_by: human_only
    kind: l
    repo: LocalHelp
    status: queued
    depends_on: "rm:rm-l2-ojfbot#S111"
  - id: S113
    phase: PH12
    title: "HD-7a — Stop verdict record and routing: “not complete” until every item is proven"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 30
    moves_to: 30
    deliverable: "A reviewed PR closing ojfbot/LocalHelp#179 (trust build slice HD-7a)."
    entrance: "RETRO-3 done."
    success: "Each stop yields one verdict list with a #663 status per item; it is “not complete” while any item is unknown or unchecked, with one BLOCKER; “not landed” is inferred only after the writer is gone and both read-backs are done; a late sighting reopens the BLOCKER."
    check: "pnpm --fail-if-no-match --filter @localhelp/helpdesk build && pnpm --fail-if-no-match --filter @localhelp/helpdesk exec vitest run HD-7a.test"
    autonomy: gate-0
    claimable_by: human_only
    kind: m
    repo: LocalHelp
    status: queued
    depends_on: "rm:rm-l2-ojfbot#S111"
  - id: S114
    phase: PH12
    title: "HD-7b — HelpDesk stop support: look-up without posting, saved answers dropped, registered-sessions switch"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 30
    moves_to: 30
    deliverable: "A reviewed PR closing ojfbot/LocalHelp#180 (trust build slice HD-7b)."
    entrance: "HD-7a merged."
    success: "A `command_id` look-up that does not post; saved answers dropped on stop; a revoked session's posts can't land once the registered-sessions switch is on."
    check: "pnpm --fail-if-no-match --filter @localhelp/helpdesk build && pnpm --fail-if-no-match --filter @localhelp/helpdesk exec vitest run HD-7b.test"
    autonomy: gate-0
    claimable_by: human_only
    kind: m
    repo: LocalHelp
    status: queued
    depends_on: "rm:rm-l2-ojfbot#S113"
  - id: S115
    phase: PH12
    title: "AU-9 — Ending and cascade: ending a record ends everything below it"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 30
    moves_to: 30
    deliverable: "A reviewed PR closing ojfbot/LocalHelp#181 (trust build slice AU-9)."
    entrance: "RETRO-3 done."
    success: "Ending a record ends everything below it: no new run starts and new reservations are refused; fenced late writes are refused; other effects get a stop verdict. A normal handover leaves children running to expiry."
    check: "pnpm --fail-if-no-match --filter @localhelp/authority build && pnpm --fail-if-no-match --filter @localhelp/authority exec vitest run AU-9.test"
    autonomy: gate-0
    claimable_by: human_only
    kind: l
    repo: LocalHelp
    status: queued
    depends_on: "rm:rm-l2-ojfbot#S111"
  - id: S116
    phase: PH12
    title: "FR-3 — FleetRunner “stop attempt” transition that voids the fence"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 30
    moves_to: 30
    deliverable: "A reviewed PR closing ojfbot/core#706 (trust build slice FR-3)."
    entrance: "RETRO-3 done."
    success: "A “stop attempt” event voids the attempt's fence, so its renewal and completion are refused; S6 reports “refused at fence” only once that event exists."
    check: "pnpm vitest run --dir packages/fleet-runner FR-3.test"
    autonomy: gate-0
    claimable_by: human_only
    kind: m
    repo: core
    status: queued
    depends_on: "rm:rm-l2-ojfbot#S111"
  - id: S117
    phase: PH12
    title: "TI-3 — Per-Mac cut at the issuer, with the cut runbook"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 30
    moves_to: 30
    deliverable: "A reviewed PR closing ojfbot/LocalHelp#182 (trust build slice TI-3)."
    entrance: "RETRO-3 done."
    success: "Cutting one Mac: the issuer stops minting for it, and a runbook covers suspending its App, revoking its terminal token and ending its web sessions (owner steps). Other Macs keep working."
    check: "pnpm --fail-if-no-match --filter @localhelp/token-issuer build && pnpm --fail-if-no-match --filter @localhelp/token-issuer exec vitest run TI-3.test"
    autonomy: gate-0
    claimable_by: human_only
    kind: m
    repo: LocalHelp
    status: queued
    depends_on: "rm:rm-l2-ojfbot#S111"
  - id: S118
    phase: PH12
    title: "HD-7c — Cancel queued GitHub effects with an issuer token, and read them back"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 30
    moves_to: 30
    deliverable: "A reviewed PR closing ojfbot/LocalHelp#183 (trust build slice HD-7c)."
    entrance: "HD-7a and TI-3 merged."
    success: "A stop turns auto-merge off (including on publishing DailyLogger PRs), cancels Actions runs where the Apps have Actions write, and reads each back as cancelled, using a token from the issuer."
    check: "pnpm --fail-if-no-match --filter @localhelp/helpdesk build && pnpm --fail-if-no-match --filter @localhelp/helpdesk exec vitest run HD-7c.test"
    autonomy: gate-0
    claimable_by: human_only
    kind: m
    repo: LocalHelp
    status: queued
    depends_on: "rm:rm-l2-ojfbot#S113"
  - id: S119
    phase: PH12
    title: "DLG-4 — Hosted writers in the stop inventory: stop automation for the hosted workflows, and the owner's secret runbook"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 30
    moves_to: 30
    deliverable: "A reviewed PR closing ojfbot/daily-logger#597 (trust build slice DLG-4)."
    entrance: "RETRO-3 done."
    success: "The hosted writers (daily-blog and cleaner pushes, PR creation, auto-merge with a stored secret) are listed in the stop inventory, each with its own cut. The stop path can disable a hosted workflow through an issuer token, as ruled for stops (#678 S7, S8). Rotating or narrowing a stored secret is written in the runbook as an owner step and is never done by an agent (OW-3)."
    check: "pnpm vitest run DLG-4.test"
    autonomy: gate-0
    claimable_by: human_only
    kind: s
    repo: daily-logger
    status: queued
    depends_on: "rm:rm-l2-ojfbot#S111"
  - id: S120
    phase: PH12
    title: "OW-3 — (owner-only) Owner: switch DailyLogger's stored workflow token to an App token or a narrowed token"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 30
    moves_to: 30
    deliverable: "Owner step recorded on ojfbot/LocalHelp#184 (trust build slice OW-3)."
    entrance: "DLG-4 merged."
    success: "The stored workflow secret is replaced with an App token or a narrowed token; its past and remaining actions are listed as claimed."
    check: "(cd ../daily-logger && pnpm vitest run DLG-4-token.test)"
    autonomy: gate-0
    claimable_by: human_only
    kind: m
    repo: LocalHelp
    status: queued
    depends_on: "rm:rm-l2-ojfbot#S119"
  - id: S121
    phase: PH12
    title: "AU-10 — Child seats and takeover records"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 30
    moves_to: 30
    deliverable: "A reviewed PR closing ojfbot/LocalHelp#185 (trust build slice AU-10)."
    entrance: "RETRO-3 done."
    success: "Child-seat records named only by owner-named seats, one level down, checkable to the owner's passkey. Takeover records after 12 hours of registry lapse. Nothing a child seat grants is honored before re-delegation is checkable."
    check: "pnpm --fail-if-no-match --filter @localhelp/authority build && pnpm --fail-if-no-match --filter @localhelp/authority exec vitest run AU-10.test"
    autonomy: gate-0
    claimable_by: human_only
    kind: l
    repo: LocalHelp
    status: queued
    depends_on: "rm:rm-l2-ojfbot#S111"
  - id: S122
    phase: PH12
    title: "HD-8 — Registry lapse warning at 8 hours, and alert-route rules"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 30
    moves_to: 30
    deliverable: "A reviewed PR closing ojfbot/LocalHelp#186 (trust build slice HD-8)."
    entrance: "AU-10 merged."
    success: "The registry warns at 8 hours without renewal. A session-written BLOCKER rings the owner only from the top seat's holder (asked of the authority service); service-written alerts always ring, including the authority service's own alerts sent through the alert route under its own writer key (lapse warnings, takeovers, check-up reminders); other BLOCKERs climb the tree with a deadline."
    check: "pnpm --fail-if-no-match --filter @localhelp/helpdesk build && pnpm --fail-if-no-match --filter @localhelp/helpdesk exec vitest run HD-8.test"
    autonomy: gate-0
    claimable_by: human_only
    kind: m
    repo: LocalHelp
    status: queued
    depends_on: "rm:rm-l2-ojfbot#S121"
  - id: S123
    phase: PH12
    title: "FR-5 — Work-register baskets (ADR-0110 amendment)"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 30
    moves_to: 30
    deliverable: "A reviewed PR closing ojfbot/core#707 (trust build slice FR-5)."
    entrance: "RETRO-3 done. The owner has picked the parent seat's clash deadline (asked through the conductor when this slice starts)."
    success: "Baskets nest; the nearest basket owns; claims and self-claims in a basket need that seat or its assignee; a claimant's “done” stays claimed until a verification record exists; a clash reaches the nearest shared parent first with a deadline."
    check: "pnpm vitest run --dir packages/fleet-runner FR-5.test"
    autonomy: gate-0
    claimable_by: human_only
    kind: m
    repo: core
    status: queued
    depends_on: "rm:rm-l2-ojfbot#S111"
  - id: S124
    phase: PH12
    title: "AU-7 — Check-up and renewal: reminders at day 80, 87 and 89"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 30
    moves_to: 30
    deliverable: "A reviewed PR closing ojfbot/LocalHelp#187 (trust build slice AU-7)."
    entrance: "RETRO-3 done."
    success: "A deterministic scheduled job sends check-up reminders through HelpDesk's alert route at day 80, 87 and 89, supports chained key renewal and re-signing the top seats; records stay checkable after their key retires normally."
    check: "pnpm --fail-if-no-match --filter @localhelp/authority build && pnpm --fail-if-no-match --filter @localhelp/authority exec vitest run AU-7.test"
    autonomy: gate-0
    claimable_by: human_only
    kind: m
    repo: LocalHelp
    status: queued
    depends_on: "rm:rm-l2-ojfbot#S111"
  - id: S125
    phase: PH12
    title: "AU-8 — Second key, revocations and the lost-phone drill (agent part)"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 30
    moves_to: 30
    deliverable: "A reviewed PR closing ojfbot/LocalHelp#188 (trust build slice AU-8)."
    entrance: "RETRO-3 done."
    success: "Support, proven with test keys and fixtures, for: a backup key added at the NAS and approved by the first key in the same sitting; the three revocation effects of #679 O11 (a record signed after its key's revocation is refused, a record cancelled as stolen is refused, and a lost key can be revoked while work carries on under the other key); “record revoked” withdraws a record while its key stays live; the seat cascade after a lost phone."
    check: "pnpm --fail-if-no-match --filter @localhelp/authority build && pnpm --fail-if-no-match --filter @localhelp/authority exec vitest run AU-8.test"
    autonomy: gate-0
    claimable_by: human_only
    kind: l
    repo: LocalHelp
    status: queued
    depends_on: "rm:rm-l2-ojfbot#S111"
  - id: S126
    phase: PH12
    title: "P3-GL — Switch the phase 3 controls to go-live (one owner tap each)"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 30
    moves_to: 30
    deliverable: "A reviewed PR closing ojfbot/LocalHelp#204 (trust build slice P3-GL)."
    entrance: "HD-6, HD-7a, HD-7b, HD-7c, AU-9, HD-8, AU-10, AU-7, AU-8 and TI-3 merged, with at least one week of watch-only data."
    success: "Each phase 3 control that blocks or changes alerts clears its numeric thresholds in watch-only, then goes live with one owner tap: wake stop-now (HD-6), the registered-sessions switch (HD-7b), queued-effect cancels (HD-7c), ending and cascade (AU-9), the alert-route rule (HD-8), child seats (AU-10), the per-Mac cut at the issuer (TI-3), the hosted-writer stops (DLG-4, used by HD-7c), and the check-up and second-key code (AU-7, AU-8) installed at go-live. A breach rolls that control back in one step."
    check: "pnpm --fail-if-no-match --filter @localhelp/helpdesk-device build && pnpm --fail-if-no-match --filter @localhelp/helpdesk-device exec vitest run HD-6-mode.test && pnpm --fail-if-no-match --filter @localhelp/helpdesk build && pnpm --fail-if-no-match --filter @localhelp/helpdesk exec vitest run HD-7-mode.test && pnpm --fail-if-no-match --filter @localhelp/helpdesk build && pnpm --fail-if-no-match --filter @localhelp/helpdesk exec vitest run HD-8-mode.test && pnpm --fail-if-no-match --filter @localhelp/authority build && pnpm --fail-if-no-match --filter @localhelp/authority exec vitest run P3-mode.test && pnpm --fail-if-no-match --filter @localhelp/token-issuer build && pnpm --fail-if-no-match --filter @localhelp/token-issuer exec vitest run TI-3-mode.test"
    autonomy: gate-0
    claimable_by: human_only
    kind: m
    repo: LocalHelp
    status: queued
    depends_on: "rm:rm-l2-ojfbot#S112"
  - id: S127
    phase: PH12
    title: "OW-K2 — (owner-only) Owner: add the backup key and run the lost-phone drill"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 30
    moves_to: 30
    deliverable: "Owner step recorded on ojfbot/LocalHelp#189 (trust build slice OW-K2)."
    entrance: "P3-GL done (AU-8's code is installed at go-live)."
    success: "The owner adds the backup key at the NAS to the go-live authority service and approves it with the first key in the same sitting, then runs the lost-phone drill on staging with test keys."
    check: "pnpm --fail-if-no-match --filter @localhelp/authority build && pnpm --fail-if-no-match --filter @localhelp/authority exec vitest run AU-8-drill.test"
    autonomy: gate-0
    claimable_by: human_only
    kind: m
    repo: LocalHelp
    status: queued
    depends_on: "rm:rm-l2-ojfbot#S126"
  - id: S128
    phase: PH12
    title: "HD-9 — Wake audience and quote check"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 30
    moves_to: 30
    deliverable: "A reviewed PR closing ojfbot/LocalHelp#190 (trust build slice HD-9)."
    entrance: "RETRO-3 done."
    success: "Text never widens what a receiver may do, and a wake review never publishes what the PR's readers may not see."
    check: "pnpm --fail-if-no-match --filter @localhelp/helpdesk-device build && pnpm --fail-if-no-match --filter @localhelp/helpdesk-device exec vitest run HD-9.test"
    autonomy: gate-0
    claimable_by: human_only
    kind: m
    repo: LocalHelp
    status: queued
    depends_on: "rm:rm-l2-ojfbot#S111"
  - id: S129
    phase: PH12
    title: "CH-6 — Status labels and claim fixes in Core: `/resume` and GitHub actions"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 30
    moves_to: 30
    deliverable: "A reviewed PR closing ojfbot/core#708 (trust build slice CH-6)."
    entrance: "RETRO-3 done."
    success: "`/resume` marks a bead verified only from evidence tied to that bead (closes core#677). Records label GitHub actions with #663 statuses (“observed: App X acted”, “claimed” for the agent behind it), and no GitHub action is acted on as the owner's yes."
    check: "pnpm vitest run CH-6.test"
    autonomy: gate-0
    claimable_by: human_only
    kind: m
    repo: core
    status: queued
    depends_on: "rm:rm-l2-ojfbot#S111"
  - id: S130
    phase: PH12
    title: "DLG-3a — DailyLogger claim-check fix: verdicts depend only on independent records"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 30
    moves_to: 30
    deliverable: "A reviewed PR closing ojfbot/daily-logger#598 (trust build slice DLG-3a)."
    entrance: "RETRO-3 done."
    success: "The claim check's verdict depends only on independent records (daily-logger#593), and it passes the fixture named in #670 second-challenge build check 4."
    check: "pnpm vitest run DLG-3a.test"
    autonomy: gate-0
    claimable_by: human_only
    kind: m
    repo: daily-logger
    status: queued
    depends_on: "rm:rm-l2-ojfbot#S111"
  - id: S131
    phase: PH12
    title: "DLG-3b — DailyLogger comment actuators and status labels"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 30
    moves_to: 30
    deliverable: "A reviewed PR closing ojfbot/daily-logger#601 (trust build slice DLG-3b)."
    entrance: "DLG-3a merged."
    success: "Every GitHub-comment actuator is classed: stop-direction commands may stay routine, and anything that starts, re-enables, merges or publishes needs a yes from outside GitHub. Action-review grants are reclassified as claimed. The `owner-record` class, the outcome stamp and the “explicit owner request” check change, with a fixture each. GitHub actions carry #663 status labels."
    check: "pnpm vitest run DLG-3b.test"
    autonomy: gate-0
    claimable_by: human_only
    kind: m
    repo: daily-logger
    status: queued
    depends_on: "rm:rm-l2-ojfbot#S130"
  - id: S132
    phase: PH12
    title: "P3-GL-FR — Switch FleetRunner's stop transition and baskets to go-live (one owner tap each)"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 30
    moves_to: 30
    deliverable: "A reviewed PR closing ojfbot/core#722 (trust build slice P3-GL-FR)."
    entrance: "FR-3 and FR-5 merged, with at least one week of watch-only data."
    success: "As P3-GL, for FleetRunner: the stop transition that voids a fence (FR-3) and basket claim rules (FR-5)."
    check: "pnpm vitest run --dir packages/fleet-runner FR-3-mode.test && pnpm vitest run --dir packages/fleet-runner FR-5-mode.test"
    autonomy: gate-0
    claimable_by: human_only
    kind: s
    repo: core
    status: queued
    depends_on: "rm:rm-l2-ojfbot#S116"
  - id: S133
    phase: PH12
    title: "RETRO-4 — Layer retro: seats and stops done; close the map's build"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 30
    moves_to: 30
    deliverable: "A reviewed PR closing ojfbot/core#709 (trust build slice RETRO-4)."
    entrance: "Every other phase 3 slice closed."
    success: "As RETRO-0. Also: list every guarantee in #674's table with its final mark, and every open unknown with where it now lives."
    check: "node scripts/check-trust-phase-proof.mjs --phase PH12"
    autonomy: gate-0
    claimable_by: human_only
    kind: s
    repo: core
    status: queued
    depends_on: "rm:rm-l2-ojfbot#S126"
  - id: S134
    phase: PH13
    title: "BD-1 — Accepted changes and spec-to-merge on the board, with a “ready to build” label"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 30
    moves_to: 30
    deliverable: "A reviewed PR closing ojfbot/LocalHelp#191 (trust build slice BD-1)."
    entrance: "None; tests lane runs alongside, one slice at a time."
    success: "Accepted changes and spec-ready-to-merge per repo for the last 4 weeks, with a “no mark” count. A “ready to build” label exists in LocalHelp, Core and DailyLogger."
    check: "pnpm --fail-if-no-match --filter @localhelp/board build && pnpm --fail-if-no-match --filter @localhelp/board exec vitest run BD-1.test"
    autonomy: gate-0
    claimable_by: human_only
    kind: s
    repo: LocalHelp
    status: queued
  - id: S135
    phase: PH13
    title: "BD-2 — Weekly total-spend collector with completeness"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 30
    moves_to: 30
    deliverable: "A reviewed PR closing ojfbot/LocalHelp#192 (trust build slice BD-2)."
    entrance: "BD-1 merged."
    success: "CI minutes, Claude tokens and Codex tokens per week across both Macs, including every factory execution path; a week shows “unknown” when any source is missing."
    check: "pnpm --fail-if-no-match --filter @localhelp/board build && pnpm --fail-if-no-match --filter @localhelp/board exec vitest run BD-2.test"
    autonomy: gate-0
    claimable_by: human_only
    kind: m
    repo: LocalHelp
    status: queued
    depends_on: "rm:rm-l2-ojfbot#S134"
  - id: S136
    phase: PH13
    title: "CH-4 — Regression kind in the defect ledger (ADR-0104 amendment)"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 30
    moves_to: 30
    deliverable: "A reviewed PR closing ojfbot/core#710 (trust build slice CH-4)."
    entrance: "None."
    success: "`defect-file` and the sweep handle `regression` with a cause probe; settling a report as “cause unknown” never removes the growth hold."
    check: "pnpm vitest run CH-4.test"
    autonomy: gate-0
    claimable_by: human_only
    kind: m
    repo: core
    status: queued
  - id: S137
    phase: PH13
    title: "CH-3a — Probe approvals pin the text, the commit and the sandbox profile"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 30
    moves_to: 30
    deliverable: "A reviewed PR closing ojfbot/core#711 (trust build slice CH-3a)."
    entrance: "OW-FID done (real owner approvals exist, after slice 0). Until then, a probe runs on the owner's chat yes, recorded as claimed."
    success: "A probe approval's fingerprint covers the probe text, a commit SHA and the sandbox profile; the sweep runs the probe from a clean checkout at that commit; it reads only declared paths and caps output; its output is claimed. Approve, change a called script, sweep → refused."
    check: "pnpm vitest run CH-3a.test"
    autonomy: gate-0
    claimable_by: human_only
    kind: l
    repo: core
    status: queued
    depends_on: "rm:rm-l2-ojfbot#S52"
  - id: S138
    phase: PH13
    title: "CH-3b — Defect sweep as a fixed FleetRunner job in a sandbox, with the defect lint at merge"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 30
    moves_to: 30
    deliverable: "A reviewed PR closing ojfbot/core#712 (trust build slice CH-3b)."
    entrance: "CH-3a merged; FR-1 merged."
    success: "The sweep runs as a fixed FleetRunner job kind in a declared sandbox; GitHub CI's defect lint blocks an unapproved probe at merge."
    check: "pnpm vitest run CH-3b.test"
    autonomy: gate-0
    claimable_by: human_only
    kind: m
    repo: core
    status: queued
    depends_on: "rm:rm-l2-ojfbot#S137"
  - id: S139
    phase: PH13
    title: "BD-3 — Growth reading: grow, hold or unknown, and the deciding condition"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 30
    moves_to: 30
    deliverable: "A reviewed PR closing ojfbot/LocalHelp#193 (trust build slice BD-3)."
    entrance: "BD-2 and CH-4 merged."
    success: "The board shows grow, hold or unknown and the condition that decided it, including “hold” on an open critical violation."
    check: "pnpm --fail-if-no-match --filter @localhelp/board build && pnpm --fail-if-no-match --filter @localhelp/board exec vitest run BD-3.test"
    autonomy: gate-0
    claimable_by: human_only
    kind: m
    repo: LocalHelp
    status: queued
    depends_on: "rm:rm-l2-ojfbot#S135"
  - id: S140
    phase: PH13
    title: "FR-6a — Model-test job kinds on the Mac workers"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 30
    moves_to: 30
    deliverable: "A reviewed PR closing ojfbot/core#713 (trust build slice FR-6a)."
    entrance: "FR-1 merged."
    success: "Fixed model-test job kinds run on the Mac workers with a running record of writes and network use (or a sandbox that blocks out-of-scope writes); without one, the transient-write check shows unchecked."
    check: "pnpm vitest run --dir packages/fleet-runner FR-6a.test"
    autonomy: gate-0
    claimable_by: human_only
    kind: l
    repo: core
    status: queued
    depends_on: "rm:rm-l2-ojfbot#S71"
  - id: S141
    phase: PH13
    title: "DA-2 — Private model-test set in the data layer"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 30
    moves_to: 30
    deliverable: "A reviewed PR closing ojfbot/LocalHelp#194 (trust build slice DA-2)."
    entrance: "DA-1a merged."
    success: "The private test set lives in the data layer, add-only; a copied answer is detected even without its marker."
    check: "pnpm --fail-if-no-match --filter @localhelp/data-layer build && pnpm --fail-if-no-match --filter @localhelp/data-layer exec vitest run DA-2.test"
    autonomy: gate-0
    claimable_by: human_only
    kind: m
    repo: LocalHelp
    status: queued
    depends_on: "rm:rm-l2-ojfbot#S86"
  - id: S142
    phase: PH13
    title: "FR-6b — Held-out rules, family exclusion and run manifests for model tests"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 30
    moves_to: 30
    deliverable: "A reviewed PR closing ojfbot/core#714 (trust build slice FR-6b)."
    entrance: "FR-6a and DA-2 merged."
    success: "Held-out results never select outcomes; seeded variants respect family exclusion; matching labels are backed by the same manifest; owner confirmations are checkable."
    check: "pnpm vitest run --dir packages/fleet-runner FR-6b.test"
    autonomy: gate-0
    claimable_by: human_only
    kind: l
    repo: core
    status: queued
    depends_on: "rm:rm-l2-ojfbot#S140"
  - id: S143
    phase: PH13
    title: "BD-5 — Score cards and status labels (the three scores kept apart)"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 30
    moves_to: 30
    deliverable: "A reviewed PR closing ojfbot/LocalHelp#195 (trust build slice BD-5)."
    entrance: "FR-6b merged."
    success: "The three scores show apart, with unknown and unchecked never shown as clean, and #663 status labels on GitHub actions."
    check: "pnpm --fail-if-no-match --filter @localhelp/board build && pnpm --fail-if-no-match --filter @localhelp/board exec vitest run BD-5.test"
    autonomy: gate-0
    claimable_by: human_only
    kind: m
    repo: LocalHelp
    status: queued
    depends_on: "rm:rm-l2-ojfbot#S142"
  - id: S144
    phase: PH13
    title: "CH-5a — Guided review: risk lists and matcher, read from the base branch"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 30
    moves_to: 30
    deliverable: "A reviewed PR closing ojfbot/core#715 (trust build slice CH-5a)."
    entrance: "None."
    success: "For any PR the program prints high risk or not with the matched entries, reading the list and fixed areas from the base branch; agent-instruction files are high risk; a PR that edits the list or matcher is high risk."
    check: "pnpm vitest run CH-5a.test"
    autonomy: gate-0
    claimable_by: human_only
    kind: m
    repo: core
    status: queued
  - id: S145
    phase: PH13
    title: "CH-5b — Guided review: fact skeleton with no model"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 30
    moves_to: 30
    deliverable: "A reviewed PR closing ojfbot/core#716 (trust build slice CH-5b)."
    entrance: "CH-5a merged."
    success: "Top-screen facts, evidence, findings and supporting changes are built from the issue, diff, CI and review records at the head commit; the same inputs give byte-identical output; body claims appear only under “author says”; skipped jobs show as unchecked."
    check: "pnpm vitest run CH-5b.test"
    autonomy: gate-0
    claimable_by: human_only
    kind: m
    repo: core
    status: queued
    depends_on: "rm:rm-l2-ojfbot#S144"
  - id: S146
    phase: PH13
    title: "CH-5c — Guided review: explainer and per-link-type link check"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 30
    moves_to: 30
    deliverable: "A reviewed PR closing ojfbot/core#717 (trust build slice CH-5c)."
    entrance: "CH-5b merged."
    success: "A fresh non-authoring session writes chapters 1–4; the checker applies each link type's rule and removes blocked words and any test or coverage claim."
    check: "pnpm vitest run CH-5c.test"
    autonomy: gate-0
    claimable_by: human_only
    kind: m
    repo: core
    status: queued
    depends_on: "rm:rm-l2-ojfbot#S145"
  - id: S147
    phase: PH13
    title: "CH-5d — Guided review: review-input records, reviews independent of the guide"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 30
    moves_to: 30
    deliverable: "A reviewed PR closing ojfbot/core#718 (trust build slice CH-5d)."
    entrance: "CH-5b merged."
    success: "Each review run records its inputs; the builder waits for both reviews; a guide identifier in a review's input fails it."
    check: "pnpm vitest run CH-5d.test"
    autonomy: gate-0
    claimable_by: human_only
    kind: s
    repo: core
    status: queued
    depends_on: "rm:rm-l2-ojfbot#S145"
  - id: S148
    phase: PH13
    title: "CH-5e — Guided review: the quiz gate recomputes the score from the marks"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 30
    moves_to: 30
    deliverable: "A reviewed PR closing ojfbot/core#719 (trust build slice CH-5e)."
    entrance: "CH-5d merged."
    success: "Quiz records hold the questions, answers, marks, grader and head SHA; the merge check recomputes the score and refuses a number-only record; a “merge anyway” note is claimed until it is an approval bound to that head (AU-6 / TI-4), and is refused after a later hold."
    check: "pnpm vitest run CH-5e.test"
    autonomy: gate-0
    claimable_by: human_only
    kind: m
    repo: core
    status: queued
    depends_on: "rm:rm-l2-ojfbot#S147"
  - id: S149
    phase: PH13
    title: "BD-4 — Owner-minutes estimate per accepted change"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 30
    moves_to: 30
    deliverable: "A reviewed PR closing ojfbot/LocalHelp#196 (trust build slice BD-4)."
    entrance: "BD-1 merged."
    success: "Weekly owner minutes ÷ accepted changes, labelled “estimate”."
    check: "pnpm --fail-if-no-match --filter @localhelp/board build && pnpm --fail-if-no-match --filter @localhelp/board exec vitest run BD-4.test"
    autonomy: gate-0
    claimable_by: human_only
    kind: s
    repo: LocalHelp
    status: queued
    depends_on: "rm:rm-l2-ojfbot#S134"
  - id: S150
    phase: PH13
    title: "DLG-2 — Measures block pasted from the feed, written by code"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 30
    moves_to: 30
    deliverable: "A reviewed PR closing ojfbot/daily-logger#599 (trust build slice DLG-2)."
    entrance: "BD-3 merged."
    success: "Each daily log carries the measures block written by code from the feed; DailyLogger never changes a measure; feed equality is defined after legitimate corrections."
    check: "pnpm vitest run DLG-2.test"
    autonomy: gate-0
    claimable_by: human_only
    kind: s
    repo: daily-logger
    status: queued
    depends_on: "rm:rm-l2-ojfbot#S139"
  - id: S151
    phase: PH13
    title: "BD-6 — Guide measures: taught quiz scores and owner minutes, before and after guides"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 30
    moves_to: 30
    deliverable: "A reviewed PR closing ojfbot/LocalHelp#197 (trust build slice BD-6)."
    entrance: "CH-5e and BD-4 merged."
    success: "Taught quiz scores and owner minutes per accepted change, before and after guides, labelled, with taught and cold kept apart."
    check: "pnpm --fail-if-no-match --filter @localhelp/board build && pnpm --fail-if-no-match --filter @localhelp/board exec vitest run BD-6.test"
    autonomy: gate-0
    claimable_by: human_only
    kind: s
    repo: LocalHelp
    status: queued
    depends_on: "rm:rm-l2-ojfbot#S148"
  - id: S152
    phase: PH13
    title: "OW-5b — (owner-only) Owner: make the defect-lint and quiz-gate checks required"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 30
    moves_to: 30
    deliverable: "Owner step recorded on ojfbot/LocalHelp#206 (trust build slice OW-5b)."
    entrance: "CH-3b and CH-5e merged; OW-5a done."
    success: "Rulesets make the defect-lint check (unapproved probes) and the quiz-gate check (high-risk PRs) required where ruled, with no bypass for any identity on the Macs."
    check: "bash scripts/check-rulesets"
    autonomy: gate-0
    claimable_by: human_only
    kind: m
    repo: LocalHelp
    status: queued
    depends_on: "rm:rm-l2-ojfbot#S138"
  - id: S153
    phase: PH13
    title: "RETRO-5 — Tests lane retro: re-check measures and whether any AI judge is being proposed"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 30
    moves_to: 30
    deliverable: "A reviewed PR closing ojfbot/core#720 (trust build slice RETRO-5)."
    entrance: "Every other tests-lane slice closed."
    success: "As RETRO-0. Also: confirm no AI-judge flag gates anything (#671: none gates yet), and list which measures are claimed."
    check: "node scripts/check-trust-phase-proof.mjs --phase PH13"
    autonomy: gate-0
    claimable_by: human_only
    kind: s
    repo: core
    status: queued
    depends_on: "rm:rm-l2-ojfbot#S152"
---

# Roadmap — l2-ojfbot (northstar coverage via the voice relay)

**Route.** `ns:l2-ojfbot#P2` says every app's daily work traces to a measurable property — which
requires every app to *have* one. 8 of 26 itinerary stops are landed; the flow that landed them
(the offsite roadtrip's two-agent Notion relay: CC stages evidence briefs → voice conversation
refines → CC lands) worked but ran as a hand-driven runbook and stalled after leg 1. PH1 turns
that runbook into a repeatable skill pair — the CC half (`/northstar-leg`) owns evidence and
landing; the chat half (`northstar-voice`, re-uploaded to claude.ai) owns the car-friendly voice
conversation, staying above the evidence line. PH2 drives the remaining legs through it, starting
free: the Frame leg is already voice-CONFIRMED and just needs landing (S4), and the registered-but-
missing l1-cv-builder file is a lint ERROR today (S1). Leg slices are `claimable_by: human_only` —
they contain a conversation; the day-runner never grabs them.

## PH1 — Skill-ify the northstar relay

S1 repairs the one broken registry entry. S2 builds the CC-side skill against the leg-1 worked
example. S3 builds the chat-side voice skill against S2's fixed briefing-card contract — canonical
in core, live only after re-upload to claude.ai (the selfco-ingest lesson).

## PH2 — Land the remaining legs

S4 lands the already-confirmed Frame leg immediately (no conversation needed). S5–S9 run legs 2–6
through the skill pair, one voice session each. Leg 3 (S6) is the standing evidence-gate for the
designed-but-unbuilt cluster tier: if the golf cluster genuinely needs `ns:cluster-*` refs, that
gets logged as a schema-evolution iteration — built on evidence, not imagination.

## PH3 — Audit hardening program (2026-07-04)

Tranche 1 of the three-document audit program (`MULTIAGENT-SDLC-AUDIT-2026-07-04.md`,
`AGENTIC-INTEGRATION-PLAN-2026-07-04.md`, `FLEET-COORDINATION-EXTENSIONS-2026-07-04.md`), encoded
on these rails precisely because the audit's own headline finding is that plans in this cluster
rot when they live outside the delivery machinery.

**The delivery oracle.** Every PH3 slice's `success:` is a named check in
`scripts/audit-delivery-check.mjs` — a deterministic verifier (no LLM, no network) with one
predicate per promised artifact, three baseline regression guards protecting what already works
(suggestion identity, CAS claims, the merge-gated odometer), and a staleness gate: `--check`
exits 1 if a baseline truth regresses OR if >14 days pass with undelivered slices and no commit
touching program files. Run it any time to answer "is the audit program actually being
delivered?" with evidence, from zero context. S13 wires it into a weekly cadence so the answer
arrives without anyone remembering to ask.

**Ordering.** S10–S13 are independent and `ready` (S10 is human-only — the OPAV plan file exists
only on the operator's Mac). S14 depends on S13 (the weekly routine surfaces the
shadow-agreement data that will justify promoting the verification stage to blocking); S15
depends on S14 (a `check:` field is only honest once something enforces it at the slice
boundary). Later tranches (I4 golden suites, I5 judge calibration, F2 hooks/GUPP, F3 escalation,
F8 stamps) get their own slices only after tranche 1 is `merged` — six open slices is the
attention budget; the rest of the program waits in the documents, not in the queue.

**Movement-band note.** PH3 slices advance `ns:l2-ojfbot#P2` in a 20→26 band that runs parallel
to the PH1/PH2 legs band (also baselined at 20) — the parent `current:` is hand-asserted and
rollup is shadow (audit finding P5). Treat each band's deltas as honest within itself; the
parent number reconciles when `northstar-rollup.mjs` exists.

## PH5 — Audit tranche 3 (2026-07-08): close the OPAV skill loop, first meta-loop

The [skill observation delivery handoff](../fleet-runner/skill-observation-delivery.md)
records the proposed all-session extension under #307. Its first local qualification
does not dispatch work or satisfy S25. Its later consumer cutover must preserve S23's
OPAV promotion requirements and reconcile S24's existing migration before replacing consumers.
No status, movement, or unattended-dispatch eligibility changes here.

**2026-10-01 placement and succession decision:** `adr:fleet-runner-in-core` places the persistent executor
in core with its own deployment and supersedes the conductor initiative, preserving #307
and its open obligations in `decisions/wayfinder/control-plane-conductor.md`.
S25's existing PR/checks/trace criterion remains narrower
than the fleet-runner contract. Reconcile overlapping scope before dispatch; this note
changes no slice status, success criterion or movement and does not clear runtime or
correspondence gates.

**2026-10-08 maintenance and voice-review requirement:** the existing
[fleet-runner map](../wayfinder/control-plane-conductor.md#maintenance-and-decision-review-through-existing-tools-2026-10-08)
now records morning maintenance, scoped infrastructure and pending-decision review using
daily-logger intake, the shared queue, `/frame-standup`, `/day-run`, cockpit and GitHub.
Initial execution requires item-scoped spoken approval; agent-advised source review must
be satisfied at the actual GitHub revision. Reconcile S25's operating-mode choice with
the actual existing rails and #307's authority/consumption/reach decisions before changing
a schedule or dispatch path. Register bounded deliveries here once their entrances are
resolved; do not add a competing roadmap, queue or automation. S25's current status,
eligibility, criterion and movement remain unchanged; this records a requirement, not
approval of unresolved runtime or grant mechanisms.

**2026-10-08 attributed maintenance calibration extension:** the operator authorized
[the existing fleet-runner map's collection and comparison sequence](../wayfinder/control-plane-conductor.md#maintenance-calibration-and-attributed-decisions-2026-10-08).
High-tier routine runs are intentional candidate-example collection. Record separate
implementer/reviewer agent, provider, model, effort and instruction provenance alongside
exact revisions, findings/corrections, qualified outcomes, unknown resource measurements
and original-action settlements through existing correspondence/tracking contracts.
Over 3–4 weeks, collect supervised examples, qualify frozen cases and holdouts, compare
lower-tier models, then decide promotion by task bucket on quality, rework, escalation and
total observed cost. Preserve failures as examples and distinguish authored model reports
from independently verified configuration. In parallel, reduce the initial backlog and
reconcile new daily arrivals; the immediate supervised target is 10–15 evidenced original
action dispositions, not a closure quota. The historical two-action #319 review is an
attributed source example; the map separately records its format correction and the later
ten-action review and merge/deployment receipt. Neither review qualifies lower-tier models.
This requirement
is registered under #307/#504 and S25's existing dependencies. No new runtime slice is
admitted, no dispatch bead is created for the document, and S25's frontmatter, lifecycle,
success criterion, autonomy, eligibility and movement remain unchanged. Register later
implementation slices only after policy/authority/recovery entrances are resolved.

**2026-10-10 MC-UX-01 consumer-contract requirement:** the existing fleet-runner map now
registers the [versioned UX-to-domain crosswalk](../fleet-runner/mc-ux-01-domain-crosswalk.md)
and synthetic conformance pack against morning-cockpit draft PR #54 head
[`5078639b2e752c3e1fa7125288201a2ccfef8424`](https://github.com/ojfbot/morning-cockpit/tree/5078639b2e752c3e1fa7125288201a2ccfef8424/planning/mc-ux-01).
The cockpit transition remains in `rm:rm-l1-morning-cockpit`; its qualified read-only evidence
preservation/inspection work can use existing S11/S18 entrances without waiting for the complete
fleet-runner runtime. Shared producer, authority, execution, receipt, consumption and original-
action settlement work remains here only after #307's applicable decisions and S25 overlap are
reconciled. Promotion toward a shared contract requires at least one real producer, two independent
consumers and executed positive/mutation/replay/failure evidence, then explicit acceptance.
This body-only registration adds no slice or dependency, changes no S25 frontmatter, status,
autonomy, eligibility or movement, and creates no dispatch bead or readiness claim. Capture and
planning provenance are not operator acceptance; later runtime work must pin the actual accepted
cockpit main revision if PR #54 merges.

**2026-10-12 article-review requirement (Proposed registration):** the operator selected an advisory, separate
Codex check of each final daily-logger article alongside human web comments. The
[fleet-runner map](../wayfinder/control-plane-conductor.md#independent-daily-article-review-2026-10-12)
records the reported October 12 task registration and declared 07:00 America/Chicago
cadence, the October 12 revision-pinned
findings, and the existing #315/#317 census, #310/#311 receipt/portability, #316
consumption, and #318 independent-supervision entrances. Registration does not prove
the scheduled task ran or that it works while the Mac sleeps. Daily-logger retains
editorial authority; the review does not gate acceptance or merge. S20's operator-label
judge calibration remains queued and separate. No new slice, status, dependency,
movement value, runtime grant, or S25 criterion is created by this registration.

Cut after the operator's external "DIA" research survey (2026-07-08) was cross-checked against
the audit series and the week's delivery. The sequencing driver is an evidence finding: OPAV
S1-C3's data gate is now met (193 disposition events / ~24 days) **but the distribution is
degenerate — 190 ignored / 3 engaged_no_act / 0 acted / 0 capture_miss across 24 days of heavy
real skill use** — so capture-quality verification (S22a) precedes everything that would ever
publish a rate. S24 makes the disposition stream the single truth first (S22 measures against
it); S23 is the cluster's second RIDM promotion once the 30-day gate clears (~2026-07-14); S25
closes the owed day-runner live proof and turns its operating mode into a recorded decision;
S26 is the first meta-loop — the I3 error-analysis ritual as a proposal-only scheduled agent
under the §4 anti-Goodhart contract; S27 files the DIA cross-check as audit cycle 4.

**Explicitly not in this tranche:** F5's remainder (S12 already shipped Stalled/Zombie; the
rest needs F2 hook beads), F6 context budgets (tranche-4 companion to the triager), F2/F8,
anything touching model weights, and S20 duplication — S20 stays the standing queued judge
slice; S27's CLHF verdict references it.

**WIP-budget note.** "Six open slices is the attention budget" (PH3 ordering note) is read as
*agent-attention*: of the 10 open slices before this tranche, S3–S9 are `human_only`
voice-conversation legs the day-runner never grabs, and agent-claimable open slices were ~0
after PH4 merged. Tranche 3 adds 3 agent-claimable (S22/S24/S26) + 3 human-gated
(S23/S25/S27) slices; the agent-claimable count stays within budget.

## PH6 — Audit cycle 5 (2026-07-09): loop-engineering cross-check — loop legibility + liveness

Cut after the operator supplied a Dia research thread on "loop engineering" (Boris Cherny /
Osmani / Steinberger / Masood / Greyling) plus Anthropic's multi-model direction, cross-checked
as audit cycle 5 (`LOOP-ENGINEERING-CROSSCHECK-2026-07-09.md`, S28). The bulk converged on
cycles 1–4; two verdicts closed without slices (harness-native trigger primitives =
PARTIAL-ABSORB policy feeding the open S25 decision; the Advisor tool = DEFER behind T8 cost
telemetry, revisit site bldgblog annotate). The two BUILD verdicts are this phase: S29 makes
every loop a declared, lintable resource (the northstar-registry pattern applied to the
control plane itself — O8/P12/T4 all rhyme with "drift and death are silent"); S30 makes a
dead loop detectable from the registry, report-only, becoming an F3 emitter when F3 lands.

**Explicitly not in this phase:** any launchd→routine migration (working plists are not
debt; the 2a policy applies to *new* loops), any paging/auto-restart (F3's rail / a future
ADR-0086 shadow stage), F6 context budgets (still the named companion for a future tranche),
and anything touching the S20 judge posture — re-affirmed for the second consecutive cycle.

**WIP-budget note.** S28 is delivered by the PR that cuts this phase; S29/S30 add 2
agent-claimable slices to the open set (joining S22/S26), staying within the six-slice
agent-attention reading.

**S32/S33 — the first loop the registry caught, by failing to (2026-07-25).** S29 declared every
loop and S30 made dead ones detectable, but a cold session picking up bead
`20260723-1629-brief-arcade-l2-p1-rewording-pickup` nearly redid wayfinder #274 twelve hours after
PR #285 merged it. The cause is a loop that is declared and *not implemented*:
`hook-bead-session` claims to write the session's report bead, but `scripts/hooks/bead-session.sh`
is a PostToolUse recorder that never touches `.handoff/`. Nothing closes the ledger, so
`orient.py` reports every brief as a permanently open hook — 28 of them fleet-wide, against 9
report beads ever written and 3 beads ever reaching `closed`.

This is precisely the failure this phase exists to prevent, and it slipped all three guards for
structural reasons worth naming: `loops-lint` checks that a `trigger_ref` **exists**, never that
the artifact does what `purpose:` claims; `loops-liveness` skips `cadence: event` loops by design,
so the whole event class is a blind spot; and the entry declares `verifier: "none"`, so nothing was
expected to notice. S29's insight — "drift and death are silent" — turns out to have a third mode:
a loop can be *born* dead and stay green.

S32 corrects the entry, adds `bead-lint` in the northstar-lint mould (shadow-first, WARN-only —
enforcing before the backfill would red-wall every PR), and closes the event-loop liveness gap. S33
then backfills with the existing `/resume --verify` and promotes the schema checks to blocking once
the fleet is clean — the ADR-0086 data-gated pattern, same shape as S16. S33 is `human_only` on
purpose: every closure is a truth claim about whether work shipped, which is exactly the judgment
that produced this defect. Filed as TD-006.

## Supplemental research input, 2026-10-11

The [NanoClaw trust, queue, and evidence registration](../research/2026-10-11-nanoclaw-trust-queue-registration.md)
connects [#528](https://github.com/ojfbot/core/issues/528) and research #529/#530/#531/#532
to the existing fleet-runner decisions under #307. The registration records exact source pins,
receiving owners, and qualification limits. It does not register a new delivery slice or amend
the frontmatter, status, eligibility, movement, or success criteria of any existing slice.

Pending consumers are `rm:rm-l2-ojfbot#S20`, `rm:rm-l2-ojfbot#S22`,
`rm:rm-l2-ojfbot#S23`, `rm:rm-l2-ojfbot#S25`, `rm:rm-l2-ojfbot#S26`,
`rm:rm-l2-ojfbot#S31`, `rm:rm-l2-ojfbot#S32`, `rm:rm-l2-ojfbot#S33`,
`rm:rm-l2-ojfbot#S37`, `rm:rm-l2-ojfbot#S38`, and `rm:rm-l2-ojfbot#S39`.
The registration states how each consumes the research. S25 remains ready, human_only,
and gate-0 with its older operating-mode/live-proof criterion. Reconcile that criterion
with the governed pilot through the existing venues before dispatch.

`rm:rm-l1-core#S18` remains the separate dispatch-channel experiment. The recovered OPAV
plan's historical S4/S5 section names are not registered S4/S5 references in this roadmap.
Research findings return to #313 authority, #311 portability/recovery, #316 consumption,
#318 supervision, #505 exchange, #510 evaluation, and #511 identity as applicable.


**2026-10-13 historical article evaluation research registration:** the operator requested
an adversarial review and future subagent proof briefs for historical daily-logger accuracy,
actual-input faithfulness and generated-to-accepted editorial lineage. The
[review and hypotheses](../research/2026-10-13-daily-article-evaluation-review.md) and
[12 structured briefs](../research/2026-10-13-daily-article-evaluation-tasks.json) are research
inputs to existing #307/#510. [daily-logger #358](https://github.com/ojfbot/daily-logger/issues/358)
receives the bounded evidence/lineage pilot; #357 retains the advisory article-page consumer.
S19's real-failure hermetic lane, S20's queued human-only calibration criteria, S21 trace
identity and S25's operating-mode/live-proof criteria retain their current meanings.
Lineage isolation precedes held-out calibration; human-adjudicated consumption proof does
not acquire a judge prerequisite. Existing authority, identity, publication/recovery and
exchange owners receive the relevant gaps. This body registration adds no slice, dependency,
movement value, status change, queue, runtime or dispatch grant.

## PH8–PH13 — Agent trust build (wayfinder map core#661)

**Route.** The map "agent trust and factory evaluation" (ojfbot/core#661) is ruled. Its closing ticket, ojfbot/core#674 ("Resolution (revised)"), gives about 120 guarantees, one owner each, six NAS services and an ordered slice list. Here that list is split until each slice fits one build session and one reviewable PR: 114 slices in six layers. Each layer is one roadmap phase and one epic issue, and each slice is a sub-issue of its epic. The slices advance `ns:l2-ojfbot#P2` only indirectly, by making the fleet's work checkable, so none claims movement (`moves_from = moves_to = 30`).

Epics:
- Phase 0: owner setup and the authority service: ojfbot/core#688 (fleet roadmap `PH8`)
- Phase 1: enforcement (watch-only on staging): ojfbot/core#689 (fleet roadmap `PH9`)
- Outside security review, then enforcement go-live: ojfbot/core#690 (fleet roadmap `PH10`)
- Phase 2: evidence: ojfbot/core#691 (fleet roadmap `PH11`)
- Phase 3: seats and stops: ojfbot/core#692 (fleet roadmap `PH12`)
- Tests lane (runs alongside, one slice at a time): ojfbot/core#693 (fleet roadmap `PH13`)

Discoveries and plan gaps: ojfbot/core#687. Sanity-check brief: kept privately beside the research notes.

**How these slices are worked.**
- Order: phase 0 (owner setup and the authority service), phase 1 (enforcement), the outside security review and each enforcer's go-live tap, phase 2 (evidence), phase 3 (seats and stops). The tests lane runs alongside, one slice at a time. Inside a layer, dispatch in the order the layer's epic lists its slices, which follows #674's listed order. S-numbers are assigned once and never reused, so they are identities, not an order. The native GitHub "blocked by" links are the hard prerequisites. The Core fleet roadmap's `depends_on` names only each slice's first blocker.
- **Numbering.** Layer 0 is phase 0 and roadmap phase PH8. Layer 1 is phase 1 (PH9), layer 2 is the outside review (PH10), layer 3 is phase 2 (PH11), layer 4 is phase 3 (PH12), and layer 5 is the tests lane (PH13).
- **Watch-only first.** Every check that blocks something ships watch-only on staging. It records what it would refuse and blocks nothing. It switches to blocking on data, with one owner tap at go-live. This is a data-gated promotion under ADR-0086 (watch-only is what the harness calls shadow mode).
- **Owner-only steps** (`OW-*`, labelled `owner-only`) are never done by agents. Agents may write the runbook or wizard and run the read-only check afterwards.
- Every slice is `claimable_by: human_only` and `status: queued`. The conductor dispatches them; the day-runner never claims them. PRs stay draft until a Codex review and a Claude review are both clean.
- Complexity and the model and reasoning fields on each issue are **drafts**. A sanity-check agent confirms them by editing the issue fields.

**Catching surprises.** Every slice issue has a "Deviations and discoveries" section. Builders append to it, and to the repo's `implementation-notes.md` under `## Deviations`, whenever reality differs from the plan. Newly found unknowns go in the tracking issue ojfbot/core#687 ("Trust build: discoveries and plan gaps"), which every epic links.

- A discovery that **changes a ruled decision** (#662–#682, #674) goes to the owner **through the conductor**.
- A discovery that **only changes a slice** gets a re-plan of that slice, not of the whole map.
- Each layer ends with a **layer retro** slice (`RETRO-0` to `RETRO-5`) that re-checks the next layer's assumptions before it starts. Every retro runs one shared check, `node scripts/check-trust-phase-proof.mjs --phase <PH>`. It passes only when every other slice of the phase is closed with its proof: a merged pull request in the named repo that closed the issue (GitHub's last close event names it, so a linked PR or a hand close does not count), or, for an owner step, the issue closed as completed ("not planned" fails). It also needs each slice's "Deviations and discoveries" section to replace the filed `_(none yet)_` line with entries or a plain "None." line. A phase with no slices, or a lookup that finds none, fails. Until the per-Mac GitHub Apps exist (#681), a script can't tell the owner's close from an agent's, so the retro confirms owner steps by reading them. How each slice handled its review findings is also a human read in the retro.

Owner-only issues: `OW-0` ojfbot/LocalHelp#127, `OW-SVC` ojfbot/LocalHelp#199, `OW-BK-AU` ojfbot/LocalHelp#141, `OW-K1` ojfbot/LocalHelp#131, `OW-FID` ojfbot/LocalHelp#134, `OW-ACK` ojfbot/LocalHelp#135, `OW-1a` ojfbot/LocalHelp#137, `OW-1b` ojfbot/LocalHelp#138, `OW-2` ojfbot/LocalHelp#139, `OW-6` ojfbot/LocalHelp#140, `OW-8a` ojfbot/LocalHelp#157, `OW-8` ojfbot/LocalHelp#159, `OW-7` ojfbot/LocalHelp#156, `OW-BK-DA` ojfbot/LocalHelp#163, `OW-CK` ojfbot/LocalHelp#202, `OW-4` ojfbot/LocalHelp#174, `OW-5a` ojfbot/LocalHelp#175, `OW-3` ojfbot/LocalHelp#184, `OW-K2` ojfbot/LocalHelp#189, `OW-5b` ojfbot/LocalHelp#206.

### PH8 — Phase 0: owner setup and the authority service

Epic ojfbot/core#688. The Macs can no longer administer the NAS; the authority service runs under its own account with a hash-chained journal; one real promote is approved by Face ID and spent once; the GitHub Apps exist with their keys held only by the token issuer; the terminal login has no settings power.

| Roadmap | Slice | Title | Repo | Issue | Blocked by | Complexity (draft) |
|---|---|---|---|---|---|---|
| S40 | `P0-PROBE` | Write the NAS admin refusal probe (the #667 E10 test) | LocalHelp | ojfbot/LocalHelp#126 | — | low |
| S41 | `OW-0` | **owner-only** · Owner: take NAS admin away from the Macs (slice 0) | LocalHelp | ojfbot/LocalHelp#127 | `P0-PROBE` | high |
| S42 | `P0-WIZ` | Owner-setup wizard for the GitHub Apps, key enrolment and the terminal token switch (#681 S1 wizard part) | LocalHelp | ojfbot/LocalHelp#128 | — | low |
| S43 | `AU-1a` | Authority service skeleton: own account and key, hash-chained journal, replay and read-only status | LocalHelp | ojfbot/LocalHelp#129 | — | high |
| S44 | `OW-SVC` | **owner-only** · Owner: create a NAS account and key for each new service (authority service, token issuer, checker, data layer) | LocalHelp | ojfbot/LocalHelp#199 | `OW-0` | medium |
| S45 | `AU-1b` | Signing keys, the pinned first key and the passkey signing page | LocalHelp | ojfbot/LocalHelp#130 | `AU-1a`, `OW-SVC` | high |
| S46 | `AU-1c` | Approval records and the spent-approval ledger | LocalHelp | ojfbot/LocalHelp#132 | `AU-1b` | high |
| S47 | `AU-1d` | `helpdesk-promote` spends an approval ID at the authority service (closes LocalHelp#124) | LocalHelp | ojfbot/LocalHelp#133 | `AU-1c` | medium |
| S48 | `TI-1a` | Token issuer skeleton: own account, key store and enrolment, no minting yet | LocalHelp | ojfbot/LocalHelp#136 | `OW-SVC` | high |
| S49 | `OW-BK-AU` | **owner-only** · Owner: add the authority service data and the issuer's keys to the NAS backup (separate reviewed change) | LocalHelp | ojfbot/LocalHelp#141 | `AU-1b`, `TI-1a` | medium |
| S50 | `P0-GL` | Install the authority service and the token issuer at the go-live level (one owner tap) | LocalHelp | ojfbot/LocalHelp#200 | `AU-1d`, `TI-1a`, `OW-SVC`, `OW-BK-AU` | medium |
| S51 | `OW-K1` | **owner-only** · Owner: add the first signing key at the NAS and pin it on one Mac | LocalHelp | ojfbot/LocalHelp#131 | `P0-GL` | medium |
| S52 | `OW-FID` | **owner-only** · Owner: the first Face ID promote approval, end to end | LocalHelp | ojfbot/LocalHelp#134 | `AU-1d`, `OW-K1` | medium |
| S53 | `OW-ACK` | **owner-only** · Owner: re-make one listener acknowledgement in the confirmed format, at a real terminal, before that Mac's gated listener upgrade | LocalHelp | ojfbot/LocalHelp#135 | — | low |
| S54 | `OW-1a` | **owner-only** · Owner: create one GitHub App per Mac and the check-only gate App | LocalHelp | ojfbot/LocalHelp#137 | `P0-WIZ` | medium |
| S55 | `OW-1b` | **owner-only** · Owner: generate each App key and enrol it in the token issuer only | LocalHelp | ojfbot/LocalHelp#138 | `OW-1a`, `P0-GL` | medium |
| S56 | `OW-2` | **owner-only** · Owner: switch the terminal login to a token with no settings power | LocalHelp | ojfbot/LocalHelp#139 | `P0-WIZ` | medium |
| S57 | `OW-6` | **owner-only** · Owner: review the third-party apps authorized on the owner's login (#681 owner step 7) | LocalHelp | ojfbot/LocalHelp#140 | — | low |
| S58 | `RETRO-0` | Layer retro: phase 0 done, re-check phase 1 assumptions | core | ojfbot/core#694 | `OW-FID`, `OW-1b`, `OW-2`, `OW-6` | low |

### PH9 — Phase 1: enforcement (watch-only on staging)

Epic ojfbot/core#689. Every enforcer (token issuer, FleetRunner, listener and wake) asks the authority service before it admits work, and every refusal it would make is recorded in watch-only mode on staging. Nothing blocks yet.

| Roadmap | Slice | Title | Repo | Issue | Blocked by | Complexity (draft) |
|---|---|---|---|---|---|---|
| S59 | `HD-1a` | Registration proof stored, and lifecycle events in replay (#666 item 2) | LocalHelp | ojfbot/LocalHelp#142 | `RETRO-0` | high |
| S60 | `HD-1b` | Signed holder-state read, and a renewal keeps the holder live (#666 checks 3 and 7) | LocalHelp | ojfbot/LocalHelp#143 | `HD-1a` | medium |
| S61 | `AU-2a` | Charter of top seats and the seat check (service side) | LocalHelp | ojfbot/LocalHelp#144 | `AU-1c`, `HD-1b` | high |
| S62 | `AU-2b` | Mac-side record checker in the device client | LocalHelp | ojfbot/LocalHelp#145 | `AU-2a` | high |
| S63 | `AU-3a` | Work-grant records with hops and validity windows (service side) | LocalHelp | ojfbot/LocalHelp#146 | `AU-2a` | high |
| S64 | `AU-3b` | Two-link checker on each Mac, and replay returns grant records | LocalHelp | ojfbot/LocalHelp#147 | `AU-3a`, `AU-2b` | medium |
| S65 | `AU-4a` | Live grant check: one call verifies a chain and records an observed answer | LocalHelp | ojfbot/LocalHelp#148 | `AU-3a` | high |
| S66 | `AU-4b` | Shared run counter and reservations | LocalHelp | ojfbot/LocalHelp#149 | `AU-4a` | high |
| S67 | `AU-4c` | Grant-end notice to the issuer (expiry and single-record end) | LocalHelp | ojfbot/LocalHelp#150 | `AU-4b` | medium |
| S68 | `TI-1b` | Mint one-hour repo-limited tokens only after the grant check (watch-only first) | LocalHelp | ojfbot/LocalHelp#151 | `TI-1a`, `AU-4b`, `OW-1b` | high |
| S69 | `CH-1b` | Pin agent sessions to the Mac's App: token helper and session settings (#681 S1) | core | ojfbot/core#695 | `TI-1b`, `OW-2` | medium |
| S70 | `TI-2` | Revoke live tokens on grant end, and the issuer's rollback guard | LocalHelp | ojfbot/LocalHelp#152 | `TI-1b`, `AU-4c` | high |
| S71 | `FR-1` | Enqueue checks the grant; every claim reserves a run (watch-only first) | core | ojfbot/core#696 | `AU-4b` | medium |
| S72 | `HD-2` | Listeners and wakes check and reserve before a TASK runs, with the signed-sender list | LocalHelp | ojfbot/LocalHelp#153 | `AU-4b` | medium |
| S73 | `AU-5` | Rollback guard for authority records | LocalHelp | ojfbot/LocalHelp#154 | `AU-4b` | high |
| S74 | `FR-4` | FleetRunner rollback guard | core | ojfbot/core#697 | `FR-1` | medium |
| S75 | `HD-3` | Rollback guard for registration records | LocalHelp | ojfbot/LocalHelp#155 | `HD-1a` | medium |
| S76 | `CH-2` | Speed-bump settings for Claude Code and Codex (#667 slice 7) | core | ojfbot/core#698 | `RETRO-0` | low |
| S77 | `RETRO-1` | Layer retro: phase 1 watch-only data, re-check the outside review's assumptions | core | ojfbot/core#699 | `HD-2`, `FR-4`, `HD-3`, `AU-5`, `TI-2`, `CH-1b`, `AU-3b`, `CH-2` | medium |

### PH10 — Outside security review, then enforcement go-live

Epic ojfbot/core#690. One outside human security review of phase 1 on staging is filed privately; each finding is a build check or an owner decision; only then are the phase 1 enforcers switched from watch-only to enforcing, one owner tap each.

| Roadmap | Slice | Title | Repo | Issue | Blocked by | Complexity (draft) |
|---|---|---|---|---|---|---|
| S78 | `OW-8a` | **owner-only** · Owner: choose the outside security reviewer and the budget | LocalHelp | ojfbot/LocalHelp#157 | — | low |
| S79 | `OR-PACK` | Prepare the private review packet for the outside reviewer | LocalHelp | ojfbot/LocalHelp#158 | `RETRO-1` | low |
| S80 | `OW-8` | **owner-only** · Owner: commission and receive the outside security review of phase 1 on staging | LocalHelp | ojfbot/LocalHelp#159 | `OW-8a`, `OR-PACK` | medium |
| S81 | `OR-TRIAGE` | Triage the outside review: each finding becomes a build check or an owner decision | LocalHelp | ojfbot/LocalHelp#160 | `OW-8` | medium |
| S82 | `P1-GL-LH` | Switch the LocalHelp enforcers from watch-only to enforcing (one owner tap each) | LocalHelp | ojfbot/LocalHelp#161 | `OR-TRIAGE` | medium |
| S83 | `P1-GL-FR` | Switch FleetRunner's grant check and rollback guard from watch-only to enforcing (one owner tap) | core | ojfbot/core#700 | `OR-TRIAGE` | low |
| S84 | `OW-7` | **owner-only** · Owner: install the speed-bump settings on both Macs | LocalHelp | ojfbot/LocalHelp#156 | `CH-2`, `OR-TRIAGE` | low |
| S85 | `RETRO-2` | Layer retro: enforcement is live, re-check phase 2 assumptions | core | ojfbot/core#701 | `P1-GL-LH`, `P1-GL-FR`, `OW-7` | low |

### PH11 — Phase 2: evidence

Epic ojfbot/core#691. One staging action rebuilds from raw records, with a status per link, through every journal; journals are hash-chained and witnessed; the ask-first gate and the merge proof are on.

| Roadmap | Slice | Title | Repo | Issue | Blocked by | Complexity (draft) |
|---|---|---|---|---|---|---|
| S86 | `DA-1a` | Data layer: add-only store with signed receipts and a hash-chained journal | LocalHelp | ojfbot/LocalHelp#162 | `RETRO-2` | high |
| S87 | `CK-1a` | Checker skeleton: read-only, own account and key, signed findings only | LocalHelp | ojfbot/LocalHelp#168 | `RETRO-2` | medium |
| S88 | `P2-INST` | Install the data layer and the checker at the go-live level (one owner tap) | LocalHelp | ojfbot/LocalHelp#205 | `DA-1a`, `CK-1a` | medium |
| S89 | `OW-BK-DA` | **owner-only** · Owner: add the data-layer store to the NAS backup (separate reviewed change) | LocalHelp | ojfbot/LocalHelp#163 | `P2-INST` | medium |
| S90 | `CH-7` | Hook logs: identifiers only, numbered, with an end-of-run count, copied to the data layer | core | ojfbot/core#702 | `DA-1a` | medium |
| S91 | `HD-4a` | HelpDesk: stored request signatures with full inputs, and hash-chained events | LocalHelp | ojfbot/LocalHelp#164 | `RETRO-2` | high |
| S92 | `HD-4b` | HelpDesk: parent links on TASK and RESULT, journaled listener grants, verdict split from posting | LocalHelp | ojfbot/LocalHelp#165 | `HD-4a` | medium |
| S93 | `FR-2` | FleetRunner chain fields: admitter, output digest, attempt ID | core | ojfbot/core#703 | `RETRO-2` | medium |
| S94 | `AU-W` | Authority journal sends its fingerprint on every append or once a minute | LocalHelp | ojfbot/LocalHelp#166 | `DA-1a` | low |
| S95 | `FR-W` | FleetRunner journal sends its fingerprint on every append or once a minute | core | ojfbot/core#704 | `DA-1a`, `FR-2` | low |
| S96 | `DA-W` | Data layer journal sends its fingerprint on every append or once a minute | LocalHelp | ojfbot/LocalHelp#201 | `DA-1a` | low |
| S97 | `HD-5` | HelpDesk sends fingerprints, and the device client keeps witness copies on each Mac | LocalHelp | ojfbot/LocalHelp#167 | `HD-4a`, `DA-1a` | medium |
| S98 | `OW-CK` | **owner-only** · Owner: give the checker a read-only GitHub credential and its settings-event source | LocalHelp | ojfbot/LocalHelp#202 | `P2-INST` | medium |
| S99 | `CK-1b` | Linker: rebuild one staging action from raw records, with a status per link | LocalHelp | ojfbot/LocalHelp#169 | `CK-1a`, `HD-1a`, `HD-4b`, `FR-2` | high |
| S100 | `CK-2` | Scope check after the fact | LocalHelp | ojfbot/LocalHelp#170 | `CK-1b`, `OW-CK` | medium |
| S101 | `CK-5` | Compare witness copies and report which witnesses are independent | LocalHelp | ojfbot/LocalHelp#171 | `HD-5`, `AU-W`, `FR-W`, `DA-W`, `CK-1a` | medium |
| S102 | `DLG-1` | DailyLogger publish door record | daily-logger | ojfbot/daily-logger#595 | `RETRO-2` | low |
| S103 | `AU-6` | Ask-first gate with a fixed prediction at the spend | LocalHelp | ojfbot/LocalHelp#172 | `RETRO-2` | high |
| S104 | `TI-4` | Gate App posts the merge-proof check only on a verified, unspent approval at that head | LocalHelp | ojfbot/LocalHelp#173 | `AU-6`, `TI-1b` | high |
| S105 | `DLG-5` | Publishing merges need the merge proof or the written standing exception | daily-logger | ojfbot/daily-logger#596 | `TI-4` | medium |
| S106 | `OW-4` | **owner-only** · Owner: approve the daily-article standing exception once, as written | LocalHelp | ojfbot/LocalHelp#174 | `AU-6` | low |
| S107 | `P2-GL` | Switch the ask-first gate and the merge proof from watch-only to enforcing (one owner tap each) | LocalHelp | ojfbot/LocalHelp#203 | `AU-6`, `TI-4`, `OW-4` | medium |
| S108 | `OW-5a` | **owner-only** · Owner: rulesets that require the merge-proof check, and no direct push to main | LocalHelp | ojfbot/LocalHelp#175 | `P2-GL`, `DLG-5` | medium |
| S109 | `CK-3` | Critical-violation alarms through HelpDesk's alert route | LocalHelp | ojfbot/LocalHelp#176 | `CK-1b` | medium |
| S110 | `CK-4` | Settings watcher: every settings change reaches the phone within the deadline | LocalHelp | ojfbot/LocalHelp#177 | `CK-1a`, `OW-CK` | medium |
| S111 | `RETRO-3` | Layer retro: evidence is in, re-check phase 3 assumptions | core | ojfbot/core#705 | `OW-BK-DA`, `CH-7`, `CK-2`, `CK-5`, `DLG-1`, `OW-5a`, `CK-3`, `CK-4` | low |

### PH12 — Phase 3: seats and stops

Epic ojfbot/core#692. A stop is proven or reported "not complete"; ending a record ends everything below it; child seats, succession, baskets, check-ups and the lost-phone drill work as ruled.

| Roadmap | Slice | Title | Repo | Issue | Blocked by | Complexity (draft) |
|---|---|---|---|---|---|---|
| S112 | `HD-6` | Wake stop-now: abort and check a running review on pause or revoke | LocalHelp | ojfbot/LocalHelp#178 | `RETRO-3` | high |
| S113 | `HD-7a` | Stop verdict record and routing: "not complete" until every item is proven | LocalHelp | ojfbot/LocalHelp#179 | `RETRO-3` | medium |
| S114 | `HD-7b` | HelpDesk stop support: look-up without posting, saved answers dropped, registered-sessions switch | LocalHelp | ojfbot/LocalHelp#180 | `HD-7a` | medium |
| S115 | `AU-9` | Ending and cascade: ending a record ends everything below it | LocalHelp | ojfbot/LocalHelp#181 | `RETRO-3` | high |
| S116 | `FR-3` | FleetRunner "stop attempt" transition that voids the fence | core | ojfbot/core#706 | `RETRO-3` | medium |
| S117 | `TI-3` | Per-Mac cut at the issuer, with the cut runbook | LocalHelp | ojfbot/LocalHelp#182 | `RETRO-3` | medium |
| S118 | `HD-7c` | Cancel queued GitHub effects with an issuer token, and read them back | LocalHelp | ojfbot/LocalHelp#183 | `HD-7a`, `TI-3` | medium |
| S119 | `DLG-4` | Hosted writers in the stop inventory: stop automation for the hosted workflows, and the owner's secret runbook | daily-logger | ojfbot/daily-logger#597 | `RETRO-3` | low |
| S120 | `OW-3` | **owner-only** · Owner: switch DailyLogger's stored workflow token to an App token or a narrowed token | LocalHelp | ojfbot/LocalHelp#184 | `DLG-4` | medium |
| S121 | `AU-10` | Child seats and takeover records | LocalHelp | ojfbot/LocalHelp#185 | `RETRO-3` | high |
| S122 | `HD-8` | Registry lapse warning at 8 hours, and alert-route rules | LocalHelp | ojfbot/LocalHelp#186 | `AU-10` | medium |
| S123 | `FR-5` | Work-register baskets (ADR-0110 amendment) | core | ojfbot/core#707 | `RETRO-3` | medium |
| S124 | `AU-7` | Check-up and renewal: reminders at day 80, 87 and 89 | LocalHelp | ojfbot/LocalHelp#187 | `RETRO-3`, `HD-8` | medium |
| S125 | `AU-8` | Second key, revocations and the lost-phone drill (agent part) | LocalHelp | ojfbot/LocalHelp#188 | `RETRO-3` | high |
| S126 | `P3-GL` | Switch the phase 3 controls to go-live (one owner tap each) | LocalHelp | ojfbot/LocalHelp#204 | `HD-6`, `HD-7b`, `HD-7c`, `AU-9`, `HD-8`, `AU-10`, `AU-7`, `AU-8`, `TI-3`, `DLG-4` | medium |
| S127 | `OW-K2` | **owner-only** · Owner: add the backup key and run the lost-phone drill | LocalHelp | ojfbot/LocalHelp#189 | `P3-GL` | medium |
| S128 | `HD-9` | Wake audience and quote check | LocalHelp | ojfbot/LocalHelp#190 | `RETRO-3` | medium |
| S129 | `CH-6` | Status labels and claim fixes in Core: `/resume` and GitHub actions | core | ojfbot/core#708 | `RETRO-3` | medium |
| S130 | `DLG-3a` | DailyLogger claim-check fix: verdicts depend only on independent records | daily-logger | ojfbot/daily-logger#598 | `RETRO-3` | medium |
| S131 | `DLG-3b` | DailyLogger comment actuators and status labels | daily-logger | ojfbot/daily-logger#601 | `DLG-3a` | medium |
| S132 | `P3-GL-FR` | Switch FleetRunner's stop transition and baskets to go-live (one owner tap each) | core | ojfbot/core#722 | `FR-3`, `FR-5` | low |
| S133 | `RETRO-4` | Layer retro: seats and stops done; close the map's build | core | ojfbot/core#709 | `P3-GL`, `P3-GL-FR`, `OW-3`, `OW-K2`, `HD-9`, `CH-6`, `DLG-3b` | low |

### PH13 — Tests lane (runs alongside, one slice at a time)

Epic ojfbot/core#693. Model tests, the three scores, factory measures and guided PR review are measured and shown on the board with honest labels.

| Roadmap | Slice | Title | Repo | Issue | Blocked by | Complexity (draft) |
|---|---|---|---|---|---|---|
| S134 | `BD-1` | Accepted changes and spec-to-merge on the board, with a "ready to build" label | LocalHelp | ojfbot/LocalHelp#191 | — | low |
| S135 | `BD-2` | Weekly total-spend collector with completeness | LocalHelp | ojfbot/LocalHelp#192 | `BD-1` | medium |
| S136 | `CH-4` | Regression kind in the defect ledger (ADR-0104 amendment) | core | ojfbot/core#710 | — | medium |
| S137 | `CH-3a` | Probe approvals pin the text, the commit and the sandbox profile | core | ojfbot/core#711 | `OW-FID` | high |
| S138 | `CH-3b` | Defect sweep as a fixed FleetRunner job in a sandbox, with the defect lint at merge | core | ojfbot/core#712 | `CH-3a`, `FR-1` | medium |
| S139 | `BD-3` | Growth reading: grow, hold or unknown, and the deciding condition | LocalHelp | ojfbot/LocalHelp#193 | `BD-2`, `CH-4` | medium |
| S140 | `FR-6a` | Model-test job kinds on the Mac workers | core | ojfbot/core#713 | `FR-1` | high |
| S141 | `DA-2` | Private model-test set in the data layer | LocalHelp | ojfbot/LocalHelp#194 | `DA-1a` | medium |
| S142 | `FR-6b` | Held-out rules, family exclusion and run manifests for model tests | core | ojfbot/core#714 | `FR-6a`, `DA-2` | high |
| S143 | `BD-5` | Score cards and status labels (the three scores kept apart) | LocalHelp | ojfbot/LocalHelp#195 | `FR-6b` | medium |
| S144 | `CH-5a` | Guided review: risk lists and matcher, read from the base branch | core | ojfbot/core#715 | — | medium |
| S145 | `CH-5b` | Guided review: fact skeleton with no model | core | ojfbot/core#716 | `CH-5a` | medium |
| S146 | `CH-5c` | Guided review: explainer and per-link-type link check | core | ojfbot/core#717 | `CH-5b` | medium |
| S147 | `CH-5d` | Guided review: review-input records, reviews independent of the guide | core | ojfbot/core#718 | `CH-5b` | low |
| S148 | `CH-5e` | Guided review: the quiz gate recomputes the score from the marks | core | ojfbot/core#719 | `CH-5d` | medium |
| S149 | `BD-4` | Owner-minutes estimate per accepted change | LocalHelp | ojfbot/LocalHelp#196 | `BD-1` | low |
| S150 | `DLG-2` | Measures block pasted from the feed, written by code | daily-logger | ojfbot/daily-logger#599 | `BD-3` | low |
| S151 | `BD-6` | Guide measures: taught quiz scores and owner minutes, before and after guides | LocalHelp | ojfbot/LocalHelp#197 | `CH-5e`, `BD-4` | low |
| S152 | `OW-5b` | **owner-only** · Owner: make the defect-lint and quiz-gate checks required | LocalHelp | ojfbot/LocalHelp#206 | `CH-3b`, `CH-5e`, `OW-5a` | medium |
| S153 | `RETRO-5` | Tests lane retro: re-check measures and whether any AI judge is being proposed | core | ojfbot/core#720 | `OW-5b`, `BD-5`, `CH-5c`, `DLG-2`, `BD-6` | low |
