---
type: research
ticket: "How do other teams keep a retrieval knowledge store true over time?"
map: decisions/wayfinder/staleness-and-retirement.md
date: 2026-11-24
scope: "Stores an agent retrieves from: RAG document and vector stores, knowledge graphs used as agent memory, LLM-maintained wikis. Not rules files, hooks, skills or conversational memory (previous ticket)."
sources_read: 14 pages from 11 publishers, all read 2026-11-24
---

# How other teams keep a retrieval knowledge store true

One research cycle, 2026-11-24. I read each source cited here on that date. Nothing is
cited from memory. This file recommends nothing. It ends with options the evidence makes
available, each tied to its sources.

It pairs with [retiring-agent-instructions-2026-11-24](retiring-agent-instructions-2026-11-24.md).
That file already covers agent memory: Copilot Memory expiry and citation checks, Mem0's
delete-or-mark-invalid choice, Letta and Anthropic background consolidation, and ACE
curation. None of that is repeated here. Zep is on the line between the two scopes. The
previous file did not cover it, so it is covered here.

**Grades.** **M** = measured (the source reports data or a described experiment).
**A** = asserted (the source claims it without data). **D** = documented behaviour (a
product's or project's own documentation says it does it). Every D finding is as of the
date read.

**Terms.** *Untrue*, *unused* and *superseded* are the map's working terms, not decided.
I use them only to sort what the sources do.

## 1. Table

| # | Mechanism | What it detects | Who or what decides | What happens to the old item | Grade | Source |
|---|---|---|---|---|---|---|
| 1 | Bi-temporal fact edges; LLM compares each new fact with related old ones at write time | Superseded (a newer fact contradicts an older one in overlapping time) | An LLM at ingest. Newer information wins | Kept. Its `invalid_at` is set to the new fact's `valid_at`; `expired_at` records when | M (system benchmark, no ablation of this step) + D | [S1], [S2] |
| 2 | Statement ranks: preferred, normal, deprecated | Superseded (old but once-true values) and untrue (values known to be wrong) | Community editors | Kept. Past values stay normal; current gets preferred; errors get deprecated, with a reason. Default queries skip deprecated | D | [S7] |
| 3 | Inline "as of" dating on each time-sensitive statement, feeding dated maintenance categories | Likely to go untrue with time | The editor who writes the statement tags it; volunteers work the queue | Statement is updated in place when someone gets to it | D | [S8], [S9] |
| 4 | Owner verification with an expiry interval | Neither directly: time since a person vouched for the item | A named verifier or group | Becomes unverified; still searchable and usable in answers (Guru). Owner is notified (Notion) | D | [S5], [S6] |
| 5 | Daily agent verify/unverify run over rules on usage and content | Mixed: usage (views, thumbs, used in an answer) and content (dates in text, duplicates) | A knowledge agent; owners set the rules | Unverified, flagged or archived. Retrieval can be scoped to verified content only | D | [S5] |
| 6 | Source-to-index sync by content hash, with cleanup modes | Source changed or no longer returned by the loader | Mechanical | Derived chunks deleted | D | [S4] |
| 7 | Bot checks cited links; replaces dead ones with archived copies | The cited source is unreachable (not that the claim is wrong) | A bot; per-wiki admins configure it | Link replaced by an archive copy, or tagged permanently dead | D + M (a later audit of its verdicts) | [S10], [S11] |
| 8 | Periodic LLM "lint" of the wiki | Untrue (contradictions, stale claims superseded by newer sources) and unused (orphan pages) | The LLM proposes; the person guides | Not specified | A | [S3] |
| 9 | Dates on retrieved evidence; current date in the prompt; recency ordering or time-decay ranking | Age only | Mechanical ranking, then the model at read time | Kept; placed earlier in context or ranked lower | M | [S12], [S14] |

## 2. Untrue against unused: which signal each system uses

- **Contradiction with a newer item, at write time.** Zep's Graphiti engine has an LLM
  compare each new edge with semantically related old edges. When it finds a contradiction
  whose time ranges overlap, it marks the old edge invalid. It always prefers the newer
  information by ingestion order [S1] (D, described in the paper). This catches
  *superseded*, not untrue in general: a claim nobody contradicts stays valid.
- **Zep says its dates are not a truth signal.** Its docs say of the validity fields: "The
  fields do not establish that the source content or the derived fact is true." [S2] (D).
  Wikidata draws the same line between references and ranks. A reference says where a
  value came from. A rank says which value is held most correct [S7] (D).
