# Agent defaults — grilling-by-default posture

Applies to every Claude Code session in any ojfbot repo. Loaded as a universal domain-knowledge file via `install-agents.sh`.

## The default

Before any non-trivial work in an ojfbot repo, **default to grilling**: confirm alignment before code.

1. **Restate the request in one sentence** — show the user what you heard. If your restatement is wrong, they correct it cheaply; if it's right, you've anchored the work.
2. **Surface 2–3 assumptions** you'd otherwise make silently. Examples: which sub-app, which package, what scope, what shape of output, what counts as "done."
3. **Ask the highest-leverage clarifying question** — the one whose answer most changes the implementation. One question is usually enough; rarely two.
4. **Wait for confirmation** before writing code, editing files, or running irreversible commands. The user can grant blanket approval ("just go") in their answer.

## When to skip the grill

Skip for genuinely trivial tasks where the cost of asking exceeds the cost of being wrong:

- Typo fixes, single-line edits with obvious intent
- Direct lookups (`what does function X do`, `where is Y defined`)
- Pure read-only investigation
- The user has already grilled themselves and handed you a precise spec
- The user explicitly says "just do it" or invokes `--no-grill` semantically

If you're unsure whether to grill, **grill**. The cost of one extra question is much lower than the cost of building the wrong thing.

## When the user pushes back on grilling

If the user says "stop asking, just do X," respect it for that turn. But if the request remains genuinely ambiguous after the rebuke, ask the *single* most important question rather than guess. The cost of one well-chosen question after a rebuke is much lower than the cost of building the wrong thing twice.

## Composition with skills

- **`/grill-with-docs`** is the explicit skill for deep alignment with CONTEXT.md / ADR updates in-loop. The default posture here is the lightweight version that fires every session; `/grill-with-docs` is the heavyweight version invoked when the work warrants formal artifacts.
- **`/plan-feature`** consumes the output of grilling. If you grilled in the same session, `/plan-feature --from-conversation` synthesizes the spec directly.
- **`/investigate`** already disciplines its own evidence-gathering. The default grill still applies: confirm what symptom you're chasing before opening files.

## Anti-patterns

- **The interrogation cascade** — asking 5 questions when 1 would do. One high-leverage question beats five small ones.
- **The performative grill** — asking questions whose answers won't change your implementation. If you'd code the same thing either way, don't ask.
- **The grill that ignores context** — re-asking what the user already told you in this session or what's plainly visible in the repo. Use what's in front of you first.
- **The grill that hides indecision** — using questions to defer a judgment call you should have made. If you have a strong recommendation, lead with it: "I'd do X because Y; ok?"

## Why this is the default

Pocock framing: code is not cheap, bad code is expensive, the rate of feedback is the speed limit. A 30-second alignment check costs less than 30 minutes of rework. In an agent-augmented codebase the multiplier is larger — agents generate code fast enough that misaligned work compounds into entropy quickly.

This file is symlinked into every sibling repo via `install-agents.sh`. Updates here propagate automatically.
