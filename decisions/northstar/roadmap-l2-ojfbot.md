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
    check: "test -f DIA-CROSSCHECK-2026-07-08.md && [ $(grep -c '^VERDICT' DIA-CROSSCHECK-2026-07-08.md) -eq 4 ]"
    autonomy: gate-0
    claimable_by: either
    kind: m
    repo: core
    status: merged
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