- **Content that names a date.** Guru's content-based rules have an AI read the text for
  dates and time-sensitive topics. A "2025 Benefits" document read in 2025 is verified;
  evergreen how-to content is verified too [S5] (D). Wikipedia does the same by hand: the
  writer tags a time-sensitive statement with its date [S9] (D).
- **Reader feedback.** In Guru's worked example, a document used in 20 answers and flagged
  wrong by 8 people is unverified automatically [S5]. The example is illustrative, not data.
- **Source change or loss.** LangChain's indexing API notices when a source's content hash
  changes or the source is no longer returned, and cleans up what was derived from it [S4]
  (D). InternetArchiveBot notices when a cited link breaks [S10] (D). Both say the source
  moved. Neither says the claim is wrong.
- **Usage, standing in for truth.** Guru's behavioural rules verify content on usage: for
  example, five thumbs-up in a month, or use in three helpful answers in 30 days. Rules
  can also key on views, copies and saves [S5] (D). This treats being used and liked as
  evidence of being current.
- **Usage, as its own signal.** Karpathy's lint step lists orphan pages with no inbound
  links next to contradictions and stale claims, as separate checks [S3] (A).
- **Unused items are not re-checked.** Guru's agent reviews an external source only after
  that agent has used it in an answer [S5] (D). An item nobody retrieves is never tested
  for truth.

## 3. Dating and validity

- **Two timelines per fact.** Zep stores four timestamps on each fact edge. `created_at`
  and `expired_at` are on the system's own timeline (when it recorded or invalidated the
  fact). `valid_at` and `invalid_at` are on the world's timeline (when the fact held)
  [S1], [S2] (D). The paper calls this bi-temporal [S1].
- **Where the world-time comes from.** Each episode carries a reference time. Zep resolves
  relative phrases against it: "started one week ago", stated on 15 May, gives a `valid_at`
  of 8 May [S2] (D).
- **Inline dating in prose.** Wikipedia's style guide says to avoid "currently", "now",
  "recently" and "to date" in favour of a dated phrase such as "as of November 2026", with
  the `{{as of}}` template [S8] (D). Every separate time-sensitive statement gets its own
  tag, so that updating one does not leave the others unchecked [S9] (D). The tag is not for
  historical facts that will not change. A known future date gets `{{update after}}`
  instead [S9] (D).
- **Dates feed a queue.** Each tagged statement puts its article in a category by month
  and year. Volunteers work through the categories, oldest first if they like, and update
  the statement or the tag [S9] (D). No schedule or owner is named.
- **Verification dates are not validity dates.** Guru's card shows a verification or
  expiration date and who last verified it. Guru calls verification a "freshness date"
  [S5] (D). It records when someone vouched, not when the claim held.
- **What happens at retrieval when an item is old.**
  - Wikidata's default ("truthy") queries return the best-ranked value: preferred if any,
    otherwise normal. Deprecated values are left out unless asked for [S7] (D).
  - Zep puts `valid_at` and `invalid_at` into the context block it sends to the model
    [S2] (D). The model sees the dates. I found no statement in the pages I read on whether
    default search leaves invalidated facts out.
  - Guru lets an owner scope an agent's search to verified content only, to verified plus
    unreviewed, or to everything [S5] (D). Notion ranks verified pages higher in search and
    in Notion AI answers [S6] (D).
  - FreshPrompt gives each retrieved snippet its source, date and title. Sorting snippets by
    date, newest last, or keeping search order, beat random order by up to 2.2 points [S12]
    (M).
  - HoH added the current date to the system prompt, a last-modified time on every
    document, an instruction to prefer the most current information, and a time-decay
    ranking in its search engine [S14]. Outdated documents still cut accuracy sharply (see
    §7) (M).

## 4. Supersession and contradiction: what happens to the old item

| Old item is… | Who decides | Systems | Grade |
|---|---|---|---|
| Kept, marked invalid with an end time | LLM at write time | Zep [S1], [S2] | D |
| Kept, ranked: current preferred, past normal, wrong deprecated with a reason | Editors | Wikidata [S7] | D |
| Updated in place | An editor, when they reach the queue | Wikipedia [S9] | D |
| Kept, unverified; still retrievable unless the owner scopes search | Agent rules or verifier | Guru [S5] | D |
| Deleted (derived chunks) | Mechanical, on source change or absence | LangChain [S4] | D |
| Kept, ranked lower or placed earlier in context | Ranking, then the model | FreshPrompt [S12], HoH [S14] | M |
| Flagged on ingest | LLM, with the person guiding | Karpathy wiki [S3] | A |

