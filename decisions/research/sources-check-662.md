# What do the original sources actually say? (core#662)

Date checked: 2026-11-22. Research ticket. Nothing is decided here.

## Short answer

- The episode transcript was available. I read all of it. It is a machine transcript, so wording may contain small errors.
- Satya Nadella's own blog posts say more than the episode does on three of the claims: the insider framing, the private-eval swap test, and "sovereignty".
- Most of the notes' design detail is **our interpretation**. The notes say so themselves. This file marks exactly where.
- Two things the notes credit to Satya or Linear are not theirs:
  - "Intent-based access control" is a **sponsor ad** read by the host (WorkOS), not Nadella.
  - "Chapters" is the host's word in a **Linear sponsor ad**. Linear's own pages say "sections". "Perspectives" appears nowhere.

## The two notes

Both are Selfco captures of a ChatGPT discussion. Both say they are a synthesis, not a verified transcript.

- **Capture A**: factory, guided reviews, trust architecture.
- **Capture B**: agent insider risk, assurance, provenance.

## Sources read

Episode and show notes:
- Episode page, with the host's takeaways, timestamps and references: <https://newsletter.pragmaticengineer.com/p/software-engineering-after-code-becomes> (published 16 Nov 2026, 62 min).
- The episode transcript behind that page's "Transcript" button. It was readable with no sign-in. It is machine-made, with speaker labels and some mishearings. Timestamps below are from it. I did not listen to the audio.

First-party Nadella writing and talks:
- "Models as Insider Risks in the Super Intelligence Era", 10 Oct 2026: <https://snscratchpad.com/posts/models-as-insider-risks/>
- "The Reverse Information Paradox", 12 Jul 2026: <https://snscratchpad.com/posts/reverse-information-paradox/>
- "A frontier without an ecosystem is not stable", 14 Jun 2026: <https://snscratchpad.com/posts/frontier-ecosystem/>
- No Priors x Latent Space interview at Microsoft Build, 3 Jun 2026: <https://latent.space/p/satya-2026>

Linear's own pages:
- Reviews product page: <https://linear.app/reviews> (reached from linear.app/diffs).
- Docs, "Diffs": <https://linear.app/docs/diffs>
- Changelog, "Linear Diffs", 28 May 2026: <https://linear.app/changelog/2026-05-27-linear-diffs>
- Changelog index and "Mobile Diffs", 5 Nov 2026: <https://linear.app/changelog>, <https://linear.app/changelog/2026-11-04-mobile-diffs>

Not read, and why:
- Two Microsoft Command Line posts (Copilot Cowork write-up, Microsoft-Decision-1) refused my fetch (403). So I could not check them.
- The GitHub blog post on the Copilot runtime port was read. It does not use "software factory" or the other phrases.
- Audio or video of the episode was not played.
- The Linear blog posts were not re-read here. The #673 session read them.

Status words:
- **source-stated**: the source says it in nearly these words.
- **close paraphrase**: same idea, different words or narrower scope.
- **our interpretation**: we added it. No source says it.
- **not found**: I looked and could not find it.

## Claims attributed to Satya

