---
id: 20260803-1330-report-vantage-gap-a-b-c-executed-d-awaiting-operator
type: report
title: "Vantage gap: ruling bead written (A), git-vantage lint fix PR'd (B, delta measured 89/42/32 → 29/14/10), conformance sweep PR'd across 5 repos (C, fleet schema errors → 0); D table presented, E untouched"
actor: code-claude
session_id: vantage-gap-execution-2026-08-03
responding_to: 20260803-1200-brief-untracked-bead-ledger-vantage-gap
refs:
  - bead:20260803-1240-decision-frontmatter-repairs-are-edits
  - github:ojfbot/core#377
  - github:ojfbot/core#378
  - github:ojfbot/f1-pit-wall#7
  - github:ojfbot/f1-substrate#5
  - github:ojfbot/silicon-empires#29
  - github:ojfbot/lofi-beaver#3
  - path:core/scripts/bead-lint.mjs
hook: "rm:rm-l2-ojfbot#S33"
status: live
created_at: 2026-08-03T13:30:00-0500
labels:
  project: bead-queue-wiring
---

## What got done

- **A** — operator ruled: frontmatter-only conformance repairs on unchanged prose are
  edits, not supersessions. Captured as `bead:20260803-1240-decision-frontmatter-repairs-are-edits`
  (committed on local main). Closure of live hooks stays explicitly outside the ruling.
- **B** — CI-side vantage measured honestly in a fresh clone before any code change:
  **local 89 beads / 42 open hooks / 32 schema errors across 15 repos vs CI 29 / 14 / 10
  across 1 repo.** The delta is 12 untracked core beads + 14 sibling repos CI can't reach.
  Fix PR'd as ojfbot/core#377: `scanRepo` enumerates via `git ls-files` (index vantage),
  present-but-untracked → WARN and excluded from counts, non-git roots fall back to disk
  with a vantage warn; 5 new vitest cases. Verified: patched local core run and fresh-clone
  run agree exactly (14 / 29 / 10).
- **C** — mechanical sweep under ruling A, prose unchanged everywhere, every edit
  hand-checked: core PR ojfbot/core#378 (6 id→stem rewrites with all referrer
  responding_to/refs links updated in the same commit so no retired hook reopens; missing
  id + open→live on the 20260618 OPAV brief; minimal frontmatter authored for
  adr-0081-loading-discipline-handoff). Sibling PRs: f1-pit-wall#7, f1-substrate#5,
  silicon-empires#29, lofi-beaver#3 (8 frontmatter blocks authored from each file's own
  stated status, 2 prose statuses → live with prose moved to body, 1 id rewrite,
  delivered→closed, techdebt→brief). In-place fixes on untracked files (left untracked
  for D): core 20260803-0015 done→closed + responding_to wired, core 20260730-1310
  responding_to wired, morning-cockpit launchd brief id added + open→live, virtualLight
  s8 report done→closed + in_reply_to→responding_to. **Fleet schema errors after sweep: 0.**

## What's open

- **D (operator)** — track-vs-triage call per untracked file, presented in the session
  transcript. Count is 12, not 11: `20260803-1209-brief-diagram-first-output-work-the-frontier`
  landed 9 minutes after the brief, from the diagram session. Nothing committed.
- **Deferred (blocked on main push)** — two tracked repair targets exist only in unpushed
  local-main commits and could not ride a PR off origin/main without publishing the
  operator's 9 unpushed commits: `20260803-1130-report-newline-sitting6` (done→closed +
  responding_to: 20260803-0200-brief) and `20260803-0140-report-newline-u14-u12-u17`
  (responding_to: 20260803-0020-brief). One-line follow-up after main is pushed.
- **Not wired (needs S33 ruling, not mechanical)** — reports 20260802-2301/2330/2345 only
  reference brief 20260803-0005 which *postdates* them; wiring would be a closure claim.
  Same for 20260802-2145 → 20260803-0230. The 20260729-1233 OPM pickup brief duplicates
  tracked open hook 20260722-2104 (same title) — a track-then-supersede candidate.
- **E untouched** — no hook closed, flipped, or sweep-applied anywhere.

## What surprised

- The vantage delta is dominated by sibling repos (48 of 60 beads), not the 12 untracked
  core files the brief centered on — but only the core 12 are actionable by tracking; the
  sibling gap is inherent CI vantage scoping and stays WARN.
- Authored `status:` values for the 8 no-frontmatter beads transcribe each file's own
  first-line claim ("shipped/MERGED" → closed); the two genuinely-unfinished briefs went
  live and now surface as honest aged hooks (46d, 60d, plus c0-grounding 33d in
  f1-pit-wall) — the enforced open-hook count went *up*, which is the honest direction
  before S33's truth-pass.