- **Why Wikidata keeps wrong values.** Its help page gives three reasons to deprecate
  rather than delete. Others learn not to re-add the value. The history of an idea stays
  visible. And Wikidata records what sources say, not what is true [S7] (D). It also
  separates two cases: a correct historical value (for example a past mayor) stays normal
  rank, and only an error or a once-believed falsehood is deprecated [S7] (D).
- **Leaving it to the model at read time.** When old and new both reach the context, the
  model arbitrates. ClashEval found six strong models adopted incorrect retrieved content
  over their own correct prior more than 60% of the time. They were less likely to adopt it
  the further it was from the truth [S13] (M).
- **Duplicates.** Guru's content rules can unverify a card as a near-copy of another and cite
  the copy. The agent acts only on the card under review, not on the duplicate it found
  [S5] (D).

## 5. Re-verification: does anyone re-check stored claims?

- **Agent runs on a schedule.** Guru's knowledge agents check quality once a day. After
  reviewing an item they wait 7 days before reviewing it again, to avoid flipping borderline
  items. Unverify rules run before verify rules [S5] (D). Auto-verify is on by default for
  agents built after January 2026. Auto-unverify is off by default [S5] (D).
- **People on an interval.** Guru verifiers can set intervals of 30, 60 or 90 days, 6 months
  or a year, which send reminders. The current default is "Does not expire", and the docs
  recommend it for most content, leaving checks to the agent [S5] (D). Notion pages can be
  verified for a set time or indefinitely; at expiry the owner gets an inbox and email
  notice [S6] (D). Neither says what share of reminders are acted on.
- **A volunteer queue.** Wikipedia's dated "as of" categories are worked by volunteers when
  they choose to [S9] (D).
- **Source links, by bot.** InternetArchiveBot watches new outgoing links on Wikimedia
  wikis and fixes broken ones [S10] (D). An audit of 10,000 links it had tagged
  "permanently dead" found 3% worked again, and over 15% had usable archived copies [S11]
  (M). The verdict itself went stale and was not re-checked.
- **Diffing snapshots.** HoH rebuilds its benchmark monthly from new Wikipedia snapshots. A
  fine-tuned 0.5B-parameter model picks out genuine factual changes with 96.8% accuracy
  [S14] (M). This re-checks a dataset, not a production store. FreshQA's authors also commit
  to regular updates because answers change [S12] (A).
- **Against the world, at read time.** FreshPrompt and HoH retrieve from a live or mock
  search engine at question time [S12], [S14]. That re-checks nothing stored; it fetches
  again.
- **Cost.** No source reports what re-verification costs, in tokens, money or hours. No
  source reports what share of items a re-check changed, apart from the link audit [S11].

## 6. Removal

- **Mechanical deletion of derived items.** LangChain's `index()` keeps a record of each
  document's hash and source id. Its cleanup modes [S4] (D):
  - `incremental` and `scoped_full`: delete derived documents not updated in this run,
    for source ids seen in this run.
  - `full`: delete every document the loader did not return in this run. The reference
    warns that the loader must return "the entire dataset", or valid content is deleted.
  - `None`: delete nothing.
- **Manual deletion.** Zep deletes a fact when someone deletes its edge [S2] (D).
- **Deletion avoided by design.** Wikidata deprecates instead [S7] (D). Zep invalidates
  instead [S1] (D).
- **Archiving by agent.** Guru says its agents flag or archive inaccurate content [S5] (D).
  The page does not say which rules archive rather than unverify.
- **Append-only source, changing derived layer.** Two published patterns:
  - Zep keeps raw episodes as a non-lossy store. Derived fact edges and their source
    episodes keep two-way indices [S1] (D). The source stays; derived facts change.
  - LangChain ties each derived chunk to a source id and hash. When the source changes or
    goes, its chunks go [S4] (D).
  - Karpathy's pattern keeps raw sources immutable: the LLM reads them and never edits them
    [S3] (A). It says nothing on how a wiki page is retired when its source is kept but has
    gone out of date.
  Neither published pattern covers that case either. In LangChain's model a source that is
  still present but no longer true keeps all its chunks.

## 7. Measured harm from stale or contradictory content

- **Outdated documents cut accuracy even when the current one is retrieved.** In HoH, the
  presence of outdated information alongside current information dropped performance by at
  least 20% in mainstream models. Some fell below random guessing [S14] (M). This was with
  dates in the prompt and time-decay ranking on [S14].
