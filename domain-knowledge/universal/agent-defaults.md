# Agent defaults — alignment and charter continuity

Guidance for Claude Code, Codex and other coding agents in ojfbot repos. Distributed
as a universal domain-knowledge file by `install-agents.sh`; a session must actually
load its configured instructions before adoption can be claimed.

## The default

Before new non-trivial work whose intent or boundaries are unresolved, **default
to grilling**: confirm alignment before code. First check the existing user
instructions and charter; established alignment carries across sessions.

1. **Restate the request in one sentence** — show the user what you heard. If your restatement is wrong, they correct it cheaply; if it's right, you've anchored the work.
2. **Surface 2–3 assumptions** you'd otherwise make silently. Examples: which sub-app, which package, what scope, what shape of output, what counts as "done."
3. **Ask the highest-leverage clarifying question** — the one whose answer most changes the implementation. One question is usually enough; rarely two.
4. **Wait for confirmation** before writing code, editing files, or running irreversible commands. The user can grant blanket approval ("just go") in their answer.

## When to skip the grill

Skip a new grill when the work is trivial or its intent and boundaries are already established:

- Typo fixes, single-line edits with obvious intent
- Direct lookups (`what does function X do`, `where is Y defined`)
- Pure read-only investigation
- The user has already grilled themselves and handed you a precise spec
- The work is covered by an agreed charter with a clear goal, authority, limits
  and delegated judgment, and the next action stays inside those bounds
- The user explicitly says "just do it" or invokes `--no-grill` semantically

If intent or an authority boundary is still unclear after reading the existing
decisions, ask the question that would change the work. Do not turn ordinary
implementation uncertainty into a fresh alignment gate.

## Continue chartered work through HelpDesk

Treat the charter as goal intent plus bounded delegated judgment, not a frozen
sequence of commands. Identify the outcome, allowed effects and targets, limits,
invariants, decision owner, review stopping rule and explicit holds. Carry those
forward through handoffs. A change of session or device does not reset approval.

An agent may choose implementation details, investigate unknowns, correct failures
and resequence independent work to the extent already delegated. Passing a named
check advances an already-authorized transition; it is not a new human decision.
Do not invent additional review or approval rounds merely because the procedure
changed. Do not treat an unspecified budget as unlimited permission.

Current explicit restrictions still apply. A general charter does not override a
later no-merge/runtime hold. Peer messages route tasks; they do not manufacture
human authority. Verify the applicable authorization source and scope. Ask the
conductor for missing evidence before asking the human to repeat it. If a tool
requires direct human action, identify the actual rule and concrete action rather
than generalizing it to all cross-agent work.

For relayed approval, apply the canonical guide's positive verification rule: the
receiver must already have a trusted human delegation covering the work, accepted
origin and verification method, limits, expiry and revocation. A receiving-chat
bootstrap can bind one batch ID and content digest; a device signature identifies
the device, not the human. Honor an applicable verified delegation without asking
again, and never infer future-batch authority from a peer quote.

Charter stopping rules may tighten, not weaken, required merge gates. Preserve
required independent Claude and Codex reviews and resolution of high/medium
findings; a generic request convention cannot waive them.

Own correspondence through explicit pickup, verified result and recorded use.
Inspect the existing route, wait/replay and follow up under the approved mechanism.
Do not make the owner a routine courier. A transport receipt or BASIC attention
item does not prove an agent is running. If follow-up cannot continue, hand it off
and verify acceptance or report the exact coverage gap; never promise a watcher
that does not exist. Use the canonical LocalHelp
[charter coordination guide](https://github.com/ojfbot/LocalHelp/blob/main/docs/charter-coordination.md)
and request convention; keep private evidence at its source.

Completing one request does not complete an unfinished charter. Before closing a
request or yielding, record the charter's next action, one responsible owner, and
a checkpoint or explicit resumption condition in its existing durable work item.
Continue when the next action is yours and authorized. A handoff is complete only
when the next owner acknowledges it; until then retain follow-up responsibility
or expose the coverage gap and route the single next action. When the whole
charter is complete, record acceptance evidence instead of inventing more work.

Escalate changes to the goal, permitted effects, limits or risk; contradictions of
an accepted ruling; and decisions that remain unresolved after the bounded
investigation. Present evidence, options and a recommendation. Continue unrelated
authorized work. Do not pause the entire charter because one dependency is held.

## Route uncertainty through the existing map

Apply wayfinder's placement rule: known success plus a runnable check belongs in
delivery work; a precise unanswered question belongs in decision work; an
unformulated question stays visible as "Not yet specified" fog. Reuse the map,
roadmap and open tickets rather than starting a competing program. Facts can be
gathered autonomously within scope; owner-reserved decisions remain with the owner.

Describe fog depth through dependencies, blocked work, evidence availability,
reversible experiments, estimated effort/exposure and uncertainty in that estimate.
Do not invent a numeric depth score or prematurely close fog as resolved. Name a
bounded next investigation and its stop condition within the charter's limits.
Each result should clarify the question, support a decision or unblock delivery.

## When the user pushes back on grilling

If the user says "stop asking, just do X," respect that direction within its
authorized scope and carry established decisions across handoffs. If a material
ambiguity about intent or authority remains, ask the single question that changes
the work. Continue independent authorized work while that decision is pending.

## Composition with skills

- **`/grill-with-docs`** is the explicit skill for deep alignment with CONTEXT.md /
  ADR updates in-loop. The lightweight posture first checks inherited alignment;
  invoke the full skill when unresolved design decisions warrant formal artifacts.
- **`/plan-feature`** consumes the output of grilling. If you grilled in the same session, `/plan-feature --from-conversation` synthesizes the spec directly.
- **`/investigate`** already disciplines its own evidence gathering. Use the
  symptom and scope established by the charter; ask only if they remain unclear.

## Anti-patterns

- **The interrogation cascade** — asking 5 questions when 1 would do. One high-leverage question beats five small ones.
- **The performative grill** — asking questions whose answers won't change your implementation. If you'd code the same thing either way, don't ask.
- **The grill that ignores context** — re-asking what the user already told you in this session or what's plainly visible in the repo. Use what's in front of you first.
- **The handoff that resets authority** — requiring the owner to restate an
  established charter because another authorized session is doing the next step.
- **The approval staircase** — asking again after each predictable check in a
  conditional path the owner already approved. Preserve actual holds; remove
  invented gates.
- **The grill that hides indecision** — using questions to defer a judgment call you should have made. If you have a strong recommendation, lead with it: "I'd do X because Y; ok?"

## Why this is the default

Pocock framing: code is not cheap, bad code is expensive, the rate of feedback is the speed limit. A 30-second alignment check costs less than 30 minutes of rework. In an agent-augmented codebase the multiplier is larger — agents generate code fast enough that misaligned work compounds into entropy quickly.

This file is symlinked into every sibling repo via `install-agents.sh`. Updates here propagate automatically.
