---
type: loops-registry
version: 1
loops:
  - slug: dolt-beads
    purpose: "Always-on Dolt sql-server backing the bead store (beads + bead_events) every other loop writes through"
    trigger: launchd
    trigger_ref: scripts/dolt-beads-launchd.plist
    installed_ref: ~/Library/LaunchAgents/dev.ojfbot.dolt-beads.plist
    cadence: always-on
    state_spine: ".beads-dolt Dolt database at 127.0.0.1:3307"
    verifier: "none today — T4 names the gap (emissions are '|| true'); S30 reads bead_events recency"
    stop_rule: "KeepAlive restarts on exit; launchctl unload to stop deliberately"
    evidence_ref: "dolt:bead_events"
    owner: operator
    status: live
    repo: core
  - slug: sync-telemetry
    purpose: "Daily telemetry sync — ships the local skill/disposition ledgers to the telemetry/daily branch ahead of the daily-logger cron"
    trigger: launchd
    trigger_ref: scripts/sync-telemetry-launchd.plist
    installed_ref: ~/Library/LaunchAgents/com.ojfbot.sync-telemetry.plist
    cadence: daily
    state_spine: "telemetry/daily branch on ojfbot/core"
    verifier: "consumers (claude-skill-audit CIs) fail visibly if the branch goes stale — S24 wired them"
    stop_rule: "single daily fire (03:30 CDT); --since=48h bounds re-ingestion"
    evidence_ref: "git-branch:telemetry/daily"
    owner: operator
    status: live
    repo: core
  - slug: skill-architecture-audit
    purpose: "Weekly OPAV observation pulse — runs the delivery oracle + skill metrics and commits the measurement artifact (S13 cadence)"
    trigger: launchd
    trigger_ref: scripts/skill-architecture-audit-launchd.plist
    installed_ref: ~/Library/LaunchAgents/com.ojfbot.skill-architecture-audit.plist
    cadence: weekly
    state_spine: "committed measurement artifacts in core"
    verifier: "audit-delivery-check.mjs --check inside the run (regression/staleness gate)"
    stop_rule: "single weekly fire (Mon 03:45 CDT); exit 0 always — a measurement never blocks"
    evidence_ref: "script:scripts/skill-architecture-audit.sh"
    owner: operator
    status: live
    repo: core
  - slug: screenshot-organizer
    purpose: "Filesystem watcher that files new screenshots from ~/Screenshots into organized storage"
    trigger: watchpath
    trigger_ref: ~/Library/LaunchAgents/com.ojfbot.screenshot-organizer.plist
    installed_ref: ~/Library/LaunchAgents/com.ojfbot.screenshot-organizer.plist
    cadence: event
    state_spine: "organized screenshot directories"
    verifier: "none"
    stop_rule: "ThrottleInterval 10s; fires only on WatchPaths change"
    evidence_ref: "none"
    owner: operator
    status: live
    repo: screenshot-organizer
  - slug: selfco-box-cultivate
    purpose: "selfco vault cultivation pass (Pi-host era automation, parked during the host rebuild)"
    trigger: launchd
    trigger_ref: ~/Library/LaunchAgents/com.ojfbot.selfco-box.cultivate.plist.disabled
    cadence: daily
    state_spine: "~/selfco vault"
    verifier: "none"
    stop_rule: "disabled — plist renamed .disabled"
    evidence_ref: "none"
    owner: operator
    status: disabled
    repo: selfco
  - slug: selfco-box-poll-notion
    purpose: "selfco Notion-inbox poller (Pi-host era automation, parked during the host rebuild)"
    trigger: launchd
    trigger_ref: ~/Library/LaunchAgents/com.ojfbot.selfco-box.poll-notion.plist.disabled
    cadence: daily
    state_spine: "~/selfco Inbox"
    verifier: "none"
    stop_rule: "disabled — plist renamed .disabled"
    evidence_ref: "none"
    owner: operator
    status: disabled
    repo: selfco
  - slug: daily-blog
    purpose: "Daily-logger article generation — collects fleet context, drafts via council pipeline, opens the article PR"
    trigger: gh-actions
    trigger_ref: ../daily-logger/.github/workflows/daily-blog.yml
    cadence: daily
    state_spine: "_articles/YYYY-MM-DD.md corpus + article PRs"
    verifier: "editorial-revise council + operator accept (ADR-0038); truth-pipeline checks (S11)"
    stop_rule: "cron 09:00 UTC once daily; A2 gotcha — closing the alert issue disables the workflow"
    evidence_ref: "gh:daily-logger:daily-blog.yml"
    owner: operator
    status: live
    repo: daily-logger
  - slug: daily-cleaner
    purpose: "Daily-logger dead-link / stale-reference sweep over the published corpus"
    trigger: gh-actions
    trigger_ref: ../daily-logger/.github/workflows/daily-cleaner.yml
    cadence: daily
    state_spine: "cleaner reports on the daily-logger repo"
    verifier: "report-only"
    stop_rule: "cron 11:00 UTC once daily"
    evidence_ref: "gh:daily-logger:daily-cleaner.yml"
    owner: operator
    status: live
    repo: daily-logger
  - slug: editorial-revise
    purpose: "Council-of-experts revision loop on article PRs — critique, revise, gate to accept"
    trigger: gh-actions
    trigger_ref: ../daily-logger/.github/workflows/editorial-revise.yml
    cadence: event
    state_spine: "article PR threads"
    verifier: "operator editorial accept (human gate)"
    stop_rule: "bounded revision passes; auto-merge only after accept"
    evidence_ref: "gh:daily-logger:editorial-revise.yml"
    owner: operator
    status: live
    repo: daily-logger
  - slug: pipeline-alert-commands
    purpose: "GitHub-issue command surface (/disable, /enable) for the daily-logger pipeline"
    trigger: gh-actions
    trigger_ref: ../daily-logger/.github/workflows/pipeline-alert-commands.yml
    cadence: event
    state_spine: "pipeline alert issue"
    verifier: "operator issues the commands"
    stop_rule: "fires per issue_comment only"
    evidence_ref: "gh:daily-logger:pipeline-alert-commands.yml"
    owner: operator
    status: live
    repo: daily-logger
  - slug: claude-skill-audit-core
    purpose: "PR-time skill-relevance audit comment on core PRs (shadow heuristics, consumes telemetry/daily since S24)"
    trigger: gh-actions
    trigger_ref: .github/workflows/claude-skill-audit.yml
    cadence: event
    state_spine: "PR comments"
    verifier: "shadow — advisory comment only"
    stop_rule: "fires per PR open/synchronize only"
    evidence_ref: "gh:core:claude-skill-audit.yml"
    owner: operator
    status: live
    repo: core
  - slug: claude-skill-audit-daily-logger
    purpose: "PR-time skill-relevance audit comment on daily-logger PRs (fetches telemetry/daily from ojfbot/core since S24)"
    trigger: gh-actions
    trigger_ref: ../daily-logger/.github/workflows/claude-skill-audit.yml
    cadence: event
    state_spine: "PR comments"
    verifier: "shadow — advisory comment only"
    stop_rule: "fires per PR open/synchronize only"
    evidence_ref: "gh:daily-logger:claude-skill-audit.yml"
    owner: operator
    status: live
    repo: daily-logger
  - slug: hook-suggest-skill
    purpose: "UserPromptSubmit skill suggestion — matches prompts against the skill catalog, injects suggestions (OPAV S0 identity)"
    trigger: hook
    trigger_ref: scripts/hooks/suggest-skill.sh
    installed_ref: ~/.claude/settings.json
    cadence: event
    state_spine: "~/.claude suggestion telemetry + skill-dispositions ledger"
    verifier: "OPAV S1 disposition tracking"
    stop_rule: "--limit=1 top suggestion per prompt"
    evidence_ref: "file:~/selfco/tracking/skill-dispositions.jsonl"
    owner: operator
    status: live
    repo: core
  - slug: hook-session-init
    purpose: "UserPromptSubmit session initializer — seeds session identity for bead + telemetry joins"
    trigger: hook
    trigger_ref: scripts/hooks/session-init.sh
    installed_ref: ~/.claude/settings.json
    cadence: event
    state_spine: "session beads"
    verifier: "none"
    stop_rule: "per-prompt no-op after first fire"
    evidence_ref: "none"
    owner: operator
    status: live
    repo: core
  - slug: hook-log-session
    purpose: "SessionStart tracker — logs session opens for the read-models"
    trigger: hook
    trigger_ref: scripts/hooks/log-session.sh
    installed_ref: ~/.claude/settings.json
    cadence: event
    state_spine: "session telemetry"
    verifier: "none"
    stop_rule: "fires per session start only"
    evidence_ref: "none"
    owner: operator
    status: live
    repo: core
  - slug: hook-log-tool-use
    purpose: "PostToolUse tool-usage telemetry at user scope"
    trigger: hook
    trigger_ref: scripts/hooks/log-tool-use.sh
    installed_ref: ~/.claude/settings.json
    cadence: event
    state_spine: "tool-use telemetry"
    verifier: "none"
    stop_rule: "async append, fire-and-forget"
    evidence_ref: "none"
    owner: operator
    status: live
    repo: core
  - slug: hook-log-skill
    purpose: "PostToolUse(Skill) invocation logger — legacy stream, demoted to labeled fallback by S24"
    trigger: hook
    trigger_ref: scripts/hooks/log-skill.sh
    installed_ref: .claude/settings.json
    cadence: event
    state_spine: "~/.claude/skill-telemetry.jsonl (frozen legacy)"
    verifier: "S24 labeled it fallback; dispositions are primary"
    stop_rule: "async append, fire-and-forget"
    evidence_ref: "file:~/.claude/skill-telemetry.jsonl"
    owner: operator
    status: live
    repo: core
  - slug: hook-bead-session
    purpose: "Session-close bead emission — writes the session's report bead + events"
    trigger: hook
    trigger_ref: scripts/hooks/bead-session.sh
    installed_ref: .claude/settings.json
    cadence: event
    state_spine: "Dolt beads + .handoff/"
    verifier: "none"
    stop_rule: "fires at session end only"
    evidence_ref: "dolt:bead_events"
    owner: operator
    status: live
    repo: core
  - slug: hook-claude-md-gate
    purpose: "PreToolUse gate enforcing CLAUDE.md loading discipline (ADR-0081) on edits"
    trigger: hook
    trigger_ref: scripts/hooks/claude-md-gate.sh
    installed_ref: .claude/settings.json
    cadence: event
    state_spine: "none — pure gate"
    verifier: "is itself a verifier"
    stop_rule: "deny/allow per tool call"
    evidence_ref: "none"
    owner: operator
    status: live
    repo: core
  - slug: hook-autoformat
    purpose: "PostToolUse prettier auto-format on edited .ts files (inline command, no script file)"
    trigger: hook
    trigger_ref: .claude/settings.json
    installed_ref: .claude/settings.json
    cadence: event
    state_spine: "none"
    verifier: "CI format:check"
    stop_rule: "per-edit, single file"
    evidence_ref: "none"
    owner: operator
    status: live
    repo: core
  - slug: hook-reconcile-skill-acted
    purpose: "Stop-hook independent recorder for OPAV S1 dispositions — the second source in the two-source honesty contract (ADR-0095)"
    trigger: hook
    trigger_ref: scripts/hooks/reconcile-skill-acted.mjs
    installed_ref: ~/.claude/settings.json
    cadence: event
    state_spine: "~/selfco/tracking/skill-dispositions.jsonl"
    verifier: "skill-acted validator (shadow until S23 RIDM)"
    stop_rule: "fires per session stop only"
    evidence_ref: "file:~/selfco/tracking/skill-dispositions.jsonl"
    owner: operator
    status: live
    repo: core
  - slug: hook-reconcile-skill-acted-dup
    purpose: "DUPLICATE registration of the Stop-hook recorder from the core-tracking worktree — verified benign (dedup by suggestion_id holds); removal is operator-manual (settings.json edits are classifier-blocked). Declared so the wart is legible, not forgotten."
    trigger: hook
    trigger_ref: ../core-tracking/scripts/hooks/reconcile-skill-acted.mjs
    installed_ref: ~/.claude/settings.json
    cadence: event
    state_spine: "~/selfco/tracking/skill-dispositions.jsonl (same ledger, deduped)"
    verifier: "dedup by suggestion_id"
    stop_rule: "pending operator removal"
    evidence_ref: "none"
    owner: operator
    status: live
    repo: core
  - slug: hook-mrplug-inject
    purpose: "UserPromptSubmit context injector for the MrPlug extension MCP server"
    trigger: hook
    trigger_ref: ../mrplug/mrplug-mcp-server/hooks/mrplug-inject.sh
    installed_ref: ~/.claude/settings.json
    cadence: event
    state_spine: "none"
    verifier: "none"
    stop_rule: "per-prompt"
    evidence_ref: "none"
    owner: operator
    status: live
    repo: mrplug
  - slug: day-runner
    purpose: "Gate-0 dispatch loop — claims agent-eligible queue beads, runs worktree-isolated headless sessions, verifies the slice-boundary contract, never merges"
    trigger: manual
    cadence: manual
    state_spine: "Dolt queue beads + ~/.cache/day-runner/ worktrees + PRs"
    verifier: "5-clause slice-boundary contract + scripts/lib/shadow-checks.mjs + human merge gate"
    stop_rule: "--timeout-mins 45 per session, --max 2 concurrent, queue lease TTL"
    evidence_ref: "dolt:bead_events"
    owner: operator
    status: live
    repo: core
  - slug: weekly-measure
    purpose: "Weekly measurement command (delivery-oracle diff + skill metrics) — DECLARED weekly but no rail invokes it today; designed for launchd/cron/routine use (see S25-adjacent finding, cycle-5 §2c)"
    trigger: manual
    trigger_ref: scripts/weekly-measure.mjs
    cadence: weekly
    state_spine: "committed measurement artifacts"
    verifier: "audit-delivery-check.mjs --check propagated via --check"
    stop_rule: "exit 0 always without --check"
    evidence_ref: "script:scripts/weekly-measure.mjs"
    owner: operator
    status: live
    repo: core
