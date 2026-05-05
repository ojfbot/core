# ADR-0068: Agent must follow skill suggestions

Date: 2026-05-05
Status: Accepted
OKR: 2026-Q2 / O2 — engineering-platform durability
Commands affected: all skills (especially the suggestion-driven ones — `/grill-with-docs`, `/validate`, `/hardening`, `/tdd`, `/triage`, `/deepen`, `/recon`, `/spec-review`, `/summarize`, `/scaffold`, `/techdebt`, `/workbench`)
Repos affected: all (rule is user-scope, applies cluster-wide)

---

## Context

The skill-telemetry system has been operating for months but the metrics report consistently shows ~0 skill invocations. On 2026-05-05 a focused audit was run via `/skill-metrics` to diagnose. Findings:

- **Telemetry pipeline is healthy.** End-to-end test: invoking `skill-metrics:skill-metrics` via the Skill tool landed in both `~/.claude/skill-telemetry.jsonl` (as `event: skill:invoked`) and `~/.claude/tool-telemetry.jsonl` (as `tool:used`) within seconds, with correct session_id, skill name, args, repo, cwd, source. The hooks (`log-skill.sh`, `bead-session.sh`, wired in `core/.claude/settings.json` PostToolUse with matchers `Skill` and `Bash`) fire as designed.

- **Adoption is 0.8%.** In the 30-day window: 8 skill invocations against 120 suggestions = **1/120 followed**. Lifetime: 73 raw events.

- **All 5 ADR-defined skill targets at 0:**
  | Target | Goal | Observed | Source |
  |---|--:|--:|---|
  | `grill-with-docs` invocations | 10 | 0 | ADR-0045 |
  | `tdd` invocations | 5 | 0 | ADR-0046 |
  | `deepen` invocations | 3 | 0 | Plan §Success |
  | `triage` invocations | 1 | 0 | Plan §Success |
  | `grill-with-docs → plan-feature` sequencing | 0.5 | 0 | ADR-0045 |

- **Skills with the most ignored suggestions:** `spec-review` (13 ignored), `summarize` (11), `validate` (9), `daily-logger` (7), `scaffold` / `workbench` / `techdebt` (6 each), `recon` (5), `hardening` / `pr-review` / `plan-feature` / `roadmap` / `push-all` (4 each), `setup-ci-cd` / `resume-audit` / `gastown` / `frame-standup` / `grill-with-docs` / `investigate` (3 each).

The bug is **behavioral, not technical.** The agent (Claude) was treating "MANDATORY: Load this skill IMMEDIATELY when..." in skill descriptions as advisory rather than directive, and "[Skill suggestion] Your request matches /X" system reminders as background noise. Raw tools (Bash/Read/Write/Edit) were used directly because they're the path of least resistance.

The cost of this behavior is real: the user designed the system so that each skill loads structured `knowledge/` files, produces standardized outputs, and chains via the suggestion funnel into other skills. Bypassing skills means knowledge files never get consulted, ADR-defined workflows never run, and the suggestion-followed rate metric is meaningless.

## Decision

The agent must invoke a skill when the system reminder offers a matching suggestion, unless there's a concrete reason not to.

The rule is encoded in **`~/.claude/CLAUDE.md`** (user-scope) so it persists across every session on this Mac without per-repo install. Specifically:

> When Claude Code surfaces a skill suggestion via system reminder (`[Skill suggestion] Your request matches /<name>`), invoke the skill via the Skill tool unless there's a concrete reason not to. Doing the work directly with raw tools is the path of least resistance but bypasses the structured outputs the user designed.
>
> Override only when: (a) the user has explicitly told you to skip, or (b) the skill is clearly the wrong fit for the actual task (rare).
>
> "MANDATORY: Load this skill IMMEDIATELY when..." in a skill description is a directive, not a hint.

