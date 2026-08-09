# Implementation notes

Working notes for in-flight work in `core`. The `## Deviations` section is read by
`scripts/hooks/deviation-log.mjs` (Stop hook) — see adr:harness-loop-instrumentation.

Log the gap between plan and reality, not routine choices the plan already covered.
The count is a **discovery rate, never a defect rate**: more entries is better.

## Deviations

- D39 (`decisions/adopt-stack/pocock-skills-v1-2.md`, branch feat/pocock-v1-2-absorb) marked the /wizard build deferred but, unlike its D37/D40 siblings, never specified the skill's scope. Territory: both first use cases named in the record (buddy-check `aws sso login`, selfco Pi deploy keys) live outside core, so a core-only skill could not fire where it is needed. Took the consistent-with-siblings option: `scope:["user"]` in the catalog, matching wait-what and to-questionnaire; needs `install-agents.sh --user-scope` after merge to sync the symlink.
- Shape Up vault ingest, sitting 1 (2026-08-03): plan cited `templates/article-ingest.md` at
  `core/.claude/skills/vault/templates/`. Territory: it exists **only** in the vault at
  `~/selfco/templates/article-ingest.md` — the core skill's `templates/` ships
  source/entity/concept/synthesis but not the article variant, so a fresh `/vault init` on another
  machine would scaffold a vault whose schema names a template it cannot produce. Took the
  conservative option: used the in-vault copy, changed nothing in core. Suggests the article
  variant should be added to the skill's templates and seeded by `init-vault.py`.
- Shape Up vault ingest (2026-08-03): plan had `scripts/ingest.py` land the raw file and stub the
  source page. Territory: `ingest.py`'s generic URL path curls a single URL and writes the **raw
  HTML** verbatim — for a 23-section book that is 23 unreadable blobs, and there is no
  HTML→markdown converter on this machine (no pandoc/lynx/html2text/bs4). Took the conservative
  option: a scratchpad-only assembler that extracts `<div class="content">`→`<nav>` per section
  and writes ONE archival markdown file, then landed it by hand and hand-authored the source page.
  Nothing was added to the vault or to core. Suggests `ingest.py` needs an HTML→text step for
  article ingests generally, not just this one.
- Shape Up vault ingest (2026-08-03): plan's verification said `lint.py --gate` exits 0. Territory:
  it exits 1, on **two pre-existing** unfiled `raw/inbox/` drops landed by the selfco-box transport
  (commits `ff9c94a`, `0c27088`) that have no `wiki/sources/` page. Not caused by this ingest — my
  raw file is filed and adds 0 broken links, 0 orphans, 0 schema findings. Took the conservative
  option: reported it and left the inbox items alone rather than filing someone else's drops to
  make a number green. Note the gate is on selfco-box's own push path, so its pushes are currently
  gated too.
