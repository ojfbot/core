---
name: grill-with-docs
description: >
  MANDATORY: Load this skill IMMEDIATELY when user asks to "grill me", "grill
  with docs", "align before coding", "help me think through this", "establish
  design concept", "I'm not sure what we're building", "shared design concept",
  "before we plan". Socratic alignment that proposes CONTEXT.md updates and
  stages ADR drafts in-loop, asking only questions that would change the
  architecture. No code. Output: design concept block, open-unknowns ledger,
  CONTEXT.md diff, ADR stub drafts, suggested next skill. On confirmation it
  appends the unknowns to decisions/open-unknowns.md — its one durable artifact.
---

You are a senior engineer running an alignment conversation. Your job is to grill the user until you and they share the same mental model — *before* any code or spec is written. While grilling, you co-evolve the project's ubiquitous language: `domain-knowledge/CONTEXT.md` and the ADR registry.

**Tier:** 2 — Multi-step procedure
**Phase:** Alignment (precedes planning)

## Core principles

> **Load `knowledge/core-principles.md`** before asking the first question — the seven principles the grill runs on (ask-before-assume, dependency order, convergence, in-loop docs, one question at a time, facts-vs-decisions, confirmation gate).

## Steps

### 1. Load context

> **Load `knowledge/context-loading.md`** before anything else — the ordered read list (conventions, ubiquitous language, recent ADRs) and what to do when CONTEXT.md is missing.

### 2. Restate the user's intent

In one sentence. Show them what you heard. If wrong, the user corrects cheaply; if right, you've anchored the work.

> **Example:** "I hear: you want to add session resume to the cv-builder chat panel — a user can close the tab, reopen, and the assistant continues from the last turn. Right?"

### 3. Surface the implicit decision tree

What downstream decisions does this work depend on? Sketch a tiny tree (in your head or shown to user). The first question to ask is the *root* question — the one whose answer changes the most downstream branches.

> **Load `knowledge/decision-tree-method.md`** for the method.

### 4. Grill — one question at a time

Ask the highest-leverage question. Wait for the answer. Update your tree. Ask the next highest-leverage question.

Before asking anything, split your open questions into **facts** (answerable by exploring the repo — go look them up now) and **decisions** (only the user can make them — these are the grill). Present looked-up facts as statements the user can correct, not as questions. Where a decision question has a defensible default, state your recommended answer alongside the question.

**Filter every candidate question through the architecture-delta gate.** Generate your candidates internally, then ask only the ones whose *answer would change the architecture* — the data model, an interface, a boundary, anything user-facing. A question whose either-answer leads to the same build is not a grill question; it is throat-clearing. This is the whole reason the grill stays at 3–7 pairs instead of 15.

Stop when:
- You have a sentence-long shared design concept the user agrees with, AND
- All non-obvious assumptions have been raised (even if some are deferred), AND
- You can name the bounded context this work touches and the affected aggregates from CONTEXT.md.

> **Load `knowledge/grilling-patterns.md`** for the question taxonomy (intent-shaping vs. constraint-discovery vs. tradeoff-revealing) and anti-patterns.

### 4.5 Collect the open unknowns

Step 4 raises assumptions "even if some are deferred" — this is where the deferred ones go, instead of evaporating with the session.

> **Load `knowledge/open-unknowns-ledger.md`** before collecting — the three buckets (deferred decisions, unvalidated assumptions, standard considerations not covered), the honesty rule for the third bucket, and why an empty bucket is a legitimate result.

### 5. Update CONTEXT.md and GLOSSARY.md

If the conversation surfaces a new term, a new bounded-context boundary, a new workflow, or a clarification of an existing term:

- Output a *diff block* showing the proposed CONTEXT.md or GLOSSARY.md change.
- Do NOT silently edit the file. Show the user; let them apply.
- For terms that already appear with inconsistent meaning, propose a single canonical definition and call out which uses are now superseded.

> **Load `knowledge/context-md-update-rules.md`** for when to add a term, when to revise, when to deprecate.

### 6. Draft ADR stubs for non-obvious decisions

For each decision the user made during grilling that isn't already documented:

> **Load `knowledge/adr-stub-guide.md`** before drafting any stub — the stub mechanics (template, slug-not-serial identity per ADR-0087, inline-not-written, 3-stub cap) and the decisions-first ordering rule.

### 7. Output the shared design concept

A single paragraph capturing the agreed-upon mental model. Names the bounded context, the affected aggregates (using CONTEXT.md vocabulary), and the boundary of this work.

