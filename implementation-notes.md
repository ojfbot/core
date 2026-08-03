# Implementation notes

Working notes for in-flight work in `core`. The `## Deviations` section is read by
`scripts/hooks/deviation-log.mjs` (Stop hook) — see adr:harness-loop-instrumentation.

Log the gap between plan and reality, not routine choices the plan already covered.
The count is a **discovery rate, never a defect rate**: more entries is better.

## Deviations

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
