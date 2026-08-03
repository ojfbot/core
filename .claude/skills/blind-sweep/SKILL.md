---
name: blind-sweep
description: >
  MANDATORY: Load this skill IMMEDIATELY when user asks to "blind-sweep", "blind
  spot pass", "what am I not seeing", "I know nothing about this area", "what are
  my unknowns", "classify my unknowns", "what should I be asking". Sorts what you
  know and don't know into the four unknown-boxes using k=3 decorrelated sweeps,
  separates consensus from singletons, and teaches you to prompt better about the
  area. Appends decisions/blind-spots.md. No code.
---

# /blind-sweep

You are mapping the gap between the user's map and the actual territory, before they commit to a direction in an area they don't know well.

**Input:** `$ARGUMENTS` — the area: a folder, subsystem, domain, or "the thing I'm about to touch".
**Tier:** 2 — Multi-step procedure
**Phase:** Alignment (precedes grilling)

## Read this before you run it

**This skill does not detect your unknown unknowns, and any tool that claims to is lying to you.**

> **Load `knowledge/research-grounding.md`** before framing any output — the literature on why models confabulate blind spots and the honest list of what this skill actually delivers.

Say this to the user in the output. Do not let the fourth box read as a guarantee.

## Core principles

> **Load `knowledge/core-principles.md`** before starting the workflow — the five principles (facts vs judgements, isolation, singletons, naming the box, no code/plan).

## The four boxes

> **Load `knowledge/four-boxes.md`** before sorting anything — the four unknown-boxes, what each is, and what to do with each.

## Workflow

### 1. Read the territory first

> **Load `knowledge/sweep-briefs.md`** before reading the territory — what to read first, the three entry angles, the exact per-sweep brief text, and the degraded mode.

### 2. Run k=3 decorrelated sweeps

Send **one message with three Agent calls**. Each gets the same brief and **no knowledge of the others' output** — that isolation is the entire reason k>1 buys anything here (self-consistency, arXiv:2203.11171: decorrelated samples then aggregate). Three passes sharing a context is one pass.

> **Load `knowledge/research-grounding.md`** before fixing k — why three is the stopping point (precision, not recall).
> **Load `knowledge/sweep-briefs.md`** before dispatching — the three entry angles (operational / integration / domain-convention), the exact brief each agent gets, and the no-Agent-tool degraded mode.

### 3. Split by agreement — and do not mistake agreement for truth

Cluster the three results by meaning, not wording, and split three ways:

> **Load `knowledge/research-grounding.md`** before aggregating — the consensus/singleton/absent split, why frequency measures salience not validity, the three aggregation rules (never rank on frequency; validity from adjudication; decorrelation is the lever), and why sampling never debiases the generator.

### 4. Sort into the boxes and output

> **Load `knowledge/output-and-landing.md`** before writing the output — the exact output template, box headings included.

### 5. Teach the user to prompt better about this area

The most useful output is usually not the list — it's the vocabulary. Close with:

> **Load `knowledge/output-and-landing.md`** before closing — the three vocabulary-teaching items the close must contain.

### 6. Land it

Append the unresolved items to **`decisions/blind-spots.md`** under a dated `## <YYYY-MM-DD> — <area>` heading. Append; never rewrite prior entries.

**Write this file and no other.** In particular do *not* write `decisions/open-unknowns.md` — that file belongs to `/grill-with-docs`.

> **Load `knowledge/output-and-landing.md`** before landing the ledger — why the two ledgers must stay separate (disposition-projector attribution).

Then suggest `/grill-with-docs --scope=<area>` to turn the known unknowns into decisions.

## Constraints

- **No code, not even snippets.**
- **Never present the fourth box as detected blind spots.** It is a domain-standard checklist.
- **Never drop singletons.**
- **Cite evidence.** An item with no file behind it is a guess and must be labelled one.
- Cap each box at ~7 items. A 40-item list is not a map, it's an anxiety dump.

## Gotchas

- **The confident-list failure.** The tempting output is a crisp, authoritative "here are your blind spots." That is exactly the failure mode the literature documents. Hedged and honest beats crisp and confabulated.
- **Three sweeps in one context is one sweep.** If you find yourself summarising sweep A before running B, you have already destroyed the independence you're paying for.
- **Consensus means salient, not correct.** Three models trained alike agree for reasons other than truth. Consensus raises confidence in *salience*; only the repo confirms fact.
- **Don't run this on an area the user knows well.** They'll get a list of things they already handle, and learn to skip the skill. It's for genuinely unfamiliar ground.

## See also

- `/grill-with-docs` — the next step; turns known unknowns into decisions. Writes its own ledger (`decisions/open-unknowns.md`); never write that file from here.
- `/recon` — what the code *is*. This is about what you don't know about it.
- adr:harness-loop-instrumentation — why the fourth box is framed as a checklist.
