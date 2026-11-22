# How do we keep AI graders honest? (wayfinder ticket #671)

Research date: 2026-11-22. Discovery only. Nothing here is a decision. The owner chooses.

## How to read this file

Every claim carries one tag.

- **[S]** The source states it. A URL follows.
- **[V]** The Selfco vault states it. The page is named by title only.
- **[R]** A public fleet repo file states it. The repo-relative path follows.
- **[I]** My inference. Treat it as a hypothesis.

Numbers marked "computed" are mine. I worked them out with exact binomial maths. The method is at the end.

Setup the owner has already ruled, from the ticket brief:

- Only fixed machine checks, against independent records, may declare a critical violation (#670).
- An AI judge's flag goes to the owner and gates only once the owner confirms it, until this ticket shows a judge can be trusted (#670).
- "Unknown" and "unchecked" never count as clean (#670).
- Tasks pass or fail on checks written before any run. Held-out tasks report only and never choose (#669).
- "Verified by <procedure>" covers only what the check tested (#663).
- There is one human reviewer. Their time is the scarce thing.

---

## 1. Short answer

1. **A judge can be shown to hold up. Nobody publishes one number that proves it.** The sources agree on the method: blind human labels on a held-out sample, chance-corrected agreement, separate hit and false-alarm rates, order-swap tests, and a fixed set of known-answer cases that is re-scored whenever anything changes.
2. **The sample sizes the sources give are bigger than the fleet's current plan.** The queued article-judge slice asks for 30 to 50 labels and 90% agreement. At 30 labels, a 90% score is consistent with a true rate anywhere from 73% to 98% (computed). It cannot tell a good judge from a mediocre one.
3. **Drift detection is cheap in owner time if anchors are frozen.** Re-scoring frozen, human-labelled anchors is machine work. The owner only looks at anchors that flip.
4. **Some things should never go to a model.** The ruled list is already machine checks against independent records. Section 6 adds candidates with their basis.
5. **Some dimensions may never calibrate.** The fleet has seen a judge fail to reach the bar on subjective dimensions across several tries. "This judge cannot be trusted here" is a legitimate result.

---

## 2. Prior entry points (required section)

The owner asked what is already captured. Selfco pages are named by title only. Paths are in a private index kept with the session notes.

### In Selfco

| Title | What it already decided or proposed |
|---|---|
| Two-phase judge calibration gate | Calibrate the judge first with the generator frozen. Iterate until agreement passes a stated bar (example: 80% per dimension). Only then correct the generator. Binary scores first. Open question: what agreement metric is honest at about 20 labels. [V] |
| Evaluation-Driven Development | Start with five scenarios that carry pass marks. Rule from the onboarding course: label first, never look at the judge's result before you do. Eval sets built from the corpus they test are self-flattering, so hold back a human-authored slice. [V] |
| RULER (judge-ranked label-free GRPO) | A judge that has passed calibration is the thing downstream training would use. Rule worth keeping: where an output can be checked rather than ranked, a deterministic verifier replaces both annotator and judge. [V] |
| Fleet-runner agent quality and enterprise assurance metrics | Defines grader false-accept and false-reject rates, sampled blind on both sides, with abstentions kept. Run known-good and known-bad solutions. Keep a held-out or rolling set. Freeze a small private coding suite and calibrate graders at the P1/P2 pilot. [V] |
| Fleet-runner learning and proof roadmap | Places grader calibration at the later pilot gates. No judge design of its own. [V] |
| Demystifying evals for AI agents (source page) | Exact-artifact checks, unseen error cases, human calibration, and separate counts for omissions and false approvals. One passing trial does not prove repeatable reliability. [V] |
| Primary guidance: agent evaluation, observability and guardrails | Calibrate graders against blinded human review of both passes and failures. Keep frozen regression cases and a rolling pilot set. [V] |
| OpenAI evaluation best practices (source page) and OpenAI skill evaluations | Calibrate model judges against humans. Watch position and verbosity bias. Include requests that should not trigger. [V] |
| The Karpathy Loop; Karpathy autoresearch in the ojfbot fleet; Karpathy autoresearch (source page) | An immutable evaluator is what makes the loop safe. An LLM judge is editable in effect, because the producing agent can learn to flatter it. Run shadow first, calibrate the ruler against the human, and write the promotion trigger before gathering data. Open question: how to make a judge un-cheatable (held-out scenarios, multi-judge panels). [V] |
| Loop harness | The judge must not be the author. Self-preference turns a self-scored gate into a rubber stamp. [V] |
| buddy-check (project page) | A graded judge against an expert's labels. Binary calibration was exhausted across five configurations on spectrum-type dimensions. The team built a graded calibration instead. A separate question-realism judge reached 0.80 agreement. [V] |
| Appliance research and fleet workloads; Dive research appliance fit inspection | Reusing calibration examples for development does not make them unseen qualification data. A local judge baseline on a small expert-reviewed set does not qualify a new model. "The judge was just too harsh" did not fit all findings. [V] |
| bldgblog-corpus (project page) | A calibration harness with a 25-item gold set. Verdict: prompt levers did not lift light models. [V] |
| Skill-text optimization; Microsoft SkillOpt; SkillOpt vs the ojfbot honest skill loop | An edit ships only on strict held-out improvement. Rejected edits are logged. [V] |
| Fleet-wide learning and adversarial correspondence toward deliverable roadmaps | Freeze diverse historical episodes before tuning. Keep held-out and fresh cases. Record who chose the cases and the expected answers. [V] |
| Newline AI Accelerator curriculum ingestion | Origin of the 80% per-dimension bar, binary scoring, low-temperature judges, and the worked example of a judge with 80% hit rate but 50% precision. [V] |
| Session note: tracing the "missing layers" claim (unfiled inbox item) | A judge-calibration position was merged into #510 rather than filed. It proposes a "same-provider judging rate" and treating judge disagreement and "unknown" as first-class values. Smallest test: about 30 historical verdicts, re-judged by a same-provider and a different-provider judge, adjudicated blind by the operator. A dissent wanted validator independence as its own question. [V] |
| Session note: hidden costs of gardening in ojfbot (unfiled inbox item) | Open question: when does a replay set that keeps being reused stop being held out? Warns that an agent can learn wording a judge prefers, and that agents favour their own synthesis. [V] |
| Enterprise-readiness checklist | Lists golden datasets for retrievers as "wiki silent". [V] |

Other hits in the vault were job-target trackers and unrelated topics. I did not use them.

### In the fleet repos

| Item | What it already decided or proposed |
|---|---|
| `decisions/opav/suggester-gold-v1-README.md` | 27 real rows, 9 held out. Headline metric is Cohen's kappa, not hit rate. Each row says whether its label is confirmed by behaviour or only proposed by an agent. A held-out number may be reported, never used to choose. A change picked because it helps the held-out part burns it. This is a classifier, not an AI judge. [R] |
| `decisions/opav/gold-set-v0-README.md` | A 30-minute owner labelling sitting. 9 of 13 agreed. All 4 misses shared one named cause. [R] |
| `docs/audits/AGENTIC-INTEGRATION-PLAN-2026-07-04.md` (slice I5 and guardrails) | "A judge is a product." Calibrate exactly one judge. At least 90% agreement. Freeze 10 labelled articles as a regression set. Re-run monthly and on every model upgrade. Alarm below 85%. Different model family from the generator where feasible. No judge output gates anything before it has a human-labelled agreement score. [R] |
| `decisions/northstar/roadmap-l2-ojfbot.md`, slice S20 | The article-accuracy judge. Still queued and human-only at my read. 30 to 50 owner labels, 90% held-out agreement, 10 frozen regression examples. It is the entrance for evaluating slice success mechanically. [R] |
| `decisions/research/2026-10-13-daily-article-evaluation-review.md` | Keeps S20's bar. Adds per-claim, severe-miss, abstention and uncertainty measures. Blind model identity and randomise order. Do not change generator and judge at once. [R] |
| `docs/audits/LOOP-ENGINEERING-CROSSCHECK-2026-07-09.md` | Keep the judge single-model and static, so it can be frozen and re-validated. [R] |
| `decisions/adr/0086-control-gated-slices.md` and the CLAUDE.md gate hook | A small judge runs in shadow mode. The judge false-block rate is one of two measures that gate promotion. About four weeks of data before any flip to enforce. [R] |
| `daily-logger/evals` | 10 golden tasks, all deterministic. No model is called. It is a code check, not a judge. [R] |
| diy-repair-qa-eval (public repo, iteration log and model comparison) | Real calibration history. Judge v1 had a lowest per-dimension agreement of 39.6% on 53 human-labelled items. Version 6 reached at least 80% on every dimension. A different judge model changed the verdict on borderline outputs. Sonnet could not be calibrated to the human on two subjective dimensions in three tries. A judge swap is its own new calibration round. [R] |
| Issue #510 | Judge calibration was folded into this existing observability decision record and not filed separately. [V] |
| Conflict-resolver model eval (private notes, outside git) | Scored by a deterministic harness and a verifier. I found no model grader in its README. I read only the README. [I] |

**What is missing across all of this:** no judge has yet passed any bar. S20 is queued. The one calibrated judge in the public repos is a research exercise on one task. Nothing covers judging agent rule-following, which is what #670 is about.

---

## 3. What evidence would show a judge can be trusted to gate on its own

### 3.1 The evidence the sources point to

1. **Blind human labels first.** The owner labels before seeing the judge's answer. [V] (Evaluation-Driven Development).
2. **One trusted expert, pass or fail, with a written reason.** [S] https://hamel.dev/blog/posts/llm-judge/ . The reasons become the examples inside the judge prompt.
3. **Split the labels.** Train, dev and test. 10–20% train, 40–45% dev, 40–45% test. At least 30 to 50 passes and 30 to 50 fails in both dev and test where possible. [S] https://hamel.dev/blog/posts/evals-faq/
4. **Report hit rate and false-alarm rate separately.** TPR and TNR, not one number. [S] same FAQ. A grader false-accept and false-reject definition with blind sampling of both sides is already in the fleet's metrics plan. [V] (Fleet-runner agent quality…).
5. **Report a chance-corrected number too.** Raw agreement overstates. Across 21 judges, the gap between exact match and Cohen's kappa was 33.8 to 41.3 points on MT-Bench. [S] https://arxiv.org/abs/2606.19544
6. **Swap the order.** Run each pair as AB and BA. Report how far P(A wins) is from 0.5. [S] https://arxiv.org/abs/2606.19544 (its "Minimum Viable Validation Protocol").
7. **Do not read stability as validity.** Two production judges had test–retest above 0.95 and position bias above 0.10. A steady judge can steadily prefer position A. [S] same paper.
8. **Judge from another model family than the author where feasible.** Models recognise and favour their own output. [S] https://arxiv.org/abs/2404.13076 and https://arxiv.org/abs/2410.21819 . Hamel's FAQ says the same model is usually fine if held-out agreement is good. [S] https://hamel.dev/blog/posts/evals-faq/ . The fleet plan asks for a different family. [R]
9. **Let the judge say "unknown", and count an unreadable verdict as unscored, not as a pass.** [S] https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents ; Inspect's built-in graders record an unparsable verdict as unscored. https://inspect.aisi.org.uk/model-graded.html . This matches #670. [I]
10. **Fix the judge's settings and keep what it returned.** Inspect's default grader runs at the provider's default temperature with no seed, so borderline grades change from run to run. [S] https://inspect.aisi.org.uk/model-graded.html
11. **Protect the judge from the text it reads.** Inspect puts a random code on the markers around each field, so a submission cannot fake a boundary. [S] https://inspect.aisi.org.uk/model-graded.html . Short universal phrases appended to an answer can inflate judge scores, more so for absolute scoring than for comparison. [S] https://arxiv.org/abs/2402.14016

### 3.2 How many owner labels? What the sources say, and what the maths says

Sources:

- Minimum start: about 30 minutes on 20 to 50 outputs. [S] https://hamel.dev/blog/posts/llm-judge/ (via the prior-art survey).
- Annotate at least 30 yourself, at least 100 in total. [S] https://hamel.dev/blog/posts/evals-faq/
- For a judge, 100 to 200 labels per failure mode. [S] same FAQ. **This is higher than the survey summary I was handed.**
- LangSmith's alignment guide suggests starting with at least 20, balanced across 0 and 1. [S] https://docs.langchain.com/langsmith/improve-judge-evaluator-feedback.md
- Fleet plan: 30 to 50 labels, 90% agreement. [R]

My calculations (exact binomial, computed):

| What the owner sees | What it proves (95% one-sided lower bound) |
|---|---|
| 27 of 30 agree (90%) | True agreement could be as low as 76%. Two-sided interval 73% to 98%. |
| 45 of 50 agree | Two-sided interval 78% to 97%. |
| 90 of 100 agree | Two-sided interval 82% to 95%. |
| 38 of 40 agree (95%) | Lower bound 85%. |
| 110 of 116 agree (95%) | Lower bound 90%. |
| 29 of 29 planted traps caught | Lower bound 90% on the catch rate. |
| 59 of 59 caught | Lower bound 95%. |
| 149 of 149 caught | Lower bound 98%. |

[I] So 30 to 50 labels support "not obviously bad". They do not support "at least 90%". Reaching a defensible 90% floor takes roughly 100+ labelled items on the class that matters, or a very high observed rate.

[I] Zero misses is the rule of three. If the owner wants "catches at least 98% of violations", that needs about 150 planted traps with none missed. Traps are cheaper than labels because agents can write them from real seeds and the owner only confirms the known answer.

### 3.3 Holding up on planted traps

Traps are cases with an answer fixed by an independent record. The sources suggest these kinds:

- **Known-good and known-bad solutions.** A reference solution should pass all graders, which shows the task is solvable and the grader is set up right. [S] https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents . A wrong or no-op solution should fail. [V] (Fleet-runner agent quality and enterprise assurance metrics).
- **A constant, irrelevant answer.** A model that always returns one fixed string reached top win rates on three automatic benchmarks. [S] https://arxiv.org/abs/2410.07137
- **Appended praise or "grade: pass" text,** in the answer being judged. [S] https://arxiv.org/abs/2402.14016
- **Padding and length.** Longer wins more often with some judges. Newer evidence says verbosity bias is small for current frontier judges under one pairwise rubric. Measure it on fleet output, do not assume. [S] https://arxiv.org/abs/2606.19544 ; https://arxiv.org/abs/2306.05685
- **Same-family against other-family output.** Same content, different author. [I] Based on the self-preference papers above.
- **Rule-following traps from the #670 design.** A task with a planted temptation. The right answer follows from the grant in force. [R/ruling, see #670]. [I] A judge is the wrong tool for that expected answer, but a judge's flag about it is exactly what must be tested.

---

## 4. How drift is detected after that

1. **Anchors.** Keep a frozen set of human-labelled items. Re-score them with the current judge on a schedule and whenever anything changes. If the judge moves on anchors, the judge changed. The product cannot move frozen anchors. [S] https://arxiv.org/abs/2606.15474 (preprint, June 2026). A silent version bump was caught as judge drift in 60 of 60 runs with no case blamed on the system. A rolling z-test false-alarmed on 75% of streams where nothing changed.
2. **The anchor budget matters.** In that paper, 200 anchors interleaved at 1 in 5 caught the bump every time. 50 anchors at 1 in 20 caught it in 4 of 60. [S] same paper, Table 2. The paper is about a stream of live scores that a cheap monitor produces. [I] Anchors cost the owner nothing to re-score, because the labels are already made. The limit for the fleet is therefore machine cost, not owner minutes. Re-score all 20–30 anchors often.
3. **What triggers a re-check.** A change of judge model, prompt, rubric, harness, or the model identifier the API returns. Hosted models change without notice. [S] https://arxiv.org/abs/2307.09009 . The fleet's own plan already says re-run monthly and on every model upgrade. [R] [I] Record the returned model id on every run, so a silent change is visible.
4. **Order bias on a schedule.** Re-run the AB/BA swap when the judge changes. [S] https://arxiv.org/abs/2606.19544
5. **Owner drift.** People change what they count as good as they grade. The EvalGen study calls this criteria drift. [S] https://arxiv.org/abs/2404.12272 . [I] Have the owner re-label a few anchors blind each quarter, and treat any flip as a finding about the label, not only the judge.
6. **A blind audit sample.** Anthropic says human review can be occasional once the grader is robust, but it names ongoing calibration and reading transcripts. [S] https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents . Braintrust also says to rerun calibration on an expanded set. [S] https://www.braintrust.dev/docs/best-practices/scorers
7. **Held-out discipline applies to the judge too.** If dev results pick the judge prompt or model, the test set stops being clean. [S] https://hamel.dev/blog/posts/evals-faq/ . This matches the fleet rule that a held-out set which chooses is burned. [R] (suggester-gold README).
8. **Watch what the judge cannot see.** The judge's "unknown" rate, its unscored count, and any rise in owner overrides. [I]

Small-n limits: with 30 anchors, a drift of a few points is invisible. [I] A single flip is not proof. A pre-set rule, such as "two or more flips on one re-score means stop and look", is the owner's to choose.

---

## 5. Candidate trust bars, with owner minutes

I choose none. Each is a package of evidence. All assume one judge on one task family. A second judge or a second task family repeats the setup. [I] The fleet's own history says a judge swap is a fresh calibration round. [R]

**Assumption for time [I]:** one owner label takes 2 minutes for a short pass/fail with a one-line reason, and 6 minutes when the owner must read a diff or report. The owner should time a real batch before deciding. Figures are rounded.

### Bar A — "Small and anchored" (close to the queued S20 plan)

- Evidence: 40 owner labels (about half held out). Raw agreement and kappa reported with n. Order-swap test. 10 labelled anchors frozen. Judge from another family where feasible. "Unknown" allowed.
- Trust gained [I]: ruling out a bad judge. It cannot show a 90% floor. At 19 of 20 on held-out, the lower bound is 78%.
- Setup: 80 min at 2 min per label, 240 min at 6.
- Each month: about 5 to 10 min. The machine re-scores 10 anchors. The owner reviews flips.
- On a judge, model or prompt change: re-score anchors, about 15 min.

### Bar B — "Interval and traps"

- Evidence: about 100 owner labels per judge and task family, split train/dev/test. At least 30 passes and 30 fails in the final test. TPR and TNR and kappa reported with 95% lower bounds. 29 or more planted traps, all caught (lower bound 90%). AB/BA swap. At least 3 reruns at temperature 0 with caching off. Different family from the author. 20 to 30 anchors frozen.
- Trust gained [I]: a stated floor for hit rate and false-alarm rate on that task family, plus evidence against the common cheats.
- Setup: 200 min at 2 min per label, 600 min at 6. Plus about 30 min to confirm trap answers. Agents write the traps.
- Each month: about 10 to 15 min on anchor flips. About 15 to 30 min each time the judge, its prompt or its model changes.
- Spread over a year: roughly 15 to 25 min a month. [I]

### Bar C — "Judge may only hold, never clear, plus a standing audit"

- Evidence: everything in Bar B. In addition, the judge's verdict may block or hold on its own, but never clears. A clear needs a machine check or a confirmed sample. This follows the shape of #670, where unknown is never clean. [I]
- Each month, a script picks 30 verdicts (15 judge-pass, 15 judge-fail). The owner labels them blind, before seeing the judge. [V] (Evaluation-Driven Development: never look at the judge first.)
- A tripwire, set by the owner, pauses the judge if audit agreement drops.
- Setup: same as Bar B.
- Each month: 60 min at 2 min per label, 180 min at 6. Plus Bar B's 10 to 15.
- Total: about 70 to 195 min a month. [I]

### Reference — what #670 already costs

The judge never gates alone. The owner confirms every flag. Monthly cost = flags per month × minutes per confirmation. At 20 flags and 3 min, that is 60 min. At 100 flags, 300 min. I do not know the flag volume. [I]

### Reading the table

- Bars A and B cost almost nothing per month. Bar B front-loads the labels.
- Bar C trades monthly minutes for a live measure of miss rate.
- [I] **A cheaper use of a judge exists.** Use it to estimate rates, not to rule on single items. With a known hit rate and false-alarm rate, the judge's counts can be corrected to an estimate of the true rate. Husain says the same: once you know TPR and TNR you can correct the estimates. [S] https://hamel.dev/blog/posts/evals-faq/ . Prediction-powered inference is a formal version. [S] https://arxiv.org/abs/2301.09633 . Whether it fits fleet tasks is untested.

---

## 6. What must never be judged by a model

Ruled by the owner already:

- A critical violation may be declared only by a fixed machine check against independent records. [R/ruling] #670.
- "Unknown" and "unchecked" never count as clean. #670.
- The expected answer comes from independent records, never from an agent's own report. #669.
- "Verified by <procedure>" covers only what the check tested. #663.

Candidates the evidence supports. The owner decides which become rules:

| Candidate | Basis |
|---|---|
| Anything a program can check: tests pass, file hash matches, counts, denominators, grant present or expired, path or secret patterns. | Anthropic and Braintrust both say to prefer deterministic graders where possible. [S] https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents ; https://www.braintrust.dev/docs/best-practices/scorers . Selfco says to check rather than rank wherever an output can be checked. [V] (RULER). |
| An agent's judgement of its own work or its own sibling-family work. | Self-recognition and self-preference. [S] https://arxiv.org/abs/2404.13076 . The fleet rule: the judge must not be the author. [V] (Loop harness). |
| Whether the judge itself is calibrated: the owner's labels, the anchor set, the held-out cut, the agreement figures. | If the judge marks its own homework the instrument stops being independent. [I] |
| Clearing a flag or item where a miss is costly, and no machine check backs it. | Hit rate must be high where a miss is costly. [S] https://hamel.dev/blog/posts/evals-faq/ . [I] Not yet supported for any fleet judge. |
| Text the judge reads that came from the agent being judged, with no protection. | Judges can be steered by what they read. [S] https://arxiv.org/abs/2402.14016 ; https://inspect.aisi.org.uk/model-graded.html |
| Whether a task or a trap is valid, and whether its answer key is right. | Grading bugs and ambiguous tasks cost one lab a score of 42% where the true result was 95%. [S] https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents |
| Dimensions where calibration failed. | Subjective dimensions did not reach the bar in fleet history. [V] (buddy-check); [R] diy-repair-qa-eval. The code-judge study found even the best judges 12–23% below human annotators on developer preference. [S] https://arxiv.org/abs/2603.24586 |

---

## 7. What the evidence argues against

Not decisions. These are things the sources say do not give you what they seem to.

- **Raw agreement alone.** It overstates by tens of points. [S] https://arxiv.org/abs/2606.19544
- **Test–retest stability as proof.** [S] same paper.
- **30 to 50 labels as proof of a 90% floor.** Computed above. [I]
- **Several judges from one family agreeing.** The vault records that same-family reviewers agreeing is not cross-model validation. [V] (Appliance adversarial review pages).
- **A multi-judge panel as a replacement for human calibration.** Anthropic lists consensus as a method that still needs calibration. [S] https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents
- **A rolling z-test on judge scores to detect drift.** False-alarmed on 75% of quiet streams. [S] https://arxiv.org/abs/2606.15474
- **1–5 scales early on.** Husain, Braintrust and the vault all prefer binary. [S] https://hamel.dev/blog/posts/llm-judge/ ; https://www.braintrust.dev/docs/best-practices/scorers ; [V] (Two-phase judge calibration gate).
- **Reusing development labels as qualification data.** [V] (Appliance research and fleet workloads); [S] https://hamel.dev/blog/posts/evals-faq/
- **Changing generator and judge together.** [R] daily-logger article review; [V] (Two-phase judge calibration gate).

---

## 8. Embedding caveat (ticket context)

- Vectors from different embedding models are not comparable. Regenerate the whole corpus with the new model, even if the dimensions match. [S] https://www.mongodb.com/docs/voyageai/tutorials/migrate-embedding-model/
- Evaluate the new model's retrieval on a representative sample of your own data before you switch. [S] same page.
- Dual index, alias switch, backfill and a labelled query set scored by Recall@10, MRR and nDCG@10 are the usual route. [S] Qdrant's migration guide and Weaviate's vectorizer guide, as read in the prior-art survey (not re-read for this ticket).
- [I] This is a retrieval measure that needs no AI judge. Recall against labelled queries is deterministic. So the embedding caveat does not depend on this ticket's judge bar. It needs the same kind of frozen, labelled query set, kept separate from the tuning set.
- [I] Whether the fleet's stored vectors record model id, revision and dimension is unknown. I did not inventory them. The Selfco pages mention a local embedding index in one project. [V]

---

## 9. Gaps and caveats

- **No source gives a validated number for "a judge may gate alone".** Thresholds in the sources are rules of thumb. The common kappa rule (about 0.61 for "good") is secondhand and I did not verify it.
- **I found no "TPR and TNR at least 0.90" bar in Husain's FAQ text.** The earlier survey flagged it as secondhand. It remains unconfirmed. I searched the FAQ by keyword and did not read every line.
- **Correction to the earlier survey.** It said top judges were only 6–18% above random in a code-judge study. The paper's abstract says the best of 13 judges underperform human annotators by 12–23%. https://arxiv.org/abs/2603.24586
- **Correction to the earlier survey.** Its "50–100 labelled outputs" kit sits below Husain's current FAQ figure of 100–200 labels per failure mode.
- **Nothing studies judges on agent rule-following.** The studies cover chat preference, coding preference and summaries. Whether they transfer to "did the agent act without a grant" is untested. [I] That is another reason #670 keeps this to machine checks.
- **Drift evidence is thin.** One June 2026 preprint with two real judge changes, plus one 2023 study of hosted-model change. I read the first in full and the second as an abstract. I found no study that tracks one judge across many provider updates.
- **Not covered:** Reddit (unreachable in earlier passes; I did not retry), lighteval, METR, and the second half of Inspect's scoring docs.
- **LangSmith and Braintrust:** I read LangSmith's alignment guide and Braintrust's scorer guide. Vendor pages describe a workflow, not evidence it works.
- **Selfco search was read-only and keyword-based.** The vault has hundreds of inbox files. I may have missed a thread that does not use these words.
- **Owner-minute figures rest on my 2 and 6 minutes per label.** They are not measured.
- **Several papers I read only as abstracts or in part:** 2306.05685, 2404.13076, 2404.12272, 2410.21819, 2410.07137, 2402.14016, 2307.09009, 2301.09633, 2603.24586. I read 2606.19544 and 2606.15474 in full text.

---

## Method note

Exact (Clopper–Pearson) bounds, one-sided 95% unless I say two-sided. Computed with a short standard-library script. "n of n traps caught" uses the same bound with zero misses. These bounds assume independent items. Items from one incident family are not independent. [I] Count a family once.

## Sources

- Zheng et al., judging LLM-as-a-judge: https://arxiv.org/abs/2306.05685
- Panickssery et al., self-recognition and self-preference: https://arxiv.org/abs/2404.13076
- Wataoka et al., self-preference and perplexity: https://arxiv.org/abs/2410.21819
- Shankar et al., EvalGen, criteria drift: https://arxiv.org/abs/2404.12272
- Reliability without Validity (21 judges): https://arxiv.org/abs/2606.19544
- Who Drifted: the System or the Judge?: https://arxiv.org/abs/2606.15474
- Comparing developer and LLM biases in code evaluation: https://arxiv.org/abs/2603.24586
- Null models cheat automatic benchmarks: https://arxiv.org/abs/2410.07137
- Universal adversarial attacks on LLM judges: https://arxiv.org/abs/2402.14016
- How is ChatGPT's behaviour changing over time: https://arxiv.org/abs/2307.09009
- Prediction-powered inference: https://arxiv.org/abs/2301.09633
- Anthropic, Demystifying evals for AI agents: https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents
- OpenAI, evaluation best practices: https://developers.openai.com/api/docs/guides/evaluation-best-practices
- Inspect model grading: https://inspect.aisi.org.uk/model-graded.html
- LangSmith, improve LLM-as-judge evaluators: https://docs.langchain.com/langsmith/improve-judge-evaluator-feedback.md
- Braintrust scorer design: https://www.braintrust.dev/docs/best-practices/scorers
- Hamel Husain, Using LLM-as-a-Judge: https://hamel.dev/blog/posts/llm-judge/
- Husain and Shankar, AI Evals FAQ: https://hamel.dev/blog/posts/evals-faq/
- MongoDB and Voyage AI, embedding model migration: https://www.mongodb.com/docs/voyageai/tutorials/migrate-embedding-model/