---

# Loops registry

Every loop in the ojfbot cluster, declared as a first-class resource (audit cycle 5,
`LOOP-ENGINEERING-CROSSCHECK-2026-07-09.md` §2c, slice `rm:rm-l2-ojfbot#S29`). A **loop** is a
control cycle that runs without a human prompting it — a schedule, an event hook, a watcher, or
a named manual ritual with a declared cadence. The registry answers, from one file: what loops
exist, what triggers each (the `trigger:` value is a labeled adapter — launchd / gh-actions /
hook / watchpath / manual — never the loop's identity), where its state lives, what verifies
it, and what stops it.

**Lint.** `scripts/loops-lint.mjs` cross-checks this registry against the artifacts on disk,
both directions: a declared `trigger_ref` that doesn't exist is an ERROR; a discovered trigger
artifact (plist, workflow cron, registered hook script) that no entry declares is a WARN.
Vantage rules follow `northstar-lint.mjs`: artifacts in repos or home paths not visible from
the current checkout downgrade to WARNs.

**Liveness.** `scripts/loops-liveness.mjs` (slice S30) reads `cadence:` + `evidence_ref:` and
reports loops whose last-run evidence is older than their cadence allows. Report-only —
paging is F3's rail; restart is nobody's until an ADR-0086 shadow stage says otherwise.

**Field notes.**
- `cadence:` — `always-on` | `daily` | `weekly` | `event` | `manual`. Liveness only evaluates
  `always-on`/`daily`/`weekly`; `event` and `manual` loops have no cadence to breach.
- `evidence_ref:` schemes — `file:<path>` (append/mtime recency), `git-branch:<name>` (last
  commit date), `gh:<repo>:<workflow>` (last workflow run), `dolt:<table>` (row recency),
  `script:<path>` (artifact the script commits), `none` (liveness skips with a logged reason).
- `status: disabled` entries are deliberate parks (kept declared so a future
  operator knows they exist); lint still checks their `trigger_ref` exists.
- Scope: autonomous/event loops and scheduled rails. Pure CI verification gates on PRs
  (ci.yml, northstar-lint.yml, security-scan.yml…) are *verifiers*, referenced in `verifier:`
  fields — they are not registry entries themselves.
