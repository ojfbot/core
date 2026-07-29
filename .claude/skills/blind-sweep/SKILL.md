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

Models are good at surfacing *known* unknowns and domain-standard considerations. They are documented to be poor at genuine unknown-unknowns and to **confabulate plausible-sounding gaps** when pushed — QuestBench (arXiv:2503.22674), CLAMBER (arXiv:2405.12063), and arXiv:2606.08571 all land in the same place. A confident list of "your blind spots" is the most dangerous output this skill could produce, because it feels like coverage.

What it honestly delivers:

- a **sorted** map of what you know, what you know you don't, and what you'd recognise but never wrote down;
- a **checklist of domain-standard considerations** this kind of work usually covers, which you can check yourself against;
- **variance as signal** — run the sweep three times in isolation and what only one run mentions is the interesting bucket.

Say this to the user in the output. Do not let the fourth box read as a guarantee.

## Core principles

1. **Facts are yours to find.** Anything answerable by reading the repo, you read. Only judgements go to the user.
2. **Isolation is load-bearing.** Three sweeps in one context is one sweep with extra steps — the first answer anchors the rest.
3. **Singletons are not noise by default.** A gap named by one sweep of three is either noise or the rare valuable find. Surface it, flagged, and let the user judge.
4. **Name the box.** An unsorted list of worries is not a map. Each box has a different remedy.
5. **No code, no plan.** This runs *before* alignment. It hands off to `/grill-with-docs`.

## The four boxes

| Box | What it is | What to do with it |
|---|---|---|
| **Known knowns** | What the user stated or the repo plainly shows | Nothing — this is the baseline |
| **Known unknowns** | Open questions they can already name | Route to `/grill-with-docs` as decisions |
| **Unknown knowns** | Taste and constraints they'd recognise instantly but never wrote down | Elicit by showing options, not by asking "what's your preference" |
| **Unknown unknowns** | What they don't know to ask | **Approximate only** — the domain-standard checklist below |

The fourth box is the expensive one and the one you cannot honestly fill. Approximate it, label the approximation.

## Workflow

### 1. Read the territory first

Before any sweep: read the area. Entry points, dependencies, tests, recent commits, any `CONTEXT.md` / `GLOSSARY.md` / architecture doc / ADRs touching it. Anything you can answer by looking, answer by looking — a sweep that "surfaces" a fact sitting in the README wastes the user's attention and inflates the result.

### 2. Run k=3 decorrelated sweeps

Send **one message with three Agent calls**. Each gets the same brief and **no knowledge of the others' output** — that isolation is the entire reason k>1 buys anything here (self-consistency, arXiv:2203.11171: decorrelated samples then aggregate). Three passes sharing a context is one pass.

**Three is a deliberate stopping point, not a floor to raise.** More samples is not monotonically better: aggregate performance can rise and then *fall* as calls increase (arXiv:2403.02419). Raising k also raises the singleton count, and singletons are the bucket a human has to adjudicate — so a bigger sweep buys more unreviewed noise, not more coverage. If three sweeps converge, more will not change the answer; if they diverge wildly, that divergence is itself the finding and a fourth run won't resolve it.

Vary the entry angle so they don't converge by construction:

- **Sweep A — operational:** what breaks in production; failure modes, limits, ops burden.
- **Sweep B — integration:** what this touches; contracts, callers, migration, blast radius.
- **Sweep C — domain-convention:** what work of this kind conventionally handles that this area doesn't visibly handle.

Brief for each:

> You are doing a blind-spot pass on `<area>` in this repo. Read it. Report: (1) the domain-standard considerations work of this kind usually covers, and whether this area visibly covers each; (2) questions someone experienced would ask that a newcomer wouldn't know to; (3) what you could NOT determine from the repo. Be concrete and cite files. Do not speculate about intent. If you don't know, say so — a short honest list beats a long plausible one. Return JSON: `[{item, box, evidence, confidence}]` with box ∈ `known-unknown|unknown-known|domain-standard`.

(If the Agent tool is unavailable, degrade to three strictly separated runs. Never collapse them.)

### 3. Split by agreement — this is the payoff

Cluster the three results by meaning, not wording, and split three ways:

- **Consensus (3/3 or 2/3)** — stable and real. Act on it.
- **Singleton (1/3)** — noise *or* the rare valuable find. **Never silently drop these** — the whole reason for sampling is that this bucket exists.
- **Absent** — what no sweep raised. Unmeasurable by definition; say so rather than implying coverage.

### 4. Sort into the boxes and output

```
## Blind sweep — <area>

**What I read:** <files/dirs, so the user can judge the basis>

### Known knowns
### Known unknowns          → these become /grill-with-docs questions
### Unknown knowns          → unwritten taste; confirm or correct these
### Domain-standard considerations not visibly covered
  (this is the honest stand-in for unknown unknowns — a checklist, not a guarantee)

| Item | Agreement | Evidence |
|------|-----------|----------|

### Singletons (raised by one sweep of three — judge these yourself)

### What I could not determine from the repo
```

### 5. Teach the user to prompt better about this area

The most useful output is usually not the list — it's the vocabulary. Close with:

- the **3–5 terms** in this area whose meaning is non-obvious, defined in one line each;
- **2–3 questions worth asking** that they now have the vocabulary to ask;
- the **one thing** most worth deciding before touching it.

### 6. Land it

Append the unresolved items to **`decisions/blind-spots.md`** under a dated `## <YYYY-MM-DD> — <area>` heading. Append; never rewrite prior entries.

**Write this file and no other.** In particular do *not* write `decisions/open-unknowns.md` — that file belongs to `/grill-with-docs`. The two are genuinely different artifacts (this one maps an *area's* familiarity; that one records decisions deferred during a *specific* design conversation), and keeping them separate is also what lets the disposition projector attribute a write to the right skill. `artifactWrittenInSession` matches on path and session alone, never on authorship, so two skills sharing one artifact makes every write ambiguous and can score the *other* skill a false `capture_miss` — the exact defect adr:harness-loop-instrumentation exists to remove.

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