- Shape Up vault ingest (2026-08-03): `/vault`'s documented commit step is `git add -A && git
  commit`. Territory: the vault tree had four unrelated uncommitted files, so `add -A` swept them
  into the ingest commit `2a4ea7c` under a message that doesn't describe them. Inspection showed
  they were **finished work, not stray WIP** — the 2-line `CLAUDE.md` edit is the `diagrams/` +
  `teach/` schema rows that `adr:teach-corpus-deposit-architecture` R7 calls for, and the
  `.handoff/` file is a completed Cowork handoff — so reverting them would have been wrong; only
  the message was defective. Resolved at operator instruction: pushed
  `backup/pre-split-2a4ea7c` first, soft-reset, rebuilt as four accurately-messaged commits
  (`5fc4497` schema rows · `877e93f` diagrams · `a5df9ae` handoff bead · `02515a1` ingest),
  verified the tree byte-identical to `2a4ea7c`, then force-pushed with
  `--force-with-lease` pinned to the exact expected SHA. Safe because the commit was still the
  tip of `origin/main` with zero divergence; other clones (selfco-box poll timer) may need
  `git reset --hard origin/main` on their next pull.
  **Standing side effect, unaffected by the split:** the two `diagrams/` files are exactly the
  ones `draft-teach-corpus-deposit-architecture.md` cites as evidence — "2 files, untracked,
  0 ledger rows" — for why prose-only deposit fails. They are now tracked, so that measurement no
  longer reproduces as written; the ruling's *argument* stands (0 ledger rows is still true) but
  its cited numbers are stale.
  Root cause unfixed: `/vault`'s commit step should stage explicit paths, not `-A`.
- teach-in-the-loop #380 work session (2026-08-03): plan had `gh pr merge --rebase --delete-branch`
  finishing cleanly from the session worktree. Territory: `main` is checked out by ANOTHER
  session's worktree (`…/50e6dcf3…/scratchpad/core-main`), so gh's post-merge local checkout of
  main failed (`fatal: 'main' is already used by worktree`) — the remote merge itself had already
  succeeded (PR #388, `31623ea`). Took the conservative option: verified merge state via the API,
  removed my worktree, touched nothing of the other session's. Rule of thumb: with concurrent
  core sessions, treat gh's local post-merge steps as best-effort and verify remotely.
- teach-in-the-loop charting (2026-08-03): plan assumed branching from local `main` = branching from origin/main. Territory: local main carried 3 unpushed bead commits from a concurrent session, so PR #387 silently dragged ~850 lines of another agent's beads and all three merge methods failed (repo allows rebase-merge only; branch unrebaseable). Took the conservative option: `rebase --onto origin/main` to isolate my 2 commits, force-with-lease on my own branch, merged clean. The other session's commits remain untouched on local main (its worktree owns them). Rule of thumb this suggests: branch wayfinder/decision work from `origin/main`, not local main.
- skill-hardening (2026-08-03): plan assumed suggester frozen-holdout κ baseline 0.700
  (memory value, at-freeze); fresh suggester-eval.mjs run against the 68-skill catalog
  reads holdout κ=0.603 (overall 0.658). Took the measured value as the Wave-2 eval gate
  and recorded the correction in decisions/skill-hardening-roadmap.md.
- Plan specified registering the harnesses in `decisions/loops/loops.md` with `trigger: harness-routine`, on the basis that the value already existed. Territory: `loops-lint.mjs` defines `TRIGGERS = ['launchd','gh-actions','hook','watchpath','manual']` — `harness-routine` appears only in the aspirational deliverable prose of `rm:rm-l2-ojfbot#S29` and was never implemented, so authoring against it would have ERRORed. Took the conservative option: `trigger: hook`, which is both valid and more accurate since these are literally hooks. No schema change needed.
- Plan hypothesised that `acted ≈ 0` was caused by `log-skill.sh` being registered only at project scope, and pre-authorised registering it at user scope. Territory: `suggest-skill.sh:228` already injects the complete `skill-acted-emit.mjs` command with the live `suggestion_id` into every single suggestion — the agent is told every time and does not comply. The gap is agent compliance, not wiring. Took the conservative option: did not register the hook, recorded the finding in the ADR instead, since registering it would have implied a fix that wasn't one.
- Plan offered "relax Step 5 so grill-with-docs may write CONTEXT.md under confirmation" as a candidate resolution. Territory: in every sibling repo `domain-knowledge/CONTEXT.md` is a *symlink into core*, so any repo-local session writing it mutates fleet-shared state. Took the conservative option: gave the skill a new repo-local artifact it owns (`decisions/open-unknowns.md`) rather than loosening a constraint that exists for a good reason.
- Plan specified H8 Stage A as a `PreToolUse` hook on `Bash`. Territory: user-scope `PreToolUse(Bash)` fires synchronously on *every* Bash call in *every* session, so installing the `.mjs` directly would spawn node fleet-wide for a signal needed only on merges. Took the conservative option: added `merge-quiz.sh`, a bash prefilter that rejects non-merge commands in ~4ms, and installed that as the hook entry instead.
- Plan's S0 assumed the `EXPECTED_ARTIFACT` audit would mostly confirm entries. Territory: `investigate` names an exact artifact path in its own SKILL.md but had no `pathPattern`, so any file written in-session satisfied it; `validate` declares `scheme: 'path'` while its SKILL.md says "No auto-fixes — findings and verdict only", i.e. the same unreachability as grill-with-docs. Fixed the evidenced one (`investigate`), and surfaced `validate`/`plan-feature` as annotated ambiguities rather than guessing — the file's own docblock requires surfacing over guessing, and resolving them changes what those skills are.

