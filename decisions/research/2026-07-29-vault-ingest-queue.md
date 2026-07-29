# Vault ingest queue — agentic harness practice

**Date:** 2026-07-29
**Status:** staged for `/vault ingest` — NOT yet vaulted. Citation audit COMPLETE (§6); no blocking holds remain.
**Method:** three parallel research agents (primary-engineering / academic / practitioner), each required to fetch-and-verify rather than cite from memory, and to mark UNVERIFIED rather than guess.
**Companion to:** `adr:harness-loop-instrumentation`, core PR #295, PR #296

Every entry below was fetched. Star counts and version numbers are read-off-page on
2026-07-29 and drift — re-read before quoting publicly.

---

## 0. The provenance correction that comes first

The source material for the harness work carried a caveat that is **wrong**, and it should be
corrected at ingest rather than propagated:

- The influence-study framing ("SOURCE: ANTHROPIC — secondhand, unverified") understates it.
- The grounding report's instruction to "not cite 'Fable 5' as an Anthropic product" is false.

**Verified:** `anthropic.com/news/claude-fable-5-mythos-5` (2026-06-09) is a real announcement,
and *"A field guide to Claude Fable 5: Finding your unknowns"* — Thariq Shihipar, MTS at
Anthropic, 2026-07-06 — is a genuine first-party source. Same author as the Agent SDK post,
which corroborates the byline.

Two riders:

1. The **model announcement contains none of the unknowns material**. Anything citing it as the
   source of the four-quadrant framework has the wrong URL; the framework is only in the field guide.
2. **`/blind-sweep` is a local derivative of that field guide**, not an independent contribution.
   File it with attribution, not as original work.

---

## 1. The tension worth vaulting as a matched pair

These two are both first-party, both 2026, and they pull in opposite directions on whether the
comprehension thesis behind `/merge-quiz` matters at all. Ingesting either alone produces a
one-sided file.

| | Source | Claim |
|---|---|---|
| **Against** | **Harness engineering: leveraging Codex in an agent-first world** — Ryan Lopopolo (OpenAI), 2026-02-11, `openai.com/index/harness-engineering/` | 3→7 engineers, 5 months, empty repo → ~1M lines, ~1,500 merged PRs, **zero human-written code**. Review routed agent-to-agent. Verbatim: *"Humans may review pull requests, but aren't required to."* |
| **For** | **Agentic coding and persistent returns to expertise** — Hitzig, Massenkoff, Lyubich, Zhang, Heller, McCrory (Anthropic), 2026-06-16, `anthropic.com/research/claude-code-expertise` | ~400k Claude Code sessions / ~235k users. **Domain** expertise (not coding background) predicts success; experts recover from agent errors better. Verbatim: *"People decide what to build, and the agent decides how to build it."* |

**Why this matters here:** `/merge-quiz` assumes operator comprehension is load-bearing and
decays silently. The OpenAI report is the strongest published evidence that an org can run
without it. The Anthropic study is the strongest evidence that expertise still pays — via
*error recovery*, which is precisely what a comprehension gate protects. Both are vendor
first-party on their own products; neither is neutral.

Structural third data point — **GitClear, "The Maintainability Gap," Jan 2026**
(`gitclear.com/the_ai_code_quality_maintainability_gap`): 623M changed lines, 2023–2026;
properly-refactored ("moved") code fell from 13% of changed lines in 2023 to **3.8%** YTD 2026.
⚠️ Lead-gen-gated, unaudited, and GitClear sells the analytics the research implies you need.

---

## 2. Cognitive debt — the anchor for `/merge-quiz`

- **"Interactive explanations"** — Simon Willison, *Agentic Engineering Patterns*, 2026-02-28,
  `simonwillison.net/guides/agentic-engineering-patterns/interactive-explanations/`
  Verbatim: *"When we lose track of how code written by our agents works we take on cognitive debt."*
  This is the exact source for the term used in `merge-quiz.mjs`'s docblock. **Ingest first.**