- **Outdated alone is worse than nothing.** When only outdated passages were retrieved,
  models gave more harmful answers than when nothing relevant was retrieved. With nothing,
  they showed more uncertainty [S14] (M).
- **Wrong context overrides correct knowledge.** Over 60% adoption of incorrect retrieved
  content in ClashEval [S13] (M). Caveat: the wrong values were synthetic perturbations of
  correct documents, not naturally outdated ones.
- **Fast-changing facts are the weak spot.** All models tested on FreshQA struggled most on
  fast-changing and false-premise questions [S12] (M).
- **Graph memory with invalidation, versus full context.** On LongMemEval's
  knowledge-update questions, Zep scored 83.3% against 78.2% for full context with gpt-4o,
  and 74.4% against 76.9% with gpt-4o-mini [S1] (M). The comparison is against the whole
  conversation in context, not against Zep without invalidation. It does not isolate the
  effect of marking old facts invalid.
- **No production incident data.** Every measurement here is a benchmark. None studies an
  LLM-maintained wiki.

## 8. Gaps: where published practice says nothing

- **LLM-maintained wikis.** The only source is Karpathy's gist [S3]. Its lint step names
  contradictions and "stale claims that newer sources have superseded" as things to look
  for, with no method, rate or result.
- **Ablations.** No source compares invalidate, deprecate, delete and rank-lower against
  each other. Zep reports no result for invalidation on its own [S1].
- **Cost of re-verification.** Not reported by any source.
- **A kept source that is no longer true.** Derived-layer sync covers a source that
  changes or disappears [S4], [S1]. Nothing covers an append-only source that stays but has
  aged.
- **Propagation into synthesis.** When one of several sources behind a summary page is
  superseded, no source says how the summary is found and re-derived. Zep keeps the indices
  that would allow it [S1], but I found no description of it doing so.
- **Retrieval rules for dated items.** Wikipedia dates statements for human upkeep [S9].
  No source says how a retriever should treat an "as of" claim past some age.
- **Precision of contradiction detection over wiki pages.** Not found.

## 9. Disagreements

- **Is usage evidence of truth?** Guru's rules verify content on usage and positive
  feedback [S5]. Zep says its validity fields do not establish truth [S2], and Wikidata
  says references do not either [S7]. No source tests whether used content is more often
  correct.
- **Delete or keep?** LangChain deletes derived chunks when the source changes [S4].
  Zep [S1] and Wikidata [S7] keep the old item and mark it. Each gives reasons; none
  measures the choice.
- **Who decides?** An LLM at write time (Zep [S1]), editors (Wikidata [S7], Wikipedia
  [S9]), an agent under owner-set rules (Guru [S5]), or the owner alone (Notion [S6]).
- **How much do dates help?** Date-aware ordering gave up to 2.2 points in FreshPrompt
  [S12]. HoH still saw at least a 20% drop with dates and decay on [S14]. Setups differ, so
  this may not be a direct conflict.
- **A bot's verdicts against an audit.** InternetArchiveBot tags links permanently dead
  [S10]. The IMC 2022 audit found 3% of a sample live again and over 15% with usable
  archives [S11].
- **Human intervals or agent checks.** Guru still offers verifier intervals but now
  defaults to "Does not expire" and recommends leaving checks to its agent [S5]. This
  looks like a change over time at one vendor, not a dispute between teams.
- **Within one page.** The InternetArchiveBot page says the bot fixes links on over 400
  wikis, and also that it runs on 300+ [S10].

## 10. Not found

- Any published study of keeping an LLM-maintained wiki true over time.
- Any measured comparison of invalidate, deprecate, delete or rank-lower.
- An ablation of write-time invalidation in a graph memory.
- Any cost figure for re-verifying stored claims.
- Any report of what share of items a scheduled re-check changed, except the link audit [S11].
- Any mechanism for a source that stays in an append-only layer but is no longer true.
- Any method for finding and re-deriving summary pages whose sources were superseded.
- Any retrieval-time rule for dated ("as of") claims past a given age.
- Whether Zep's default search leaves invalidated facts out (not stated in pages read).
- Which Guru rules archive rather than unverify.
- Production incident reports of harm from stale retrieved content.

## 11. Options the evidence makes available

No recommendation. Each option is tied to the sources that show it in use.

- Store two times per claim (world validity and record time), and on a write-time
  contradiction mark the old claim invalid rather than delete it [S1], [S2].
- Keep superseded and wrong items with a rank and a reason; leave the lowest rank out of
  default retrieval [S7].
