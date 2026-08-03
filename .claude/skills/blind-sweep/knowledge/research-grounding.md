# Research grounding — honesty limits, k=3, and aggregation rules

Reference for `/blind-sweep`, moved verbatim from SKILL.md: the literature behind the honesty framing, the k=3 stopping point, and the split-by-agreement rules.

## What this skill can and cannot deliver

Models are good at surfacing *known* unknowns and domain-standard considerations. They are documented to be poor at genuine unknown-unknowns and to **confabulate plausible-sounding gaps** when pushed — QuestBench (arXiv:2503.22674), CLAMBER (arXiv:2405.12063), and arXiv:2606.08571 all land in the same place. A confident list of "your blind spots" is the most dangerous output this skill could produce, because it feels like coverage.

What it honestly delivers:

- a **sorted** map of what you know, what you know you don't, and what you'd recognise but never wrote down;
- a **checklist of domain-standard considerations** this kind of work usually covers, which you can check yourself against;
- **variance as signal** — run the sweep three times in isolation; what only one run mentions is the interesting bucket, precisely because it is the thing the model was least disposed to say.

## Why k=3 — precision, not recall

**Three is a deliberate stopping point, and the reason is precision, not recall.**

The non-monotonicity result for repeated LM calls (arXiv:2403.02419) does **not** apply here — it needs a single correct answer and an argmax that discards minority responses. A union has neither: union over k+1 sweeps is a superset of union over k, so *recall is monotone by construction*. More sweeps never lose you a real item.

What decays is **precision**. Genuine items saturate quickly (coupon-collector), while plausible-but-bogus "unknowns" keep arriving at a roughly constant rate per sweep. So each additional sweep returns fewer new true items and about the same number of new false ones, and every one of them lands in a bucket a human has to adjudicate.

**No paper gives you the right k for this.** If you want it empirically: run k=1..8 on a few fixed cases, count newly-surfaced items later *confirmed* valid per sweep, and stop where marginal confirmed yield drops below marginal adjudication cost. Three is a reasonable prior, not a measured optimum — and the honest lever is decorrelation (Step 3, rule 3), not k.

## Splitting by agreement

- **Consensus (3/3 or 2/3)** — the domain-standard considerations. Salient, conventional, and the most likely to be things you already handle.
- **Singleton (1/3)** — raised once. **Structurally where the valuable items live** (see below). Never drop these, never bury them below consensus.
- **Absent** — what no sweep raised. Unmeasurable by definition; say so rather than implying coverage.

**Frequency across sweeps measures salience, not validity — and for this task the value ordering is inverted.** An unknown-unknown is by definition the thing the model is *least* disposed to surface. So the item that appears in all three sweeps is, almost by construction, a domain-standard consideration you could have listed yourself; the item that appears once is the candidate worth your attention. Ranking by consensus systematically demotes exactly what this skill exists to find.

Three rules follow, and they are the difference between a sweep and a vote:

1. **Never threshold or rank on frequency.** Union everything. Carry the count as a display tag, not a filter. Thresholding turns the sweep into a majority vote, and majority voting is known to fail on tasks with many distinct valid answers (arXiv:2402.13212), where standard self-consistency doesn't even apply to free-form output (arXiv:2311.17311).
2. **Get validity from adjudication, not from counting.** Take each candidate — singletons especially — and check it against something real: the repo, the roadmap, the tracker, the tests. Self-scoring without external feedback doesn't work (arXiv:2310.01798; Kamoi et al. TACL 2024), and re-reading a candidate against an artifact is the cheapest available substitute for external feedback.
3. **Decorrelation is the lever, not k.** Three sweeps with genuinely different framings beat eight resamples of one prompt. If the three briefs in Step 2 produce near-identical lists, that is a signal the framings collapsed — fix the framings, don't raise k.

**Sampling does not debias the generator.** k widens coverage of what the model *can* say; it never reaches what the model can't. Models are documented to be poor at knowing what they don't know (arXiv:2503.22674, arXiv:2405.12063, arXiv:2506.09038) — that is the ceiling on this whole routine, and no amount of sampling raises it.
