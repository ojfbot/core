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
- **variance as signal** — run the sweep three times in isolation; what only one run mentions is the interesting bucket, precisely because it is the thing the model was least disposed to say.

Say this to the user in the output. Do not let the fourth box read as a guarantee.

## Core principles

1. **Facts are yours to find.** Anything answerable by reading the repo, you read. Only judgements go to the user.
2. **Isolation is load-bearing.** Three sweeps in one context is one sweep with extra steps — the first answer anchors the rest.
3. **Singletons are where the value lives.** Frequency across sweeps measures salience, not validity — and the item the model is least disposed to surface is the one worth finding. Surface singletons at least as prominently as consensus, and never rank by count.
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

**Three is a deliberate stopping point, and the reason is precision, not recall.**

The non-monotonicity result for repeated LM calls (arXiv:2403.02419) does **not** apply here — it needs a single correct answer and an argmax that discards minority responses. A union has neither: union over k+1 sweeps is a superset of union over k, so *recall is monotone by construction*. More sweeps never lose you a real item.

What decays is **precision**. Genuine items saturate quickly (coupon-collector), while plausible-but-bogus "unknowns" keep arriving at a roughly constant rate per sweep. So each additional sweep returns fewer new true items and about the same number of new false ones, and every one of them lands in a bucket a human has to adjudicate.

**No paper gives you the right k for this.** If you want it empirically: run k=1..8 on a few fixed cases, count newly-surfaced items later *confirmed* valid per sweep, and stop where marginal confirmed yield drops below marginal adjudication cost. Three is a reasonable prior, not a measured optimum — and the honest lever is decorrelation (Step 3, rule 3), not k.

Vary the entry angle so they don't converge by construction:

- **Sweep A — operational:** what breaks in production; failure modes, limits, ops burden.
- **Sweep B — integration:** what this touches; contracts, callers, migration, blast radius.
- **Sweep C — domain-convention:** what work of this kind conventionally handles that this area doesn't visibly handle.

Brief for each:

> You are doing a blind-spot pass on `<area>` in this repo. Read it. Report: (1) the domain-standard considerations work of this kind usually covers, and whether this area visibly covers each; (2) questions someone experienced would ask that a newcomer wouldn't know to; (3) what you could NOT determine from the repo. Be concrete and cite files. Do not speculate about intent. If you don't know, say so — a short honest list beats a long plausible one. Return JSON: `[{item, box, evidence, confidence}]` with box ∈ `known-unknown|unknown-known|domain-standard`.

(If the Agent tool is unavailable, degrade to three strictly separated runs. Never collapse them.)

### 3. Split by agreement — and do not mistake agreement for truth

Cluster the three results by meaning, not wording, and split three ways:

- **Consensus (3/3 or 2/3)** — the domain-standard considerations. Salient, conventional, and the most likely to be things you already handle.
- **Singleton (1/3)** — raised once. **Structurally where the valuable items live** (see below). Never drop these, never bury them below consensus.
- **Absent** — what no sweep raised. Unmeasurable by definition; say so rather than implying coverage.

**Frequency across sweeps measures salience, not validity — and for this task the value ordering is inverted.** An unknown-unknown is by definition the thing the model is *least* disposed to surface. So the item that appears in all three sweeps is, almost by construction, a domain-standard consideration you could have listed yourself; the item that appears once is the candidate worth your attention. Ranking by consensus systematically demotes exactly what this skill exists to find.

Three rules follow, and they are the difference between a sweep and a vote:

1. **Never threshold or rank on frequency.** Union everything. Carry the count as a display tag, not a filter. Thresholding turns the sweep into a majority vote, and majority voting is known to fail on tasks with many distinct valid answers (arXiv:2402.13212), where standard self-consistency doesn't even apply to free-form output (arXiv:2311.17311).
2. **Get validity from adjudication, not from counting.** Take each candidate — singletons especially — and check it against something real: the repo, the roadmap, the tracker, the tests. Self-scoring without external feedback doesn't work (arXiv:2310.01798; Kamoi et al. TACL 2024), and re-reading a candidate against an artifact is the cheapest available substitute for external feedback.
3. **Decorrelation is the lever, not k.** Three sweeps with genuinely different framings beat eight resamples of one prompt. If the three briefs in Step 2 produce near-identical lists, that is a signal the framings collapsed — fix the framings, don't raise k.

**Sampling does not debias the generator.** k widens coverage of what the model *can* say; it never reaches what the model can't. Models are documented to be poor at knowing what they don't know (arXiv:2503.22674, arXiv:2405.12063, arXiv:2506.09038) — that is the ceiling on this whole routine, and no amount of sampling raises it.

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

### Singletons (raised once — judge these yourself; this is the high-value bucket, not the leftovers)

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