- Date each time-sensitive statement inline; let the dates build a review queue [S8], [S9].
- Owner verification with an expiry and a notice to the owner [S5], [S6].
- A daily agent run over usage and content rules, with a cooldown; scope retrieval by
  verification status [S5].
- Hash-tracked sync from source to derived items, deleting derived items when the source
  changes or goes [S4].
- Scheduled checks of cited links with an archive fallback, and re-checks of earlier
  "dead" verdicts [S10], [S11].
- Put dates and the current date into what the model reads; order or decay by recency,
  knowing the measured limit [S12], [S14].
- Diff snapshots of a source with a small classifier to find factual changes [S14].
- A periodic LLM lint for contradictions and superseded claims, proposed to a person [S3].

## 12. Sources

All read 2026-11-24.

| Ref | Title | URL | Kind |
|---|---|---|---|
| S1 | Rasmussen et al., Zep: A Temporal Knowledge Graph Architecture for Agent Memory (arXiv 2501.13956v1, 2025-01-20) | https://arxiv.org/html/2501.13956v1 | Paper by the team that runs the system |
| S2 | Facts (Zep docs, v4) | https://help.getzep.com/facts | Vendor docs |
| S3 | Karpathy, LLM Wiki (GitHub gist; main text only) | https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f | Design note by the pattern's author |
| S4 | `index` (LangChain Reference, langchain-core v1.8.4) | https://reference.langchain.com/python/langchain-core/indexing/api/index | Vendor docs |
| S5 | How Content is Verified in Guru (Guru Help) | https://help.getguru.com/docs/verifying-and-unverifying-cards | Vendor docs |
| S6 | Verify knowledge your teammates can trust (Notion Help) | https://www.notion.com/help/guides/verify-knowledge-your-teammates-can-trust-with-page-verification | Vendor docs |
| S7 | Help:Ranking (Wikidata; last edited 2026-10-26) | https://www.wikidata.org/wiki/Help:Ranking | Project docs |
| S8 | Manual of Style/Dates and numbers, "Statements likely to become outdated" (Wikipedia; last edited 2026-11-18) | https://en.wikipedia.org/wiki/Wikipedia:Manual_of_Style/Dates_and_numbers | Project docs |
| S9 | Wikipedia:As of (last edited 2026-03-09) | https://en.wikipedia.org/wiki/Wikipedia:As_of | Project docs |
| S10 | InternetArchiveBot (Meta-Wiki; last edited 2026-11-14) | https://meta.wikimedia.org/wiki/InternetArchiveBot | Project docs |
| S11 | Nyayachavadi, Zhu, Madhyastha, Characterizing "Permanently Dead" Links on Wikipedia (ACM IMC 2022) | https://www.harsha.usc.edu/files/2022/09/imc22-perm-deadlinks.pdf | Paper |
| S12 | Vu et al., FreshLLMs: Refreshing Large Language Models with Search Engine Augmentation (arXiv 2310.03214v2, 2023-11-22) | https://arxiv.org/html/2310.03214v2 | Paper |
| S13 | Wu, Wu, Zou, ClashEval: Quantifying the tug-of-war between an LLM's internal prior and external evidence (arXiv 2404.10198v2, 2024-06-10) | https://arxiv.org/html/2404.10198v2 | Paper |
| S14 | Ouyang et al., HoH: A Dynamic Benchmark for Evaluating the Impact of Outdated Information on Retrieval-Augmented Generation (arXiv 2503.04800v3, 2025-07-18) | https://arxiv.org/html/2503.04800v3 | Paper |

**Read but not cited.**
- Wang et al., Retrieval-Augmented Generation with Conflicting Evidence
  (https://arxiv.org/html/2504.13079v1). It studies misinformation and ambiguity, not
  outdated content, and ClashEval [S13] already covers wrong retrieved content.
- LangChain blog, Syncing data sources to vector stores (2023,
  https://www.langchain.com/blog/syncing-data-sources-to-vector-stores). The current
  reference [S4] supersedes it.
- Comments under the Karpathy gist [S3]. Some report measurements for third-party memory
  tools. They are self-reported, about agent memory (out of scope), and were not read as
  part of the main text.
- The LangChain how-to page `python.langchain.com/docs/how_to/indexing` now redirects to
  a general overview and holds no indexing content.

**Method.** Generic web searches (no fleet names). Pages fetched with `curl`, turned into
plain text and searched by keyword; the IMC paper with `pdftotext`. I read the passages
cited, not every page end to end. Quotes are kept to one short passage per source at most.
