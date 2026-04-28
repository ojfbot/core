# Interpretation guide — observed numbers → recommended actions

The script gives you facts. This file is the bridge from facts to action. When you see a pattern in the numbers, look it up here.

## Pattern: low invocations across the board

**Signal:** Most skills (including new ones) show ≤1 invocation per 30 days.

**Likely causes:**
1. The user (or team) isn't using the catalog — they're typing free-form prompts that don't match any trigger.
2. Triggers are too specific; the user's phrasing doesn't match.
3. Skill names are unmemorable; user defaults to "just describe what I want."

**Diagnostic:**
- Check the suggestion-followed rate. If suggestions are firing but ignored, see "Pattern: high suggested, low followed" below.
- Check `~/.claude/suggestion-telemetry.jsonl` for `skill:no-match` events. High no-match count = the user's vocabulary doesn't overlap with trigger arrays.

**Action:** Pick one underused skill that you genuinely think is useful. Look at recent prompts where it should have fired but didn't. Add 1–2 trigger phrases that match how the user actually asks for that capability.

## Pattern: high suggested, low followed

**Signal:** `Suggestion-followed rate` is below 10%, suggestion volume is high.

**Likely causes:**
1. Suggestions are firing on weak signals — the heuristic is over-eager.
2. Suggestions are firing but not surfaced visibly enough (UX issue, not signal issue).
3. The suggested skill genuinely doesn't apply to most of the contexts where it's suggested.

**Diagnostic:** Look at `per_skill` table. Skills with high suggested count and 0% followed rate are over-suggested. Skills with 0 suggestions but real underuse are under-suggested.

**Action:** For the worst-offending over-suggested skill, raise its tier in `heuristic-analysis.sh` (Tier 1 → Tier 2 → Tier 3) so it's only mandatory when the heuristic is high-confidence. For an under-suggested skill, add a heuristic rule.

## Pattern: high invocations, low sequencing

**Signal:** Skill A and skill B both have decent invocation counts, but the sequencing pair `A → B` rate is below target.

**Likely causes:**
1. Users invoke A and B independently, not in the intended composition.
2. The 1-hour pair window is too tight for the work pace.
3. The composition happens but in the opposite direction (B → A), which our pair-detection doesn't catch.

**Diagnostic:** Re-run with `--pair-window=14400` (4hr) and see if rate jumps. Also check if `--pairs="B,A"` shows non-zero in the reverse direction.

**Action:** If reverse direction is dominant, the ADR's "intended" sequencing was wrong — write a follow-up ADR documenting the actual flow. If timing is the issue, document the wider window in the original ADR. If users skip the composition entirely, the suggested-after chain in `skill-catalog.json` may need revision.

## Pattern: lifetime grows but window is empty

**Signal:** `lifetime: 30 raw events`, `in window: 0`.

**Likely cause:** All telemetry is older than the window. Either (a) the window is too narrow, (b) telemetry isn't being written by the hook, or (c) the user hasn't used skills recently.

**Diagnostic:**
```bash
tail -1 ~/.claude/skill-telemetry.jsonl | python3 -c "import sys, json; print(json.loads(sys.stdin.read()).get('ts'))"
```
If the most recent event is days/weeks old, the hook may not be firing. Check `.claude/settings.json` PostToolUse(Skill) configuration.

**Action:** Verify the hook with a fresh skill invocation; tail the JSONL during the call; confirm a new line appears.

## Pattern: knowledge loads dominate raw events

**Signal:** `lifetime: 30 raw events` but `invocations in window: 6`.

This is normal. The hook records `skill:invoked` events for both user invocations and knowledge-file loads (which fire when a skill loads its `knowledge/<file>.md` JIT). The script filters via `:knowledge:`, `:templates:`, `:references:` patterns.

**Action:** None. Surface the distinction in your report so the reader doesn't think 30 = 30 user actions.

## Pattern: targets fail uniformly

**Signal:** Every target in the targets-vs-actual table shows ✗.

If this is a new system (like the Pocock skills shipped today), this is expected baseline state. Wait for the measurement window to populate.

If this is a system that's been live for a month+, it means the system isn't being adopted at all, and you should:
1. Re-read the ADRs that set the targets — were they realistic?
2. Re-read `agent-defaults.md` — is the default posture being applied?
3. Talk to the user — is there friction making the skills hard to invoke?

**Action:** If the system is new, note "baseline; targets evaluable after the measurement window." If the system is mature and targets are uniformly missed, recommend an ADR to either (a) adjust the targets or (b) restructure the skill UX.

## Pattern: one skill dominates

**Signal:** One skill shows 80%+ of all invocations.

This is usually fine — `/frame-standup` dominating the morning, for example, is the intended pattern. But:

- If the dominant skill is a *meta* skill (like `/frame-standup` or `/init`) and downstream skills aren't picking up, the orchestration isn't dispatching effectively. Check that meta-skill's output flows into downstream skill invocations.
- If the dominant skill is a *terminal* skill (like `/validate` or `/deploy`), the lifecycle's middle is being skipped. People are validating without planning, scaffolding, or testing. That's worth flagging.

**Action:** State which skill dominates and whether the dominance is healthy. If unhealthy, recommend explicitly invoking the missing middle skills next sprint and re-measuring.

## Pattern: zero suggestions, zero invocations

**Signal:** Both telemetry files are empty or near-empty.

The hooks aren't writing. Check:
1. `~/.claude/settings.json` has the `PostToolUse(Skill)` and `UserPromptSubmit` hook entries.
2. Both hook scripts (`log-skill.sh`, `suggest-skill.sh`) are executable (`chmod +x`).
3. The user-level config was actually loaded by Claude Code (sometimes config changes need a restart).

**Action:** Reinstall the hooks via `install-agents.sh` (which has the user-level setup logic). Verify with a single skill invocation that produces a JSONL line.

## When to write a new ADR

If you observe a pattern that recurs across two consecutive measurement windows, that's no longer a one-time blip — it's a system property. Write an ADR documenting:
- What pattern was observed
- What's likely causing it
- What we changed (or chose not to change)
- What we'll measure next window to confirm

Pattern → ADR → measure → action is the loop. Skipping the ADR means the lesson is lost when the next person reads the metrics.

## When to push back on a target

If a target in `TARGETS` (in `skill-metrics.mjs`) has been missed in 3+ consecutive measurement windows AND adoption seems healthy by other signals, the target was likely set too high. Don't quietly lower it — write an ADR proposing the new target with rationale, supersede the relevant ADR's claim, and update `TARGETS` only after the ADR is accepted.

## What this guide is not

This guide doesn't tell you what to *think* about a number. It tells you what action a number suggests. Interpretation requires reading the actual context: which user, which work, which pace.

The measurement loop is: **observe → interpret → act → re-measure**. This file helps with the act step. The interpret step is yours.
