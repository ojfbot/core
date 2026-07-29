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