A companion feedback memory at `~/.claude/projects/-Users-yuri-ojfbot-core/memory/feedback_follow_skill_suggestions.md` captures the same rule + audit numbers.

## Consequences

### Gains
- **Skill workflows actually run.** Invoking `/validate` triggers the spec-coverage + invariants checklist; invoking `/grill-with-docs` produces a CONTEXT.md update + ADR stub. These outputs are what the user built the framework for.
- **Knowledge files actually get consulted.** Skills load `knowledge/` content on demand; if the skill never runs, the knowledge sits unused.
- **ADR-defined targets become achievable.** Instead of all 5 reading 0, observation will reflect actual practice. If targets are still missed, that's a different signal (skills not fitting work, triggers misaligned, etc.) — meaningful in a way that the current 0 isn't.
- **Suggestion-followed rate metric becomes useful.** A 50% follow rate after this rule lands is a real signal of "skills fit"; 5% is "triggers too aggressive"; etc.
- **Sequencing patterns emerge.** When `/grill-with-docs` chains into `/plan-feature` chains into `/scaffold`, that becomes visible in the data and can be tuned.

### Costs
- **Slightly slower for trivial work.** Skills add overhead (read body, follow steps); raw tools are faster for one-off edits. Mitigation: triviality exception is preserved — typo fixes, single-line edits, etc. don't need a skill.
- **Agent must read skill bodies on first invocation.** Each skill's `<name>.md` is loaded to understand its protocol. Marginal context cost.
- **Skill suggestions can mis-fire.** A trigger may match prompt text without the underlying task actually fitting the skill. The rule allows override in this case but agents should default to invocation.

### Neutral
- **The agent's behavior is now visible via telemetry.** Going forward, low follow rate indicates either (a) the agent ignoring the rule, or (b) suggestions over-firing. Both are diagnosable.
- **No code changes ship in this ADR.** Only documentation (CLAUDE.md + memory) and ADR.

## Alternatives considered

| Alternative | Why rejected |
|---|---|
| **Hook-level enforcement (block raw tools when a skill suggestion is active)** | A pre-Skill hook can't *force* skill invocation; it can only block other tool calls. Blocking raw tools when a suggestion is pending would be hostile to legitimate fast paths and create false positives. Memory + CLAUDE.md is the right layer. |
| **Reduce skill count to only the most-used** | Skills with 0 invocations are valuable when invoked — `/grill-with-docs`, `/deepen`, `/hardening` all encode hard-won lessons. The fix is to use them, not delete them. |
| **Accept current behavior; remove the suggestion telemetry** | Defeats the design intent. The user invested in skill infrastructure precisely because raw-tool work doesn't produce the structured outputs needed for cross-session continuity. |
| **Per-repo CLAUDE.md edits** | Less durable than user-scope. The rule applies cluster-wide; user-scope is the right home. |

## Verification

1. `grep "skill suggestion" ~/.claude/CLAUDE.md` returns the new rule.
2. Memory file `feedback_follow_skill_suggestions.md` exists; `MEMORY.md` index references it.
3. After one week of sessions: re-run `/skill-metrics`. Suggestion-followed rate should be > 0.8%. If still flat, the rule isn't taking and we'll need to diagnose (e.g., a follow-up ADR or a hook-level nudge).
4. Targets visibility: at next monthly run, ADR-0045/0046 targets should be moving.

## Related

- ADR-0037 — Skill telemetry and intent matching (the system being measured)
- ADR-0045 — `/grill-with-docs` skill (target: 10 invocations / 30 days)
- ADR-0046 — `/tdd` skill (target: 5 invocations / 30 days)
- ADR-0050 — Skill metrics system (the audit framework)
- `~/.claude/CLAUDE.md` — user-scope rule (canonical location)
- `~/.claude/projects/-Users-yuri-ojfbot-core/memory/feedback_follow_skill_suggestions.md` — feedback memory companion
- `core/scripts/skill-metrics.mjs` — calculator that surfaced the audit
