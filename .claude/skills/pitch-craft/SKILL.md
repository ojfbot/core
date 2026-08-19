---
name: pitch-craft
description: >
  MANDATORY: Load this skill IMMEDIATELY when user asks to "pitch-craft", "craft this
  pitch", "structure this proposal", "shape this pitch", "draft the proposal for this
  brief", "prep this bid". Umbrella for pitch/proposal work: classifies the buyer's
  awareness stage, then routes through /mece (test the argument's support) and /minto
  (pyramid + SCQA structure), and closes with an explicit ask. Output: buyer
  classification + the finished pitch with pyramid outline. Routes to sub-skills
  rather than duplicating them — /minto and /mece remain independently callable for
  non-pitch artifacts.
---

# /pitch-craft

You are a pitch assembler. Your job is to route ONE pitch or proposal through buyer
classification → /mece → /minto → the explicit ask — not to re-teach what the
sub-skills already do, and not to invent claims the operator hasn't made.

**Input:** `$ARGUMENTS` — the pitch task: the buyer's brief/posting/RFP (pasted or a
file path) plus whatever offer material exists (draft, notes, capability list).

**Tier:** 3
**Phase:** continuous

## Core Principles

1. **Classification before canon.** The buyer's awareness stage is decided first, from
   evidence in their own brief — every later choice (question register, SCQA content,
   opening altitude) keys off it. Discovery canon applied to a solution-aware buyer
   reads as consultant theater.
2. **Route, don't duplicate.** Steps 2 and 3 are invocations of /mece and /minto (via
   the Skill tool, or by loading their SKILL.md when running headless). If this file
   ever restates their mechanics, it has rotted — fix it here, not there.
3. **The ask survives every stage.** Whatever the awareness classification, the pitch
   ends with one explicit, unmissable call to action. Politeness is not a substitute
   for an ask.
4. **Displaced questions move, they don't die.** Discovery/value questions that the
   classification strikes from the pitch are carried to the post-contract kickoff
   list — deleted questions are lost acceptance criteria.

## Workflow

### Step 1 — Classify the buyer's awareness stage

> **Load `knowledge/buyer-awareness.md`** for the classification rubric, evidence
> markers, and the question-register rules per stage.

Read the buyer's brief. Classify: **solution-aware** (detailed brief, named stack,
documented failure notes, "skip the fluff" filters) vs **problem-aware** vs
**problem-unaware**. List the evidence lines. Derive the question set: solution-aware
buyers get build-shaping questions each anchored to a specific line of their brief;
displaced discovery questions go to a `Kickoff (post-contract)` list. Done when: stage
named, evidence cited, both question lists drafted.

### Step 2 — Test the argument's support with /mece

Collect the support for the offer (reasons to pick us, capabilities, proof points).
Invoke **/mece** on that grouping, parent question: "why should this buyer pick this
offer?". Adopt its regrouped list. Done when: /mece reports PASS (or its parked
residual is consciously accepted).

### Step 3 — Structure with /minto

Invoke **/minto** on the draft pitch content (offer + the Step-2 key line + the Step-1
question set). The SCQA Situation must be built from the buyer's own brief lines
gathered in Step 1 — for a solution-aware buyer, reflected-back specifics, never
generic industry context. Done when: /minto emits the pyramid outline + restructured
pitch.

### Step 4 — Close with the explicit ask

Per the vault pattern (`~/selfco/wiki/concepts/pattern-ask-for-the-sale.md`): the
primary action is explicit, confident, and unmissable — tell/show/tell, one concrete
next step (a call slot, a paid discovery scope, a start date), never "let me know if
interested". Done when: the pitch's final block names the action and makes it easy.

### Step 5 — Emit

```
## Pitch: <buyer / opportunity>

Buyer awareness: <stage> — evidence: <brief lines>
Questions (in pitch): <build-shaping list, each ← brief line>
Questions (kickoff, post-contract): <displaced discovery/value list>

<pyramid outline from /minto>

---
<the finished pitch, ask included>
```

## Gotchas

- **The measured failure mode is skipping the sub-skills, not misusing them.**
  ADR-0068 found a 0.8% skill-suggestion-followed rate — the path of least resistance
  is doing Steps 2–3 "by feel" with raw reasoning. Invoke /mece and /minto explicitly;
  their checks (named counterexamples, governing-thought extraction) are the value.
- **This skill is also consumed headless.** dealdesk PM agents load this SKILL.md +
  knowledge/ from disk as a required prompt-assembly step, without the Skill tool or
  this repo's context. Keep every knowledge/ file self-contained; never reference
  session state or "the conversation above" from them.
- **The classification failure is real and recorded:** first Upwork pitch (2026-08-18)
  drafted pain-excavation questions for a buyer whose post already stated the stakes.
  If a question would force the buyer to repeat their own brief, it is misclassified —
  move it to kickoff.
- **Don't let the umbrella absorb the sub-skills.** If a change request is about
  pyramid or MECE mechanics, it belongs in /minto or /mece; this file only owns
  routing, classification, and the ask.
