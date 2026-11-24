# ADR-0111: Model-written claims name the source, quote it and say where; unquoted claims are hypotheses
slug: claim-source-quote
serial: 0111
rev:
Date: 2026-11-24
Status: Accepted
Date accepted: 2026-11-24
domain: observation
type: policy
OKR: (none assigned)
Commands affected: /wayfinder (research tickets), /bead (briefs written from the cockpit), /vault and selfco-ingest, the trace triager brief; later /investigate, /teach, /summarize
Repos affected: core (decisions/research/, wayfinder research template, trace triager brief, vault skills), daily-logger (council, claim check), morning-cockpit (Briefing emit), selfco-box (ingest composition)
gate:
baseline:
traces:
  supersedes:
  amends:
  relates-to: [session-provenance-hardening, control-gated-slices, envisioned-capability-marker, selfco-vault-and-skill]
  parent:
  part-of-series:

---

<!--
This ADR follows its own rule. Every statement about current code below names the file,
gives a line and quotes the words it rests on. Code was read on these main-branch commits:
  core            f10c9cdd4903a269654b70845945e4d6e32de5f6
  daily-logger    56a13eb0c1ceeb6c60f2219e9b426f355785be80
  morning-cockpit deb780a5bf7d8f8386ef6c64dae9f95a45524bbe
  selfco-box      dc02fbf (private repo: named, not linked)
Statements marked [hypothesis] are this author's reading, with no quote behind them.
-->

## Context