- **"Linear walkthroughs"** — same guide, 2026-02-25. Second comprehension technique.
- **Cognitive debt link-post** — Willison, 2026-02-15, crediting **Margaret-Anne Storey** (via
  Fowler's site) for the term. Gives the academic upstream.
- **"Vibe engineering"** — Willison, 2025-10-07. The prior-art post the 2026 discourse builds on.

**Actionable for us:** Willison's remediation is having the agent *build an interactive
explanation of its own code*. `/merge-quiz` Step 2 currently briefs in prose. An interactive or
animated explanation is a strictly better teaching artifact and is a natural v2 — logged here
rather than built on impulse.

Ingest the guide **as a unit** (6 sections / 19 subsections), not one chapter.

---

## 3. Does agentic review actually work

- **"From Industry Claims to Empirical Reality"** — Chowdhury, Banik, Ferdous, Shamim,
  **arXiv:2604.03196**, 2026-04-03. 3,109 PRs / 13 review agents. Verbatim: *"CRA-only PRs
  achieve a 45.20% merge rate, 23.17 percentage points lower than human-only PRs (68.37%)."*
  The only *confirmed* falsifiable numbers in the corpus. **Note:** a different paper from
  `2607.03316`, whose 58%/43% figures are wrong or unconfirmed — see §6. Prefer this one.
- **"AI Writes Better Code. We're Getting Worse at Reviewing It."** — Patrick Hammond, 2026-02-25.
  Vigilance decrement, automation complacency, context-switching cost, imported from aviation and
  radiology. ⚠️ ends in a sales CTA.
- **Intercom, "AI is approving our pull requests"** — 2026-04-21. Decomposes review into
  sub-agents by concern. ⚠️ self-reported metrics.

---

## 4. Orchestration — ingest as a matched pair, never alone

- **"Welcome to Gas Town"** — Steve Yegge, 2026-01-01. Verbatim: *"I've never seen the code, and
  I never care to, which might give you pause."* The direct foil to Willison.
- **Simon Hartcher's rebuttal** — 2026-01-19. Heavy Claude Code user; likes Beads, rejects the
  orchestration model on **agency and visibility** grounds. Pairing these two turns a posture
  into a decision record.
- **Maggie Appleton, "Gas Town's Agent Patterns…"** — ~2026-01-24 (page undated; HN-dated).
  Best analytical treatment. Most portable idea: once agents own implementation, **design and
  planning become the bottleneck**.
- **Beads (`bd`)** — `github.com/gastownhall/beads`, Dolt-backed distributed graph issue tracker,
  MIT, **25.7k stars observed 2026-07-29**. Directly relevant to our own bead schema. Gas Town's
  own site claims "23,000+" — stale.

---

## 5. Harness engineering as a named practice

- **Addy Osmani, "Agent Harness Engineering"** — 2026-04-19. Single most actionable heuristic in
  the whole corpus: *"Every line in a good `AGENTS.md` should be traceable back to a specific
  thing that went wrong."* That rule generalises directly to CLAUDE.md and to every skill we ship.
- **Vivek Trivedy, "The Anatomy of an Agent Harness"** — LangChain, 2026-03-10.
  *"Agent = Model + Harness. If you're not the model, you're the harness."*
- **awesome-harness-engineering** — `github.com/walkinglabs/…`, 3.7k stars. Its section taxonomy
  is a usable ontology for the vault itself.
- **Learn Harness Engineering** — free, open-source, sells nothing; template library is liftable.
  ⚠️ no dates anywhere.

**Contested attribution — do not resolve silently.** Osmani credits Trivedy for coining "harness
engineering", but Trivedy's canonical writeup (2026-03-10) *postdates* OpenAI's use of it as a
title (2026-02-11), and Mitchell Hashimoto's "engineering the harness" (~2026-02-05) predates
both. Record as **contested**.

---

## 6. Citation audit — RESOLVED

**All 25 IDs resolve. None fabricated.** The grounding report's "treat 2026 preprints as
provisional" caveat was over-cautious about *existence*; the real problems are in the **claims
attached to them**, and two are serious enough to block.

### Do not repeat — claim is wrong

**`2607.03316`** (Lin, Liang, Thongtanunam, Tantithamthavorn — *Is Agentic Code Review Helpful?
Mining Developers' Feedback to CodeRabbit Reviews in the Wild*, 3 Jul 2026).
The abstract says **56.3% rejected**, not 58%. The "43% of false positives from limited
understanding of overall design" does **not** appear in the abstract and could not be confirmed
in the body (HTML render 404s for both versions; the 6.2MB PDF didn't extract). A secondary
summary suggests the paper's 43.3% is *the share of reviews addressing functional defects* — a
completely different quantity. **Ship neither number until someone reads the PDF.** What the
abstract does support: rejections driven by false positives, redundancy, out-of-scope, and
misalignment with developer intent — and functional-concern reviews were *more* likely invalid.

**`2604.23178`** (Sadman Kabir Soumik, single author — *Judging the Judges*, 25 Apr 2026).
Two of the three claims in the grounding report are wrong, and it drops the headline:
- ❌ "order-swapping fixes position bias" — **contradicted.** Position bias is already negligible
  (≤0.04); swapping significantly helps only Gemini Flash (+4.7pp) and on the adversarial LLMBar
  set it *hurts all models by 4–13pp*.
- ✅ "Claude shows reverse verbosity bias" — holds. Claude prefers concise (−0.12); Pro/Flash/Llama
  prefer longer (+0.24 to +0.44); GPT-4o neutral.
- ❌ "self-preference hardest to remove" — **not in the paper.** It reports self-preference as
  heterogeneous and "not uniformly tied to the judge's own family," with no difficulty ranking.
- ⚠️ **Missing headline:** *style bias dominates* (0.10–0.76, markdown over plain prose), far
  exceeding position bias and under-studied. For anyone building a judge harness that is the
  finding — and the source doc doesn't have it.

### Verified and supported
`2606.08571` (confabulation on cross-domain questions; Smithson 2012 epistemology) ·
`2607.20526` ConfidenceBench (15 models; best 0.103 vs 0.1875 baseline) ·
`2603.09309` *Rescaling Confidence* (>78% on three round values; 0–20 beats 0–100) ·
`2603.08035` CDRRM (judge plateaus past ~3k) · `2603.04861` (200–2,000 queries) ·
`2605.21384` SpecBench · `2603.25723` · `2606.25447` · `2606.03135` · plus all 14 `25xx` IDs.

### Evidentiary-weight tags for ingest
`2606.08571` and `2604.23178` are **single-author**; `2607.20526` rests on **200 questions**.
All resolve and say what's claimed (modulo the above), but they are not the weight of the
2022–2025 core. Tag them.

Fix before ingest: source-doc titles for `2606.08571`, `2607.20526`, `2603.08035`, `2606.25447`,
`2606.03135` are truncated or acronym-only; `2603.04861`'s real title is not "ReCouPLe";
`2603.09309` had no title at all. They are unfindable as written.

### Attribution errors already confirmed — do not repeat

1. **`2410.21819` is Wataoka, Takahashi & Ri** (NeurIPS 2024 *workshop*), not Zheng et al., and
   covers self-preference only. Position and verbosity bias belong to `2306.05685`.
2. **`2404.13076` (Panickssery) is NeurIPS 2024 main track**, not ICML.
3. **Those two reach opposing conclusions** — Panickssery: self-*recognition* causes
   self-preference; Wataoka: low *perplexity* does, "regardless of whether the outputs were
   self-generated." Citing them as mutually confirming misrepresents both.
4. **`2310.01798` does not say "LLMs cannot self-correct."** Title ends "*Reasoning Yet*"; scope
   is *intrinsic* correction on *reasoning*. The scoped claim is Kamoi et al. TACL 2024 (`2406.01297`).
5. **The reliability/resolution decomposition is Murphy (1973)**, not Brier (1950) — a
   meteorology journal paper with **no arXiv ID**. Any arXiv citation of it is fabricated.
6. **Skalse (`2209.13085`) is formal MDP theory with no LLM experiments.** For empirical reward
   hacking use Gao (`2210.10760`) or Wen (`2409.12822`).
7. **AbstentionBench (`2506.09038`) is June 2025**, not 2026.
8. **"Lost in the Middle" (`2307.03172`) is not the multi-turn degradation paper** (`2505.06120`).

### One finding that already changed shipped code

**The k question resolved, and the answer found a worse bug than the one I asked about.**

`arXiv:2403.02419`'s non-monotonicity does **not** transfer to set-union — it needs a single
correct answer and an argmax that discards minorities. Union recall is monotone by construction.
My first caveat (commit `fd2e49b`) was therefore wrong on the mechanism, though right that k=3
should be a stopping point: what actually decays is **precision**, since true items saturate
while plausible-but-bogus ones keep arriving at a constant per-sweep rate.

The real defect was in the aggregation. `/blind-sweep` ranked **consensus above singletons**
("stable and real — act on it"). But frequency across sweeps measures **salience, not validity**,
and an unknown-unknown is by definition what the model is *least* disposed to surface — so the
high-value item is structurally the **singleton**, and consensus is mostly domain-standard
material the operator already handles. The skill's own value ordering was inverted against its
stated purpose. Backed by `2402.13212` (majority voting fails where many distinct valid answers
exist) and `2311.17311` (standard self-consistency doesn't apply to free-form output).

Fixed: never threshold or rank on frequency; adjudicate each candidate against a real artifact;
decorrelation is the lever, not k.

**`/merge-quiz`'s evidence base, stated honestly in the skill.** Direct hit: Anthropic's RCT
(52 engineers) — AI-assisted group scored **50% vs 67%** on a comprehension quiz, d=0.738,
p=0.01. Caveats recorded with it: not peer-reviewed, commercial stake, junior-skewed, measures
skill acquisition rather than review adequacy. Counterweight kept: `2507.00788` "Echoes of AI"
(151 participants, 95% professionals) found no significant maintainability penalty.
**No study quizzes a professional reviewer on a real PR, and none shows that gating on a quiz
improves outcomes** — the skill now says so about itself. Rubric design should borrow from the
"Explain in Plain English" tradition (`2403.06050`) rather than invent question types.

---

## Ingest order

1. Willison "Interactive explanations" + "Linear walkthroughs" (§2) — anchors the term already
   used in shipped code, and hands us a concrete v2 for `/merge-quiz` Step 2.
2. The OpenAI ↔ Anthropic pair (§1) — as **one** synthesis page, never separately.
3. Osmani's `AGENTS.md`-provenance rule (§5) — generalises to every skill we ship.
4. Shihipar field guide (§0) — with `/blind-sweep` filed as its derivative.
5. `2604.03196` (§3) — the only falsifiable numbers; promote if the vault is thin on evidence.

**Excluded deliberately:** a paid Udemy course and ~8 SEO-farm "Complete Guide to Harness
Engineering (2026)" pages that restate primary sources with a product CTA and contribute no technique.