## Deviations — /wayfinder user-scope promotion 2026-07-31

- Plan listed `scripts/lib/northstar-fm.mjs` under "reused rather than rebuilt" and assumed slug lookups against the registry would just work. Territory: `scalar()` does not strip YAML inline comments, so `README.md:39` (`slug: buddy-check   # NB: …`) parses as a 91-char slug. `northstar-lint.mjs` reports 19/19 present because it resolves entries by `path`; `resolve-anchor.mjs` is the fleet's first slug-keyed consumer, so it is the first thing to see the bug. Fixing `scalar()` looked like the clean repair until the corpus scan: `roadmap-l2-ojfbot.md:301` carries `title: "Calibrate judge #1 — …"` and several `entrance`/`deliverable` values cite `PR #165`, so a naive `\s+#.*$` strip would truncate live roadmap slices and break an operational CI gate. Took the conservative option: scoped the strip to slug comparison inside the new script (kebab slugs can never legitimately contain " #"), left the shared parser untouched, and filed `decisions/defects/dr-northstar-fm-inline-comment-not-stripped.md` (`repair-mechanism`, quote-aware strip) rather than absorbing it silently.

## Deviations — GOLF UMBRELLA landing 2026-07-30
- Landing prompt placed the fairway itinerary row in "Leg 4"; disk itinerary has Leg 3 as the golf-only leg (2026-07-02 decision) and Leg 4 as GameWorld — rows landed in Leg 3, discrepancy noted in-row and in core#298.
- Plan assumed the reference sweep could ride PR-1; gcgcca references live in four other repos, so the sweep distributed across core#297, mirrorworld#11, daily-logger#259, morning-cockpit#41.
- daily-logger's sweep list turned out to live in src/collect-context.ts (code, not the README prose) — the rename would have silently dropped the repo from the nightly sweep; fixed in daily-logger#259.
- Sitting's gcgcca git-state snapshot (push-u needed, 7 dirty) was stale by landing time — PRs #3/#4 already merged, main clean; the push-u step was dropped as obsolete.
- RFI §6.2 "code-side Notion unauthenticated" is stale — read access works; found no mirrorworld itinerary row and stale property-subset framing on the Notion golf pages (flagged for chat-side refresh in core#298).
- S32 bead-lint (2026-08-02): plan assumed fleet roots derive from the northstar/roadmap
  registries; territory had 15 repos with .handoff/ vs 9 registry-derived (mirrorworld,
  capture-agent, lofi-beaver et al. unregistered-or-unlinked). Went conservative-wide:
  added sibling-of-core .handoff/ enumeration (matches the cockpit adapter's glob) so the
  debt is not under-counted.
- S32 bead-lint (2026-08-02): plan had machine keys parsed from structured hook:/refs:
  frontmatter; parseFM only list-parses registry keys, so refs: items were dropped.
  Switched to a raw-text scan of the frontmatter block.
- #386 HTML lesson spike (2026-08-03): ticket asked for 2–3 lessons to judge four things —
  authoring effort, side-panel fidelity, **stylesheet reuse**, and HTML-vs-Markdown. Operator
  scoped the session to ONE lesson. One lesson cannot demonstrate reuse across lessons, so
  that dimension is recorded UNVERIFIED rather than silently claimed; the other three are
  measured. #391 (second-surface probe) is the natural place reuse gets its first real test,
  since it inherits the same stylesheet.
- #386 render-path probing (2026-08-03): first attempt used an iframe `srcdoc` to simulate a
  renderer with no directory origin. `srcdoc` inherits the parent document's base URL, so the
  external stylesheet resolved and the test passed when it should have failed. Re-ran with a
  real navigation into a directory with no `assets/` sibling (HTTP 404) — that reproduced the
  condition and produced the verdict. Noting because the false pass looked entirely convincing.
- skill-hardening Wave 1b (2026-08-03): the sprawl-≤15 TPM was not reachable from the brief's
  worklist alone — three gate/contract-heavy skills (grill-with-docs 1456w, gated-slice 1243w,
  tdd 969w) bottom out above 800 because Gotchas + Constraints + inline gates alone exceed the
  threshold; two of the brief's "remaining D4 fails" (claude-md-rollout, day-run) had no honest
  reference content to move (pure step-skeleton). Conservative path taken: disclosed two
  non-D4-fail D8 offenders instead (deepen 1332→770, diagram-intake 1005→709) to reach sprawl=15
  without touching gate-skill contracts, and left the two skills as the ≤3 allowed D4 fails.
  Territory lesson: a Gotchas-heavy gate skill has a sprawl floor the threshold doesn't model.
- /teach first real invocation (2026-08-04): plan assumed #386's finding held — "inline quiz JS
  survives; presentation is the fragile part." Territory: that was measured in a **browser**. The
  side panel renders a lesson as a static snapshot, so the inlined CSS applies and the script never
  runs; the operator reported lesson 0001's quiz buttons doing nothing. In the surface the map's
  Destination actually names ("rendering in the side panel as routinely as SVG diagrams"), the
  finding is inverted. Took the conservative option: rebuilt the quiz on radio inputs + `:checked`
  (zero JS, works in side panel / browser / Obsidian attachment / print) and recorded the
  measurement in `lesson-format.md` rather than leaving #386's conclusion to be re-applied by the
  next lesson. #386's *stylesheet* conclusion is untouched and still correct.
- /teach first real invocation (2026-08-04): plan had one deposit per lesson. Territory: correcting
  a deposited lesson has no path — re-running `deposit.mjs` appends a second
  `harness:lesson-deposited` row and a second `teach/index.md` line for the same topic, so the index
  now double-lists one lesson. Took the conservative option: re-deposited anyway (silently mutating
  a deposited artifact is worse than a noisy index, and two writes did happen), and logged the gap
  rather than hand-editing the corpus. Suggests the deposit needs a supersession path — same
  question D21 already answers for *records* (supersede, never delete) and which the corpus
  architecture did not carry over to lessons.
- /teach second invocation (2026-08-04): plan followed D24's `reference/*.html`. Territory: the
  deposit silently dropped a markdown reference — `classifyArtifacts` filtered references to `.html`,
  so a dry run reported "1 lesson" and no reference, with no error. Two problems, not one: the filter
  was too narrow, AND the convention was wrong for this fleet. D24's own argument (lessons are read
  once, references get revisited) decides the format by where it gets reopened — the vault — and
  Obsidian will not render standalone `.html` as a page, so an HTML reference is an attachment you
  must bounce to a browser. Took the conservative option: markdown is now the default for
  references, `.html` still accepted for genuinely print-quality cheat-sheets, documented as a
  deliberate divergence (same class as D25) rather than a bug fix. Note the silent-drop shape is the
  same failure the deposit architecture exists to prevent — an artifact vanishing with nothing
  emitted; the reconciler would not have caught it because the lesson still deposited.

## Deviations — frame-standup ledger closure 2026-07-25 / 2026-07-31

- Plan said "accept `adr:consume-dive-briefing-retriever` (Stage 2d) to unblock f1-doctrine S2". Territory: that ADR decides S2's wrap-vs-re-port question and is half of S2's own entrance criterion — accepting it is an architectural decision, not standup bookkeeping. Took the conservative option: accepted only the three ADRs whose code had already merged (0001–0003), left this one `Proposed`, and queued the decision as `hq-task-b71519d5`. S2 stays `queued`.
- Plan said "flip `rm-l1-silicon-empires#S7` `queued → ready`, entrance is met". Territory: entrance *is* met, but roadmap-lint immediately reported `moves_from 5 drifts from ns:l1-silicon-empires#P4 live current 42%` — S7–S18 are one continuous P4 ladder 5→95 authored when P4 was 5, and the backfill this same session moved P4 to 42. A +37 rebase terminates the ladder at 132, so it is a replan, not arithmetic. Took the conservative option: reverted S7 to `queued` and queued the replan, because dispatching would have proposed a false "P4 5→12" into the ledger the session existed to correct. Flagged the stale `sili-task-c94cf64f` projection from the brief `ready` window.
- Plan assumed `record-movement` without `--apply` was a dry run (its docstring: "Default prints the exact edits instead"). Territory: `--apply` gates only the *file patches*; the `status.jsonl` append happens either way, so the "preview" wrote a real ledger line. Took the conservative option: reverted the file and re-ran once with `--apply`, and filed the docstring/behaviour mismatch under TD-008 rather than leaving a duplicate.
- Plan predicted the roadmap-lint warning count would drop as the 13 silicon-empires file-status drifts resolved. Territory: it went 60 → 63, because Stage 0 also made two previously-unreachable roadmaps resolve (11/179 slices → 13/195). The prediction was not falsified, it was unmeasurable as stated. Verified the specific drifts cleared by grepping per-roadmap instead of trusting the total.
- Plan filed the two techdebt entries as TD-006/TD-007. Territory: six days elapsed between authoring and merge, and a concurrent session landed its own **TD-006** (bead-ledger closure loop, core#290) in the meantime. Took the conservative option: renumbered to TD-007/TD-008 at rebase, keeping their TD-006 and leaving no gap. Sequential IDs in a shared file are a collision waiting to happen whenever a PR sits.

## Deviations — wayfinder #320 FDE re-audit (second cycle) 2026-08-01

- Plan said "file findings to `decisions/research/2026-08-01-fde-deliverables-audit.md` (via PR), post a resolution comment on #320, close it, append a gist to the map." Territory: a concurrent session worked the same ticket and got there first — PR #332 merged that exact path to `origin/main` at 19:39Z (mid-cycle, ~22 min into this session's sweep), closed #320, and appended its own gist. Three of the four instructed steps were already done by someone else. Took the conservative option: did **not** overwrite the merged file, did **not** reopen or re-close #320, did **not** re-edit `## Decisions so far`. Filed the independent cycle as a companion at `…-cycle-2.md` via its own PR (human-gated, so the operator decides whether it lands or gets reconciled into one file — §9 Q1), and commented on the closed ticket instead of reopening it. Two concurrent sessions on one wayfinder ticket is the failure mode "claim = assignment" exists to prevent; assignment was set here before any work, so the guard did not hold — the other session assigned the same bot account.
- Plan assumed the audit was purely read-only against the fleet. Territory: it was, but the *reading* surfaced a live disclosure exposure — employer + internal-system names on public `origin/main` in 9 files, while the ticket that governs exactly that (#321) is still OPEN, and the merge that added two of those files landed 39 minutes after #321 was opened. Took the conservative option: verified the grep myself rather than trusting the sub-agent, reported it as the top finding, and did **not** edit the strings out — #321 is a grilling ticket and the ruling is the operator's, not an agent's. Flagged the untracked `core-library/public/graph/selfco.json` as an adjacent one-`git add -A`-away hazard.
- Plan treated the sub-agent fleet sweeps as the evidence base. Territory: the completeness critic caught three verifiable errors in this cycle's own grading pass (profile README "GitHub Pages" claim false; "40 ADRs" is 34 against an actual 111; 3 public forks is 4). Took the conservative option: re-verified each against disk myself, published the corrections in §6.2 of the findings rather than quietly fixing the prose, and marked the unverified article counts as unverified instead of dropping them.
- (#345 session, 2026-08-01) Plan said `gh pr merge --rebase --delete-branch` then verify. Territory: the remote rebase-merge succeeded (PR #357 → `c63de2b`), but gh's local post-merge step (checkout main + pull) failed on another agent's unstaged working-tree changes and left the checkout on a stale main. Took the conservative option: verified the merge against `origin/main` directly, left local main and the foreign unstaged edits untouched (concurrent-agent git safety), and proceeded with ticket ops. Also: plan pre-wrote the sanitization ticket as "#353" into the map before creation; actual number came back #356 — issue numbers aren't reservable, so create-then-reference is the right order (fixed pre-commit, no harm).
- 2026-08-02 fde-skills-audit session: plan assumed the audit artifact would go up as a branch+PR; personal-knowledge/ turned out to be gitignored (denylist source side of adr:employer-evidence-boundary), so fde-job-target.md is local-only and the tracked record is the report bead. Took the conservative option (no force-tracking).
- 2026-08-02 fde-skills-audit session: plan assumed the #321 denylist lint exists and would gate the artifact; no lint script exists on disk or any branch. Fell back to manual grep of outputs (clean). Lint implementation is an unclaimed prerequisite, flagged in the report bead.
- 2026-08-03 vantage-gap execution session (brief 20260803-1200): plan step D said "the 11" untracked beads; territory at Step-0 verification was 12 — a diagram-first-output session dropped `20260803-1209-brief-diagram-first-output-work-the-frontier.md` nine minutes after the brief was committed. Took the conservative option: kept it in the D triage table flagged post-brief, touched nothing.
- 2026-08-03 vantage-gap execution session: plan said all C repairs go up in the PR; two tracked repair targets (`20260803-1130-report-newline-sitting6`, `20260803-0140-report-newline-u14-u12-u17`) exist only in unpushed local-main commits, so a branch off origin/main cannot carry them and a branch off local main would publish the operator's 9 unpushed commits ("do not push"). Took the conservative option: deferred those two fixes (status done→closed on 1130; responding_to wiring on both), flagged in PR #378 and the report bead.

## Deviations — core decomposition S1 2026-08-08

- 2026-08-08 (decomposition S1, fleet reconciler): the plan assumed building from the local core
  checkout; territory showed local main diverged (16 ahead / 1 behind origin) with concurrent agent
  worktrees active. Took the conservative option: built on a fresh worktree cut from origin/main,
  leaving local main untouched.
- 2026-08-08 (decomposition S1): full vitest suite shows 3 pre-existing failures
  (skill-acted-emit ×3, reconcile-skill-acted) when run from an isolated worktree outside ~/ojfbot;
  the same tests pass in the installed checkout. Vantage assumption in those tests, not S1 breakage —
  S1 adds files only and none are imported by the failing tests. Logged rather than fixed here to
  keep the slice single-purpose.

## Deviations — /wayfinder neistat-ai-bulletin 2026-08-08

- **Plan assumed** full-mode charting ends at Step 4 by projecting tickets as GitHub child issues
  into `ojfbot/core`. **Territory:** `ojfbot/core` is public (`isPrivate:false`), and the vault's
  own `concepts/camera-program.md:65` carries an *unruled* open question about whether the Camera
  Program / Bulletin lineage should be publicly visible at all (gaps G-02/G-05/G-06). Projecting
  would have answered that question as a side effect, and would have published the operator's
  ruling that paid Patreon material is being archived. **Took the conservative option:** wrote the
  map file only (uncommitted), projected nothing, and charted the disclosure question as the
  map's first frontier ticket. Two sibling maps (`cockpit-northstar-conversation`,
  `teach-persistence`) are likewise untracked, so an uncommitted map is not a novel state.
- **Plan assumed** a full-mode map carries a `northstar:` anchor. **Territory:** no
  `camera-program` northstar exists (the program has no repo — gap G-03) and none of `l1-core`'s
  P1–P5 skill-loop properties fit a practice-and-vault initiative. **Took the conservative
  option:** omitted the anchor per resolve-or-fail and said so in the Destination, rather than
  forcing a bad fit to satisfy the schema.
- **Plan assumed** one wayfinder ticket per work session. **Territory:** the operator asked to be
  worked through the next steps, and both frontier tickets (#423 disclosure seam, #426 scheduler)
  were HITL rulings needing them present anyway — deferring the second would have stalled on a
  question already answerable. **Took the conservative option:** worked both, but resolved each
  fully and separately (claim → evidence → operator ruling → resolution comment → map tended)
  rather than batching them into one blended decision.
- **Plan (the chart) assumed** the Pi's single-scheduler posture blocked adding a scheduled
  authoring run. **Territory:** verification showed the posture is scoped to selfco-box
  (`com.ojfbot.selfco-box.*.plist.disabled`) while four unrelated fleet plists stay enabled, and
  that the Pi's timer is an *LLM-free* transport pass (`transport --once`, Notion inbox →
  `raw/inbox/`), which is why it holds no Anthropic key. The chart-time constraint was overstated.
  **Logged rather than silently corrected**, and the map's Notes now record the verified state —
  memory-sourced constraints in a chart need verifying before they shape a ruling.
## Deviations — core decomposition S2 2026-08-08

- 2026-08-08 (decomposition S2, personal exile): the brief stated the destination
  `~/selfco/career/` was already gitignored. Territory: `~/selfco` is a *tracked* git repo
  (private, `ojfbot/selfco`) and `career/` was not ignored, so the move as specified would have
  taken career material that was gitignored in core and put it somewhere git-visible — inverting
  the disclosure seam the slice exists to protect. Took the conservative option: added `career/`
  to `~/selfco/.gitignore` **before** moving, so the destination matches the brief's stated
  property. That is a second-repo write; it is committed locally in selfco and left unpushed for
  the operator.
- 2026-08-08 (decomposition S2, fleet symlink cleanup): the plan assumed removing the now-dead
  `personal-knowledge/tbcony-job-target.md` symlink from every sibling repo. Territory: 6 of the
  29 repos (frame-ui-components, hailstone, lean-canvas, mirrorworld, seh-study, workstation-yuri)
  have that symlink **git-tracked**, so deleting it there needs a commit in each repo — outside
  this slice's one-PR rule. Took the conservative option: left all 6 untouched and reported them
  as follow-up work rather than dirtying 6 sibling working trees.
- 2026-08-08 (decomposition S2, fleet symlink cleanup): removal of the 23 *untracked* sibling
  `personal-knowledge/` dirs was blocked by the harness permission classifier (bulk cross-repo
  deletion). Not worked around. The dead symlinks remain on disk pending operator approval of a
  single explicit command; the installer no longer recreates them, so this is a one-time sweep.
- 2026-08-08 (decomposition S2, attic): two `check:` expressions in
  `decisions/northstar/roadmap-l2-ojfbot.md` (S27, S28) `test -f` the audit docs at their old
  repo-root paths and now point at nothing. Both slices are already `merged`, so these are post-hoc
  checks on delivered work, not live gates. Took the conservative option: left
  `decisions/northstar/` untouched per the hard rule and recorded the stale paths in
  `docs/audits/README.md` plus the PR body.
- 2026-08-08 (decomposition S2, dead structure): `.claude/worktrees/brave-lumiere-f43c8c` was to be
  removed. Territory: its branch `claude/gifted-lamarr-05695a` holds 12 commits not contained in any
  remote branch **and** 4 uncommitted modified files (`FilesystemBeadStore.ts`, 2 test files,
  `implementation-notes.md`). Per the brief, reported rather than forced — worktree left in place.
- 2026-08-08 (decomposition S2, install-agents §5): the brief offered retarget-or-drop for the
  job-doc distribution phase. Dropped it. Evidence: §5 distributed exactly one file
  (`tbcony-job-target.md`, last edited 2026-02-27 and superseded by `fde-job-target.md`) into 30
  repos, no skill or script ever read it at that path, and the resulting sibling
  `personal-knowledge/` dirs contained nothing else. Retargeting would have re-exported career
  material to 30 code repos for no consumer.
- 2026-08-08 (decomposition S2, dead structure): the brief classed `runs/` as a dead empty dir to
  delete along with its gitignore entry. Territory: `runs/` is a **live runtime output directory** —
  `writeRun()` in `packages/workflows/src/utils/runs.ts` is called by `runner.ts` on every workflow
  dispatch and creates `runs/<workflow>/<timestamp>/`. The empty dir was just an unused checkout,
  not dead structure. Took the conservative option: deleted the empty dir but **kept** `runs/` in
  `.gitignore` (with a comment naming the writer), so run outputs can never be committed.

## Deviations — maintenance-patrol bead-store flake fix 2026-08-03 (salvaged 2026-08-08)

Recovered from the abandoned `claude/gifted-lamarr-05695a` worktree, where this work sat
uncommitted while its 12 bead commits went stale (all their files reached main by other routes).
Entries preserved verbatim from that session's ledger; the code they describe ships in this PR.

- 2026-08-03 maintenance-patrol flake fix: plan proposed "use recursive removal (`fs.rm(dir, {recursive: true, force: true})`)" as a candidate fix. Territory: every affected `afterEach` already used recursive+force — `force` does not help, because `ENOTEMPTY` is a live write landing between rm's `unlink` of `events/<date>.jsonl` and its `rmdir` of `events/`, not a leftover file. The real gap was `FilesystemBeadStore.appendEventLog()` being fire-and-forget, whose fix (`drainPendingWrites()`, commit 4ca3aae, 2026-05-04) was applied to only 2 of 10 test files that mkdtemp+rm a beads root. Took the conservative option: extended the existing convention to the 8 files missing it rather than changing production I/O semantics (awaiting `appendEventLog` inside create/update/close would remove the per-file discipline entirely, but widens blast radius beyond a test-flake fix). Recurrence signal: the same defect re-entered the codebase 8 times because the fix lives in per-file teardown that new tests must remember — candidate for a shared temp-store test helper.
- 2026-08-03 maintenance-patrol flake fix (supersedes the entry above): operator elected the store-side fix on review. `FilesystemBeadStore.create/update/close` now `await this.appendEventLog(...)` instead of fire-and-forget; the `pendingWrites`/`trackWrite`/`drainPendingWrites()` machinery and all test-side drain calls are deleted, so the race is gone by construction rather than by per-file teardown discipline. Confirmed no consumer of `drainPendingWrites()` outside the package before removing it. Locked in with three `event log durability` tests in bead-store.test.ts, negative-control verified (reverting to `void this.appendEventLog(...)` fails 2 of them). Cost of awaiting measured as nil: full suite 3.59s vs 3.67s baseline.
- 2026-08-08 (salvage): the superseded entry above says "all 10 test-side drain calls are deleted". Territory on `origin/main`: only **2** test files ever carried a drain call (`bead-store.test.ts`, `prime-node.test.ts`) — the 8 added by that session's first approach were never committed. The salvaged diff removes exactly those 2, which is consistent with main. Logged so the "10" is not read as missing work.

## Deviations — core decomposition S3 2026-08-08

- 2026-08-08 (decomposition S3): the plan was to move all 26 domain-knowledge files into
  `universal/` + `apps/` and rewrite the ~77 core files that reference them. Territory: skills are
  symlinked into all 30 sibling repos and read `domain-knowledge/<file>.md` **flat** — that is the
  contract in every consuming repo, and core is itself a consumer. Rewriting skill references to
  subdirectory paths would have broken every skill in every sibling repo; leaving them flat would
  have broken them in core. Took the conservative option: sources moved into the subdirectories,
  and core keeps the flat view via 26 tracked symlinks into `universal/`/`apps/` — the same flat
  layout the installer creates everywhere else. No reference rewrite was needed, so the diff is the
  move plus the manifest rather than an 80-file path churn.
- 2026-08-08 (decomposition S3): the plan treated the manifest as pure refactoring. Territory: it
  surfaced a live bug — `coding-standards.md`, `diagram-conventions.md`, and `opm-modeling.md` are
  read by fleet-distributed skills (`/tdd`, `/pr-review`, `/diagram`, `/doc-refactor`,
  `/skill-loader`, `/vault`, `/opm`) but were **never in the installer's UNIVERSAL list**, so all
  30 sibling repos pointed at missing files; `coding-standards.md` even declares itself "read... in
  any ojfbot repo" in its own first line. Verified empirically in blogengine before fixing. Added
  all three to `universal`, which widens what ships fleet-wide — logged because that is a
  distribution change, not just a move.
- 2026-08-08 (decomposition S3): four files were in `domain-knowledge/` mapped to nobody —
  `corereader-ux-research.md`, `shell-mayor-spec.md`, `shell-mf-integration.md`,
  `daily-cleaner-staleness-spec.md`. Attributed them from their own headers (core-reader, shell ×2,
  daily-logger) and mapped them in the manifest, so `core-reader` and `shell` now receive app docs
  they never got. Flagged rather than silently dropped.
- 2026-08-08 (decomposition S3): deleting the `case "$REPO_NAME"` switch made the S1 reconciler
  report its `install-agents-archdocs` surface as UNPARSED — the reconciler working as designed.
  Retargeted that surface to `domain-knowledge/manifest.json` (`parseInstallCaseSwitch` →
  `parseDomainKnowledgeManifest`) and updated its fixture and tests, rather than leaving a surface
  that silently reads nothing.