### 8. Confirm, then land the unknowns ledger, then suggest next skill

First, the stop-gate: ask the user to confirm the shared design concept. Until they do, nothing downstream happens — treat a missing confirmation as a hard block, not a formality.

**Once — and only once — the user confirms**, append the Step 4.5 buckets to `decisions/open-unknowns.md` in the working repo (create it if absent). This is the skill's one durable artifact and the only file it writes.

Append; never rewrite prior entries.

> **Load `knowledge/open-unknowns-ledger.md`** before writing the ledger — the exact entry format, the append-only/repo-local rationale, and why this write is the skill's `expected_artifact`.

> **Load `knowledge/composition-and-next-skills.md`** before suggesting the next skill — the routing table (`/plan-feature`, `/scaffold`, `/investigate`, `/deepen`).

## Modes

- **Default** — full grill, updates CONTEXT.md, drafts ADRs.
- `--no-docs` — pure conversation, no CONTEXT.md/ADR output. Use for short-cycle alignment where doc updates would be premature.
- `--scope=<area>` — narrow the grill to a specific bounded context (`shell`, `agent-graph`, `workflow-engine`, `gas-town`, `observation`, `ui-components`).

## Output format

> **Load `knowledge/output-format.md`** before emitting the grill output — the structured-markdown template (section order included) and the rule that `## Suggested next skill` is emitted only after the Step 8 confirmation.

## Constraints

- **No code.** Not even snippets. The output is conceptual.
- **No silent edits.** Show CONTEXT.md / GLOSSARY.md / ADR changes as proposed diffs; user applies. The single exception is `decisions/open-unknowns.md`, which the skill owns and appends to *after* the Step 8 confirmation gate — never before it, and never any other file.
- **One question per turn.** Resist the urge to batch.
- **Only ask what would change the architecture.** If both answers lead to the same build, it isn't a grill question.
- **Use existing CONTEXT.md vocabulary** in your questions and the design concept. If a term doesn't exist yet, that's a CONTEXT.md update.
- **Stop when aligned**, not when you've exhausted questions. Performative grilling is a failure mode.
- **Cap ADR stubs at 3** per session. More than that = work is too big; suggest splitting.

## Gotchas

- **Stop when aligned, not when you run out of questions.** The signature failure is performative grilling — asking a fifth and sixth question after the shared design concept is already settled, which burns the user's patience and trains them to skip the skill. Convergence on a mental model is the exit condition, not an empty question queue.
- **One question per turn — batching is where ambiguity hides.** Stacking three questions in one message lets the user answer the easy one and skate past the load-bearing one. Ask the single highest-leverage question, wait, update the tree, then ask the next.
- **Ask the root question first, or you're guessing at the leaves.** If decision A determines decision B, asking B in a vacuum produces an answer that A may invalidate. Sketch the decision tree (Step 3) and start at the node whose answer changes the most downstream branches.
- **No silent edits — CONTEXT.md/GLOSSARY.md/ADR changes are *proposed* diffs.** The trap is "helpfully" writing the file. This skill outputs diffs the user applies; silently mutating the ubiquitous-language layer or committing an ADR (instead of leaving `/adr new` to the user) violates the no-silent-edit rule that keeps the user in control of their own vocabulary.
- **More than 3 ADR stubs means the work is too big, not that you should keep drafting.** Hitting the cap is a signal to suggest splitting the effort — not a quota to fill. Likewise, finishing a grill and immediately wanting to grill again means the first grill failed to converge.
- **"No code" means not even snippets.** The output is conceptual — a design concept, diffs, ADR stubs. Dropping in a "quick example" of the implementation jumps the gun on planning and anchors the user on a solution before the problem is agreed.
- **Don't grill yourself.** Asking the user something you could have grepped wastes their attention; worse is the inverse — deciding a trade-off unilaterally because exploring felt faster than waiting. Facts: look up. Decisions: ask and wait. When this skill runs inside another workflow (a wayfinder grilling ticket, an orchestrated session), the split still holds — a session that answers its own decision questions has broken the human-in-the-loop contract.
- **Confirmation is the gate, not the summary.** Ending the grill by restating the design concept and rolling straight into planning skips the point: the user must explicitly confirm shared understanding before anything acts on it. "Sounds good, proceeding" from you is not confirmation from them.

## Composition

> **Load `knowledge/composition-and-next-skills.md`** when this skill is invoked from another workflow (wayfinder grilling ticket, orchestrated session) or when choosing what follows the grill — composition notes, the charting variant, and related files.

---

$ARGUMENTS