An outside review comment on #662 pointed out that after re-reading, nobody can tell which
sentence came from the source and which came from the synthesis. That finding is recorded as a
discovery on [#687](https://github.com/ojfbot/core/issues/687#issuecomment-7104407941): "nobody
can tell which sentences came from the episode and which came from the synthesis."

A read-only sweep of the active fleet repos then found the same gap elsewhere. Its follow-up
comment on [#687](https://github.com/ojfbot/core/issues/687#issuecomment-7105524002) says "a
fleet sweep found the same gap in most synthesis steps. It is filed as #725". The proposal is
[#725](https://github.com/ojfbot/core/issues/725). It says provenance is kept per document at
best, not per claim, and that unquoted claims are not marked.

The fleet already treats some records as self-report. `CONTEXT.md:28` says a **Bead** is
"Self-report, not ground truth". `/resume` tags each claim and says of an unverified one
"do not upgrade it" (`.claude/skills/resume/SKILL.md:34`). What is missing is the same
discipline for prose a model writes from sources.

### The design to copy: DailyLogger action review

DailyLogger's action review keeps the model from writing quotes at all. The model points at
lines; code turns the lines into the quote; code checks the quote again before it is used.

- The model is told: "Select source evidence with the supplied short source IDs and inclusive
  startLine/endLine numbers. The application resolves those lines into exact quotes before
  independent verification. Never invent or paraphrase a quote."
  ([`src/review-actions.ts:644`](https://github.com/ojfbot/daily-logger/blob/56a13eb0c1ceeb6c60f2219e9b426f355785be80/src/review-actions.ts#L644))
- Each citation it returns has only `sourceId`, `startLine` and `endLine`
  ([`src/review-actions.ts:99`](https://github.com/ojfbot/daily-logger/blob/56a13eb0c1ceeb6c60f2219e9b426f355785be80/src/review-actions.ts#L99)).
- Code cuts the quote out of the collected source:
  `const quote = lines.slice(startLine - 1, endLine).join('\n')`
  ([`src/action-evidence-view.ts:193`](https://github.com/ojfbot/daily-logger/blob/56a13eb0c1ceeb6c60f2219e9b426f355785be80/src/action-evidence-view.ts#L193)).
- Before admission, `checkedCitations` re-checks it:
  `return source && source.content.includes(citation.quote)`
  ([`src/review-actions.ts:1126`](https://github.com/ojfbot/daily-logger/blob/56a13eb0c1ceeb6c60f2219e9b426f355785be80/src/review-actions.ts#L1126)).

So a quote here is never the model's memory of the source. It is the source.

### The gaps, riskiest first, checked against current code

**1. Daily article council (daily-logger).** The personas, the synthesis and the claim check
each have a gap.

- *Personas never see the sources.* The persona's whole user message is the draft:
  "Here is the draft article for ${draft.date}:\n\n---\n${draft.body}\n---\n\nWhat's your read?"
  ([`src/council.ts:118`](https://github.com/ojfbot/daily-logger/blob/56a13eb0c1ceeb6c60f2219e9b426f355785be80/src/council.ts#L118)).
- *The synthesis is asked to add claims, but it is not given the sources either.* Its
  instruction is "1. \*\*Preemptively answering questions\*\* where the information is available
  from the project context. If a reviewer asks "is this live?" and it is, say so clearly in the
  article." (the `**` marks are in the source)
  ([`src/council.ts:214`](https://github.com/ojfbot/daily-logger/blob/56a13eb0c1ceeb6c60f2219e9b426f355785be80/src/council.ts#L214)).
  The only project context it receives is `ctx.projectVision ? ctx.projectVision.slice(0, 1000) : ''`
  ([`src/council.ts:270`](https://github.com/ojfbot/daily-logger/blob/56a13eb0c1ceeb6c60f2219e9b426f355785be80/src/council.ts#L270)).
  The user prompt (lines 254-271) is built from the draft, the council feedback and that slice,
  under the headings `'## Original draft'`, `'## Council feedback'` and `'## Project context'`.
  So the synthesis cannot see the day's commits or PRs, and an answer to "is this live?" cannot
  come from them.
- *The claim check covers tokens, not prose, and never blocks.* It looks for file paths, commit
  SHAs and PR numbers. "A claim is verified when it appears as a literal substring of the context"
  ([`src/verify-claims.ts:59`](https://github.com/ojfbot/daily-logger/blob/56a13eb0c1ceeb6c60f2219e9b426f355785be80/src/verify-claims.ts#L59)).
  Anything it cannot find "is flagged, never blocked: this is a shadow-stage control"
  ([`src/verify-claims.ts:7`](https://github.com/ojfbot/daily-logger/blob/56a13eb0c1ceeb6c60f2219e9b426f355785be80/src/verify-claims.ts#L7)).
  It runs on the final article after the synthesis
  ([`src/index.ts:188`](https://github.com/ojfbot/daily-logger/blob/56a13eb0c1ceeb6c60f2219e9b426f355785be80/src/index.ts#L188):
  "Deterministic fact-check (TD-001, shadow-stage: record, never gate)").

**2. Morning Cockpit Briefing writes beads.** The Briefing's local model writes the text that
becomes a bead's Context, with the source record named but not quoted.

- The model is told "Use ONLY facts from the scan — do not invent records"
  ([`packages/server/src/briefing-generate.ts:46`](https://github.com/ojfbot/morning-cockpit/blob/deb780a5bf7d8f8386ef6c64dae9f95a45524bbe/packages/server/src/briefing-generate.ts#L46)).
  Code checks the record token and the repo: `if (!item || !repo || !repos.includes(repo)) return null;`
  ([`briefing-generate.ts:118`](https://github.com/ojfbot/morning-cockpit/blob/deb780a5bf7d8f8386ef6c64dae9f95a45524bbe/packages/server/src/briefing-generate.ts#L118)),
  then the brief's shape through the handoff gate: `if (!v.ok) return null;`
  ([`briefing-generate.ts:129`](https://github.com/ojfbot/morning-cockpit/blob/deb780a5bf7d8f8386ef6c64dae9f95a45524bbe/packages/server/src/briefing-generate.ts#L129)).
  No check in `toThread` (lines 109-145) compares the prose with the scan. [hypothesis: no
  check elsewhere does either; only this function was read.]
- The bead's Context is the model's `align` field: `context: artifact.align`
  ([`packages/shared/src/briefing.ts:164`](https://github.com/ojfbot/morning-cockpit/blob/deb780a5bf7d8f8386ef6c64dae9f95a45524bbe/packages/shared/src/briefing.ts#L164)),
  where `align` is "Shared intent — what operator + agent agree is true"
  ([`briefing.ts:41`](https://github.com/ojfbot/morning-cockpit/blob/deb780a5bf7d8f8386ef6c64dae9f95a45524bbe/packages/shared/src/briefing.ts#L41)).
  The only reference written is `closes:` plus the record id
  ([`briefing.ts:167`](https://github.com/ojfbot/morning-cockpit/blob/deb780a5bf7d8f8386ef6c64dae9f95a45524bbe/packages/shared/src/briefing.ts#L167)).
- The owner approves each write: "every emit is still human-approved"
  ([`briefing-generate.ts:23`](https://github.com/ojfbot/morning-cockpit/blob/deb780a5bf7d8f8386ef6c64dae9f95a45524bbe/packages/server/src/briefing-generate.ts#L23)).
  Approval helps, but it adds no source.
- `/bead orient` then reads the result: "Read the most recent beads in `.handoff/`. Understand:
  what hooks are open, what was last decided" (`.claude/skills/bead/SKILL.md:28`). Its script,
  `.claude/skills/bead/scripts/orient.py`, contains no `git` or `subprocess` call (a `grep` for
  either finds none), so orient does not check beads against git. `/resume` is the one that does:
  "Only claims corroborated by ground truth ([git]/[PR]) may be stated as done"
  (`.claude/skills/resume/SKILL.md:14`).

**3. Trace triager (core).** The triager names its sampled items but does not quote them.

- Its report table is `| item (trace_id / bead / article) | failure observed | cluster | new-cluster? |`
  (`decisions/opav/triager-run-report-format.md:15`). The item is named. The failure is the
  model's description, with no quote and no line.
- Its taxonomy deltas must be "each cited to ≥2 sampled items" (`scripts/trace-triager-brief.md:16-17`),
  which counts items but asks for no words from them.
- No committed run reports were found on main: the report folder `decisions/opav/triager-runs/`
  does not exist, and the commit that added the loop says "plist unloaded" (c7b5688). Run history
  is unverified. An empty run is allowed to leave nothing in git: "do NOT open a PR (an empty
  run is a success state" and "Print the run report to stdout" (`scripts/trace-triager-brief.md:32-33`).
  [hypothesis: the loop may have run without leaving a committed report; its local run log was
  not read.]

**4. Core research notes (`decisions/research/`).** The notes back ADRs and decision tickets,
but their tagging differs from note to note.

- The wayfinder research ticket type gives no format. It says only "findings filed to
  `decisions/research/`" (`.claude/skills/wayfinder/knowledge/ticket-types.md:3`).
- Three notes tag their claims, with three different vocabularies.
  - `sources-check-662.md:46-48` uses "source-stated", "close paraphrase" and "our interpretation",
    and pairs them with timestamps and quotes, for example `Episode 14:49, Satya on the term: "still kind of coming to grips with it."`
    (`sources-check-662.md:55`).
  - `grader-trust-671.md:9-12` uses `[S]`, `[V]`, `[R]` and `[I]`, where `[I]` is "My inference.
    Treat it as a hypothesis."
  - `permission-patterns-665.md:8-9` uses `[S url]` and `[I]`.
- In #671 and #665 an `[S]` tag mostly carries a URL only. Of the lines with an `[S]` tag, 3 of 42
  in #671 and 26 of 83 in #665 contain a quotation mark (counted with `grep` on the files above).
  For example: "[S] https://hamel.dev/blog/posts/evals-faq/" (`grader-trust-671.md:93`). The source
  is named. The words and their place are not.
- The other 12 notes in the folder use none of these tags.

**5. Vault ingest and capture (`/vault`, selfco-ingest, selfco-box).** The model's own analysis
and a vendor's summary both sit next to source text, unmarked. The chat intake path is on hold
today; the risk is in how it worked and in the instructions that remain.

- *The chat intake path is on hold.* The consumer skill says: "The defective historical transport
  stays off and the replacement is not deployed. Until review, web/mobile agents are read-only.
  Do not create Notion rows, GitHub commits or promoter jobs from this skill yet."
  (`.claude/skills/vault/consumer/SKILL.md:21`). This ADR keeps that hold.
- *The instruction to mix analysis into the body is still in the skill.* Its Notion Inbox steps
  tell the model to "fill the body out with your own analysis on top of the source text"
  (`.claude/skills/vault/consumer/SKILL.md:98`). Nothing marks which part is analysis. If the hold
  is lifted with this text unchanged, the gap comes back.
- *How the historical path handled it.* The selfco-box transport (private repo, commit dc02fbf)
  describes itself as able to "land non-terminal Inbox rows verbatim in raw/inbox/"
  (`scripts/launchd-transport-poll.sh:5`). `raw/` is the layer that `.claude/skills/vault/vault.md:248`
  calls "the source of record" and keeps append-only. So on that path the model's analysis could
  enter the source layer, where it can never be corrected in place. [hypothesis: whether that
  transport is the "defective historical transport" the skill names, and whether such rows exist
  in `raw/` today, were not checked.]
- *A vendor's summary sits with the raw transcript.* selfco-box's PLAUD ingest,
  `buildIngestText` in `src/sources/plaud.ts:50-87` at commit dc02fbf (private repo), writes the
  vendor's summary first and the transcript after it, in one document: `` `## Summary`, ``
  then `note.summary.trim(),` (lines 63-64), later `` lines.push(`## Transcript`); `` (line 80).
  Action items and topics from the vendor note go between them (lines 68-78). Nothing labels the
  summary as a model's output. Each transcript line is written as
  `` **${seg.speaker}** (${fmtOffset(seg.startSec)}): ${seg.text} `` (line 82), so the location
  half of the rule already exists there. [hypothesis: whether the PLAUD source is running today
  was not checked.]

**6. Lower risk.** The daily cleaner's "it's stale" rationale, `/bead` reports, `/investigate`,
`/summarize`, `/teach`, paper explainers and lane digests. Not read for this ADR.

### What the issue got wrong or left out

Checked against the commits above:

- The quote derivation is in `src/action-evidence-view.ts:193`, not `review-actions.ts`.
  `review-actions.ts` holds the prompt (line 644) and the re-check (line 1126).
- The council gap is wider than the personas. The synthesis is asked to answer reviewers'
  questions, but it is given only the first 1,000 characters of the project vision, not the
  day's sources (`council.ts:270`).
- The claim check is shadow-only. It tags an article `verification-flagged` and never blocks
  (`verify-claims.ts:7`, `index.ts:188`).
- In the cockpit, the catch-up text is shown in the console (`<p>{active.catchUp}</p>`,
  `packages/renderer/src/components/briefing/Briefing.tsx:189`) but is not what is written. The bead's
  Context comes from the model's `align` field (`briefing.ts:164`). The record is named through a
  `closes:` reference (`briefing.ts:167`), so the source is named but not quoted.
- Of the three tagged notes, #662's is the one that pairs its tags with timestamps and quotes
  (`sources-check-662.md:55`). #665 and #671 tag claims, but most of their source-stated claims
  carry a URL alone (counts above). The three notes use three tag vocabularies.
- No committed trace triager reports were found on main. Its run history is unverified, since an
  empty run leaves nothing in git (`trace-triager-brief.md:32-33`).
- The vault gap is mostly historical. The chat intake path is on hold (`consumer/SKILL.md:21`),
  but the instruction to mix analysis into the body is still in the skill (line 98). On the
  historical path, the box describes itself as landing Inbox rows "verbatim" in `raw/`, the
  immutable source layer, not just in a wiki page (`launchd-transport-poll.sh:5`, selfco-box).

## Decision

**Every model-written claim about a source carries three things: the source, the exact words it
rests on, and where those words are. A claim without a quote is a hypothesis.** A hypothesis
cannot be the only support for a check, an ADR, a slice's entrance condition (a **Control gate**
criterion) or an action.

The owner answered the five open questions on 2026-11-24, choosing the recommended option each
time. The answers are recorded under "Owner decisions" below, and the rest of this section is
written to match them.

### The claim record

| Field | What it holds | Examples |
| --- | --- | --- |
| Source | something a reader can open | a URL, an issue or PR, a commit, a file at a commit, a vault page title, a bead id |
| Quote | the exact words, copied, never paraphrased | one line to a short passage |
| Location | where the quote sits in the source | a line range, page, timestamp, or row |

A claim is a sentence that says what a source says or what is true in the world: "X shipped",
"Y is blocked", "the paper reports Z". Opinions, recommendations and questions are not claims
under this rule, but a recommendation that rests on a claim inherits that claim's status.
[hypothesis: drawing this line in practice will need examples per producer.]

### Missing quotes are labelled; blocking happens only where a claim is relied on (question 1, B)

An unquoted claim does not stop a record being published. It is labelled a hypothesis. A block
applies only at the points where something acts on the claim: a check, an ADR, a slice's
entrance condition or an action that would rest on it alone.

### Who writes the quote (question 3, A)

Where the source text is in hand when the model writes, copy DailyLogger's design. The model
points at a source and a line range, code cuts the quote, and code re-checks it against the
source before the claim is used. Where the source is not in hand (a web page read earlier,
audio), the model records the quote and location itself, and the record marks the quote
"not re-checked".

### Two states: quoted and hypothesis (question 5, A)

A claim is either **quoted** (all three fields present) or a **hypothesis** (any field missing).
Richer tag sets already in use stay, and map onto the two:

| Existing tag | Maps to |
| --- | --- |
| #662 "source-stated", "close paraphrase" with a quote | quoted |
| #662 "our interpretation", "not found" | hypothesis |
| #671 `[S]`, `[V]`, `[R]`, or #665 `[S url]`, with quote and location | quoted |
| #671 `[S]`, `[V]`, `[R]`, or #665 `[S url]`, with a URL only; `[I]` in either | hypothesis |
| `/resume` VERIFIED, GROUND-TRUTH | quoted, when the record holds the words |
| `/resume` UNVERIFIED, CONFLICT, GAP | hypothesis |

A vendor's AI summary (PLAUD's, for example) is model-written. Its claims are hypotheses until
they are tied to quoted transcript lines. The words **Claim**, **Quote** and **Hypothesis** are
added to `CONTEXT.md`.

### How hypotheses are shown (question 4, C)

- In internal records (research notes, beads, triager reports, vault pages), a plain
  `hypothesis` tag sits on the claim itself.
- In the public daily article, the prose stays clean and the unquoted claims are listed in one
  short closing block.

### Producers covered, and the order of slices (question 2, A)

The rule covers every producer in the Context section. Slices go in this order:

1. DailyLogger council: give the personas and the synthesis the context the drafter saw, and
   have the shadow check list unquoted "shipped" and "blocked" claims.
2. The wayfinder research template, with a check over `decisions/research/`.
3. The remaining producers, each by a slice or by a recorded decision to accept the risk:
   - Morning Cockpit Briefing beads;
   - trace triager reports;
   - vault ingest and capture (the current hold on chat intake stays);
   - the lower-risk producers.

Each producer adopts the rule in its own slice. This ADR changes no producer.

### Existing records

Existing notes and beads are not rewritten in bulk. A record is labelled under this rule when
it is next touched. Until then, a claim in it without a quote reads as a hypothesis.

### Owner decisions (2026-11-24)

The owner chose the recommended option on all five questions. The chosen option is marked
**(chosen)** in each table.

**1. Does a missing quote block publication, or only label the claim a hypothesis?** Chosen: B.

| Option | Gains | Costs |
| --- | --- | --- |
| A. Label only, everywhere | Nothing stops. Matches the article check's shadow mode ("flagged, never blocked", `verify-claims.ts:7`). | An unquoted claim can still back an action unless something else stops it. |
| **B. Label, and block only where something acts on the claim (a check, an ADR, an entrance condition, an action) (chosen)** | Publishing still flows. The rule's second sentence gets enforced where it matters. DailyLogger's action review already refuses such dispositions: a disposition "needs exact quotes from authoritative sources" (`review-actions.ts:1344`). | A check has to know when a record is being used as support. |
| C. Block publication of any record with an unquoted claim | Strongest. | Daily article and research notes stall on every unquoted sentence. Encourages padding with weak quotes. |

**2. Which producer is the first slice?** Chosen: A, then B.

| Option | Gains | Costs |
| --- | --- | --- |
| **A. DailyLogger council: give the personas and the synthesis the context the drafter saw; have the shadow check list unquoted "shipped" and "blocked" claims (chosen, first)** | Riskiest gap. It publishes daily: daily-logger main has a `blog: <date>` commit for each day from 2026-11-17 to 2026-11-24 (`git log --grep '^blog: '` at 56a13eb). The quote code to copy is in the same repo. | Larger slice; more tokens per article. |
| **B. Wayfinder research template, with a check over `decisions/research/` (chosen, second)** | Smallest; core only; uses the shared words from question 5; three notes already come close, so the check can be tested on real files. | Lower risk than the article, so less damage prevented first. |
| C. Morning Cockpit Briefing beads | Stops unquoted text entering beads that `/bead orient` reads. | The Briefing runs a local model: "To keep a 7B model reliable" (`briefing-generate.ts:25`); quoting may cost reliability. Owner approval already sits in front of each write. |

**3. Must code re-check each quote against the source?** Chosen: A.

| Option | Gains | Costs |
| --- | --- | --- |
| **A. Yes where the source text is in hand; elsewhere record the quote and mark it "not re-checked" (chosen)** | Rules out invented quotes wherever it can. Copies proven code. | Each producer must keep its sources at write time. |
| B. No; a recorded quote and location is enough, spot-checked by a reviewer | Cheapest. | A wrong quote looks exactly like a right one. DailyLogger's design forbids model-written quotes ("Never invent or paraphrase a quote", `review-actions.ts:644`). [hypothesis: how often models misquote here is not measured.] |

**4. How are hypotheses shown to readers?** Chosen: C.

| Option | Gains | Costs |
| --- | --- | --- |
| A. A plain `hypothesis` tag on the claim itself | Exact; easy to check by text search. | Heavy in reader-facing prose. |
| B. One closing block listing unquoted claims | Keeps prose readable. | The reader must match the list back to sentences. |
| **C. A and B by audience: tags in internal records (research notes, beads, triager reports, vault pages), a closing block in the public daily article (chosen)** | Each audience gets the form it reads best. | Two forms to maintain. |

**5. Does the fleet adopt one shared set of words for the two states?** Chosen: A.

| Option | Gains | Costs |
| --- | --- | --- |
| **A. Yes: "quoted" and "hypothesis", with existing tags mapped onto them (chosen)** | One check works across producers; existing notes and `/resume` keep their tags. | A mapping table to maintain. |
| B. No; each producer keeps its own tags | No change for anyone. | The three-vocabulary drift in `decisions/research/` continues; a fleet check needs one rule per vocabulary. |

### Done when

- The DailyLogger article pipeline, then the wayfinder research template, each have a check that
  labels every unquoted factual claim a hypothesis and reports the count.
- In each, the check fails where an unquoted claim is relied on: when it would be the only
  support for a check, an ADR, a slice's entrance condition or an action.
- Each other gap has a slice or a recorded decision to accept the risk.

#725's own "Done when" asks for "a check that fails on an unquoted factual claim" in the research
template and the article pipeline. Under the owner's answer to question 1 (B), that block applies
only where a claim is relied on, not to publication.

## Consequences

### Gains

- A reader can tell, sentence by sentence, what came from a source and what the model added.
- A check, ADR, entrance condition or action that would rest on an unquoted claim alone is
  stopped at that point. A published record can still carry hypotheses, labelled as such.
- Where code cuts the quotes, one failure becomes impossible: a model quoting words the source
  never had.
- One test works across producers ("is there a quote?"), instead of one per repo.

### Costs

- Producers need more context. For the council to quote, it has to be given the sources the
  drafter saw, which raises token use per article. [hypothesis: the size of that increase is not
  measured.]
- Some prose gets heavier. A claim carries a link and a quote, or is marked.
- Prose claim checking is harder than token checking. A check can confirm a quote exists in a
  source; it cannot confirm the quote supports the sentence. That still needs a reviewer.
- Sources that are not text in hand (audio, video, paywalled pages) cannot be re-checked by code.
  Their quotes stay marked "not re-checked".
- A mapping table from the older tag sets has to be kept up to date.

### Neutral

- Existing records are labelled as they are touched, not rewritten in bulk.
- `CONTEXT.md` gains **Claim**, **Quote** and **Hypothesis**.

## Alternatives considered

| Alternative | Why rejected |
|-------------|--------------|
| Keep provenance per document (a sources list at the end) | That is today's state. It is what the #662 review found unreadable: a reader cannot tell which sentence a source supports. |
| Ban model synthesis in sourced records | Loses the useful part. Analysis is allowed. It only has to be marked as a hypothesis. |
| A confidence score per claim instead of a quote | A score is another model output with no source. A quote can be checked; a score cannot. |

The options the owner did not choose are recorded with their trade-offs under "Owner decisions".

## Provenance

| Field | Value |
| --- | --- |
| Zero-point | Outside review comment on #662 (via the #687 discovery comment, 2026-11-23) |
| Proposal | ojfbot/core#725 |
| Owner decisions | 2026-11-24, all five questions, recommended option chosen each time (relayed by the conductor) |
| Accepted | 2026-11-24, serial 0111 |
| Evidence read at | core f10c9cdd4903a269654b70845945e4d6e32de5f6; daily-logger 56a13eb0c1ceeb6c60f2219e9b426f355785be80; morning-cockpit deb780a5bf7d8f8386ef6c64dae9f95a45524bbe; selfco-box dc02fbf (private) |
| Design copied | daily-logger `src/review-actions.ts` + `src/action-evidence-view.ts` (line-range citations, code-cut quotes) |
| Implementation start | _pending_ |
| Implementation end | _pending_ |
