# ADR-0082: Subagent strategy — default to skills + native delegation; `.claude/agents/` deferred

Date: 2026-06-04
Status: Accepted
OKR: [Q2 / workflow-engine hygiene]
Commands affected: /council-review, /pr-review, /orchestrate, install-agents.sh
Repos affected: core (canonical agents/), cv-builder (.agents/ + 3 subagents), all repos (distribution)

---

> Developed via `/grill-with-docs` on 2026-06-04 from the Newline "Setting Up Claude Code" config audit (`~/selfco/wiki/synthesis/newline-setup-vs-ojfbot-claude-config.md`). **Key finding of the grill: all three justifications for a defined subagent are *theoretical* for the fleet today** — so this ADR ratifies the *rubric* and deliberately defines **zero** subagents. It is a "why we don't (yet)" decision.

## Context

The fleet has invested heavily in **skills** (47 in core) and **hooks** (16 scripts), but barely in **subagents**: only `core` defines one (`queued-prompt-executor`) and `cv-builder` three. The Newline lesson teaches `.claude/agents/` as a first-class power feature for three jobs: (1) **tool isolation** (a reviewer with `tools: [Read, Grep, Glob]` that physically cannot write), (2) **cheaper-model delegation** (run a simple pass on Haiku), (3) **context isolation** (keep a large analysis out of the main session). Its canonical example is a read-only `code-reviewer` subagent.

Three other things look like "delegate to a sub-process" and get conflated:
- The **Agent tool's native delegation** — the main agent spawning a subagent ad hoc (`subagent_type`: Explore, Plan, general-purpose). Already available, needs no committed artifact, and already quarantines the subagent's transcript from the main context.
- cv-builder's **`.agents/registry.json`** — programmatic NL/event-triggered automation (a *different* system; see core `CLAUDE.md` § "The `.agents/` system").
- **`/orchestrate` + the `@core/workflows` engine** — deterministic multi-agent fan-out/control-flow.

There was no written rule for which to reach for.

## Decision

Adopt a **default-deny subagent rubric**. In priority order:

1. **Default — a `Skill`** (`.claude/skills/<name>/SKILL.md`) for any reusable, interactively-invoked workflow with full tooling.
2. **Native `Agent`-tool delegation** for a one-off sub-task or to keep a large sub-analysis out of the main context. No artifact to define; the result returns, the transcript does not.
3. **The workflow engine / `/orchestrate`** when you need *deterministic* multi-step, multi-agent control-flow (loops, barriers, structured-output fan-out across many agents).
4. **A *defined* `.claude/agents/` `Subagent`** — adopt one **only** when you can name a concrete, *experienced* need for one of three guarantees that 1–3 cannot give:
   - **Tool-isolation** — an auditable can't-write guarantee (stronger than a told-not-to-write skill);
   - **Model-downgrade** — a cost win a skill / `callClaude({model})` cannot already express;
   - **Hard context-isolation** — beyond what native `Agent`-tool delegation already provides.

   **As of 2026-06-04 all three are theoretical for the fleet → we define ZERO `.claude/agents/` subagents.** The grill confirmed the headline trigger (tool-isolation) is not load-bearing: `council-review`/`pr-review` have not edited code mid-review, and the other two triggers are already covered by skills' model selection and native delegation respectively.

5. cv-builder's `.agents/registry.json` is a **separate system** (event/NL-triggered automation), **never** a Claude Code subagent. The rubric names the distinction so they are not conflated.

**Concrete:** do **not** build the read-only `code-reviewer` subagent now. Review stays a skill. The reviewer + the three triggers are recorded below as the named revisit conditions.

## Revisit triggers

Re-open this decision (and build the reviewer subagent as **Slice 1** under the Control-Gated Slices pattern, ADR-0086) when any trigger becomes **real and observed**:

- a "review"/analysis skill **edits code when it shouldn't have**, or you need an auditable non-mutating guarantee for a compliance/safety reason → tool-isolation is now real;
- a **measured** cost win from a downgraded pass that a skill's own model selection cannot capture → model-downgrade is real;
- a **context-pollution incident** where a big sub-analysis degraded the main session and native delegation didn't quarantine it → context-isolation is real.

## Consequences

### Gains
- A clear, written answer to "skill vs native-delegation vs orchestrate vs subagent," ending the ad-hoc choice.
- Avoids a **fourth distribution mechanism** in `install-agents.sh` and the bitter-lesson trap (`[[heresy-vibe-coded-codebases]]`: don't add a mechanism the model's native delegation already covers) — bought for free by the default-deny posture.
- The revisit triggers make the future "yes" a *data-gated* decision, not a vibe.

### Costs
- The auditable tool-isolation use-case stays **unserved** until a trigger fires — accepted deliberately (it's theoretical today).
- The rubric must be *enforced by discipline*, not tooling; a future contributor could still scaffold a needless subagent. Mitigation: this ADR + the GLOSSARY/CONTEXT entries are the reference.

### Neutral
- cv-builder's `.agents/` system stays *complementary*, untouched.

## Alternatives considered

| Alternative | Why rejected |
|-------------|--------------|
| **Build the read-only `code-reviewer` subagent now** (the stub's original direction) | Its can't-write guarantee solves a **theoretical** problem — review skills have not caused mid-review edits. Building it adds a fourth distributed mechanism for no experienced need (bitter-lesson trap). Deferred to the revisit triggers. |
| Use `/orchestrate` + TS engine for review | Heavier than needed for a lone read-only pass; orchestration is for deterministic multi-step fan-out. |
| Do nothing / write no rubric | Leaves the "which mechanism?" confusion and the four-way conflation undocumented — the one real, present cost the audit found. The rubric is the deliverable. |