| # | Claim as the notes state it | First-party support | Status |
|---|---|---|---|
| S1 | Satya's "software factory" is a loop: intent/spec → agent builds → independent verification → guided human review → merge → learning (Capture A) | Episode 14:49, Satya on the term: "still kind of coming to grips with it." He gives no definition. | **Our interpretation.** Capture A labels it so. Satya gave no loop. |
| S2 | Cheap code makes specification, validation and organisational memory more important (A) | Episode 11:50: "code generation has become cheap, what has become hard is verification". He also says spec and intent matter (16:06) and a documented codebase onboards people faster (16:31). | **Close paraphrase.** Verification and spec are stated. "Organisational memory" is only the onboarding remark. |
| S3 | Four maturity stages; scale only when verified throughput rises without more human supervision (A) | No source. | **Our interpretation.** |
| S4 | An AI-native organisation starts as one engineer plus a token quota, and adds people and budgets as needed (A) | Episode 37:01: "They start with a token budget and a human, right?" | **Close paraphrase.** He says "AI native company", "a human", "budget". He describes how such firms grow ("the constructionist way"). He does not prescribe it. He adds that each new human's "factory gets the budget". |
| S5 | The "acid test": replace any model and still hill-climb on your private eval (A) | Episode 49:58: "replace any model and still hill climb". Same test in the Build interview (3 Jun 2026) and in his 14 Jun blog, where he calls it the key test of control and sovereignty. | **Source-stated.** Three first-party sources. |
| S6 | Extra detail on the acid test: same tasks, rubric and scoring units across models; separate model-level from factory-level evals; calibrate the AI judge against humans; keep a frozen long-term set plus harder versions (A) | Nadella says only that a private eval should measure the outcome that matters to the firm (episode 46:58; 12 Jul blog). | **Our interpretation.** |
| S7 | Embeddings from different models can't be mixed; rebuild on migration; an adapter alone is not enough (A) | Episode 48:40 raises the worry: "how are you going to migrate your memory out" when it sits in a model's embeddings. | **Close paraphrase** of the worry. The technical rules are **our interpretation**. |
| S8 | "Intelligence sovereignty": own specs, context, memory, evals, learning history and orchestration policy; treat models as replaceable (A, B) | The phrase "intelligence sovereignty" is not in the transcript, the page, or the posts I read. Nearest: episode 50:07 "how are you a sovereign firm?"; and the 12 Jul blog, which says firms should control their own learning loop, owning memory, traces, evals and context. | Phrase: **not found**. Idea: **close paraphrase**. "Own the intelligence" is the host's takeaway heading, not Satya's quote. "Specifications" and "orchestration policies" are not on Satya's list: **our interpretation**. |
| S9 | Route work between local and cloud models by capability, latency, privacy and cost (A) | Episode 54:51: "have this router pick the models for the task". He speaks of local models and "unmetered intelligence". | **Close paraphrase.** The four named dimensions are **our interpretation**. |
| S10 | Deterministic decision engines may replace repeatedly generated reasoning (A, flagged there as a research branch) | Episode 10:18: "doesn't need to be generated again and again". But his "decision models" are intelligence embedded as a primitive ("stored procedure of the intelligence era"). Not rule engines. | **Close paraphrase** for "don't regenerate". **Our interpretation** for "deterministic" or "fixed rule engine". |
| S11 | An agent in the enterprise is like an authorised insider who can still do unexpected damage (B) | Episode 51:02: "treat these agents as insider risk". His 10 Oct blog says the same and adds that models are not necessarily malicious. | **Source-stated** for the analogy. |
| S12 | Three insider types — malicious, negligent, compromised — and NIST CSF, NIST AI RMF, CERT, PAM and similar as study lenses (B) | The blog names mistakes and compromise, and says not necessarily malicious. It names no standards. Capture B marks the standards "not yet validated". | **Our interpretation.** |
| S13 | Identity-based permissions are not enough. Judge each action by who, why, what, which resource, with deny-by-default and a gateway (A) | Nadella (episode 50:50): "separate out architecturally authority from intelligence." His 10 Oct blog says the same in other words. The words "intent-based access control" (40:04) are the **WorkOS sponsor ad**, read by the host. | Authority split: **source-stated**. The who/why/what envelope and gateway: **our interpretation**. The intent-based framing is **not Nadella's**. |
| S14 | No agent may verify its own work. Evidence must be tamper-evident and checkable without the agent's account (A, B) | His 10 Oct blog says no model should verify its own work, evidence should be tamper-proof and human readable, and outcomes should be reproducible without the model's own account. Episode 17:07 favours a separate model family for critique. | **Close paraphrase.** Supported in principle. "Opposite vendor, fresh context" is our design. |
| S15 | Two separate evaluations: task capability, and governance (scope, detection, containment, audit). High task success must not offset a critical violation (B) | Blog says to test "failures, attacks, edge cases", not just successful tasks. No two-score split. | **Our interpretation.** Partly supported in spirit. |
| S16 | Factory metrics: cost per accepted change, spec-to-merge time, supervision minutes, escaped defects, denials (A) | Satya speaks only of balancing human effort and "token budgets" in general terms (host takeaway 7; episode 37:01). | **Our interpretation.** |
| S17 | Epistemic statuses, ontology/epistemology/hermeneutics, claim-and-evidence graph, lineage (B) | None. Capture B calls these the user's hypotheses. | **Our interpretation** (and not attributed to Satya in the note). |

Two further points found while reading. The notes do not claim them, but later work might:

- The host's written takeaway says Satya gave "making tests pass by deleting failing tests" as an alignment example. I did not find that in the transcript. Treat it as the host's summary only: **not found** in Satya's words.
- The host's takeaway heading "Own the intelligence" is the host's wording, not Satya's.

## Claims attributed to Linear

| # | Claim as the notes state it | First-party support | Status |
|---|---|---|---|
| L1 | Linear Guided Reviews are organised in "chapters" (A) | Linear's pages say "sections": docs "structured sections". Chapters appears in the **episode's sponsor read** by the host (38:50), not in Linear's own docs. The ad also says a summary and diagram sit at the top, and calls it "work in progress" (38:38, Nov 2026 recording). | **Close paraphrase.** Term differs. Treat "chapters" as the host's word. |
| L2 | "Chapters and perspectives" (A, user's recollection of the ad) | I found no "perspective" on Linear's pages or in the episode ad. | **Not found.** |
| L3 | Walks through changes in a meaningful, implementation-first order (A) | Reviews page: "walk you through changes in semantic order". Docs: "surface the core parts of an implementation first". | **Source-stated.** |
| L4 | Explanations alongside the diffs (A) | Docs: each section "pairs a high-level explanation" with the relevant diffs, with links into the diff. | **Source-stated.** |
| L5 | Less noise from generated and glue files (A) | Reviews page: "separating out supporting changes and glue code". Docs group "lower-signal changes separately". Nothing says "generated". | Glue and supporting: **source-stated**. "Generated files": **not found**. |
| L6 | Tied to issue and project context (A) | Reviews page: "Each diff is tied directly to the issue it resolves." | **Source-stated.** |
| L7 | Agent feedback and stacked PRs (A) | Reviews page: you can change code from the diff with coding agents. Stacked PRs are listed. | **Source-stated.** |
| L8 | The six or eight fixed chapter names (intent, core, architecture, failure, evidence, supporting…) (A) | Linear publishes no list of section names. Capture A calls this "our adaptation". | **Our interpretation**, as the note already says. |
| L9 | Reported adoption figures (A, number not stated in the note) | No figure for Guided Reviews on any Linear page I read. The only number is "over 50,000 product teams" for Linear overall. No accuracy figure either. | **Not found.** |

Linear extras seen: Guided Reviews were beta and free on 28 May 2026. The changelog later says they are generally available, with larger-PR support, then extended to Basic plans. Linear's docs let a workspace turn them off.

## Rulings that lean on an interpretation or a not-found claim

Flagged only. Nothing is decided here. "Leans on" means the ruling or its inputs use the claim, not that the ruling is wrong.

| Ticket | Leans on | Status of that claim |
|---|---|---|
| #663 trust words | The insider categories (malicious, negligent, compromised) from the notes. The ticket already says "not adopted or rejected". Also the seven claim statuses, which come from Capture B. The ticket waits on this one for mapping to NIST and W3C PROV. | S12, S17: interpretation. The sources name no standard. |
| #664 challenger | The "implementing agent cannot certify its own safety" rule, and the insider framing. | Insider framing: S11 source-stated. Independence rule: S14 close paraphrase. The specific design (opposite vendor, canary, outside human review) is ours. |
| #666 session life | The session-trust discovery list and insider framing. No Satya claim is cited. | S12, S13 (envelope part): interpretation. |
| #669 model tests | The acid test. | S5 source-stated. "Same instrument", frozen plus numbered sets and judge calibration are S6: interpretation. |
| #670 three scores | Model gains vs orchestration gains; capability vs governance as two scores; "swap" being a fair test. | S6, S15: interpretation. |
| #672 factory measures | "Software factory" as a term; the metrics list; the growth idea and "scale only when throughput rises". | S1, S3, S16: interpretation. Satya gave no definition. |
| #673 guided review | "Chapters", "perspectives", adoption, and fixed chapter lists. | L1 close paraphrase; L2, L9 not found; L5 "generated" not found; L8 interpretation. #673 already says its list is ours. |

## Gaps

- No audio check. Quotes come from a machine transcript.
- Two Microsoft Command Line posts were blocked (403).
- No other Nadella interview was searched for "software factory" or "intelligence sovereignty" beyond the Build interview and his blog. Search results show more press coverage of the insider post, which I did not treat as first-party.
- I could not find where "perspectives" and the adoption figures came from.
- Linear's pages can change. Read on 2026-11-22.
