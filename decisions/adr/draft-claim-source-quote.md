# ADR: Model-written claims name the source, quote it and say where; unquoted claims are hypotheses
slug: claim-source-quote
serial: draft
rev:
Date: 2026-11-24
Status: Proposed
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
sentence came from the source and which came from the synthesis. A read-only sweep of the
active fleet repos on 2026-11-23 found the same gap wherever a model writes prose from sources.
Provenance is kept per document at best, not per claim, and unquoted claims are not marked.
The sweep is recorded as a discovery on
[#687](https://github.com/ojfbot/core/issues/687#issuecomment-7104407941) and the proposal is
[#725](https://github.com/ojfbot/core/issues/725).

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
  instruction is "Preemptively answering questions where the information is available from the
  project context. If a reviewer asks "is this live?" and it is, say so clearly in the article."
  ([`src/council.ts:214`](https://github.com/ojfbot/daily-logger/blob/56a13eb0c1ceeb6c60f2219e9b426f355785be80/src/council.ts#L214)).
  The only project context it receives is `ctx.projectVision ? ctx.projectVision.slice(0, 1000) : ''`
  ([`src/council.ts:270`](https://github.com/ojfbot/daily-logger/blob/56a13eb0c1ceeb6c60f2219e9b426f355785be80/src/council.ts#L270)).
  It cannot see the day's commits or PRs, so an answer to "is this live?" cannot come from them.
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
  Code checks the repo and the record token. Nothing checks the prose against the scan.
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
  what hooks are open, what was last decided" (`.claude/skills/bead/SKILL.md:28`). Orient does
  not check beads against git. `/resume` does.

**3. Trace triager (core).** The triager names its sampled items but does not quote them.

- Its report table is `| item (trace_id / bead / article) | failure observed | cluster | new-cluster? |`
  (`decisions/opav/triager-run-report-format.md:15`). The item is named. The failure is the
  model's description, with no quote and no line.
- Its taxonomy deltas must be "cited to ≥2 sampled items" (`scripts/trace-triager-brief.md:16`),
  which counts items but asks for no words from them.
- The loop is built but has no runs on main yet. Its state folder,
  `decisions/opav/triager-runs/`, does not exist, and the commit that added it says
  "plist unloaded" (c7b5688). So this gap is real but not yet producing records.

**4. Core research notes (`decisions/research/`).** The notes back ADRs and decision tickets,
but their tagging differs from note to note.

- The wayfinder research ticket type gives no format. It says only "findings filed to
  `decisions/research/`" (`.claude/skills/wayfinder/knowledge/ticket-types.md:3`).
- Three notes tag their claims, with three different vocabularies.
  - `sources-check-662.md:46-48` uses "source-stated", "close paraphrase" and "our interpretation",
    with timestamps and quotes.
  - `grader-trust-671.md:9-12` uses `[S]`, `[V]`, `[R]` and `[I]`, where `[I]` is "My inference.
    Treat it as a hypothesis."
  - `permission-patterns-665.md:8-9` uses `[S url]` and `[I]`.
- In #671 and #665 an `[S]` tag mostly carries a URL only. Of the lines with an `[S]` tag, 3 of 42
  in #671 and 26 of 83 in #665 contain a quotation mark (counted with `grep` on the files above).
  For example: "[S] https://hamel.dev/blog/posts/evals-faq/" (`grader-trust-671.md:93`). The source
  is named. The words and their place are not.
- The other 12 notes in the folder use none of these tags.

**5. Vault ingest and capture (`/vault`, selfco-ingest, selfco-box).** The model's own analysis
and a vendor's summary both end up next to source text, unmarked.

- The Notion Inbox path tells the model "fill the body out with your own analysis on top of the
  source text" (`.claude/skills/vault/consumer/SKILL.md:98`). Nothing marks which part is analysis.
- The Inbox row body then lands in `raw/`, the layer that `.claude/skills/vault/vault.md:248` calls
  "the source of record" and keeps append-only. So the model's analysis can enter the source
  layer, where it can never be corrected in place. [hypothesis: the selfco-box transport copies
  the row body as-is; its own comment says it lands rows "verbatim", but the full write path was
  not traced.]
- selfco-box's PLAUD ingest (`buildIngestText`) writes the vendor's AI summary, action items and
  topics under `## Summary`, `## Action items` and `## Topics`, followed by `## Transcript`, in one
  document. Nothing labels the summary as a model's output. The transcript lines do carry speaker
  and time offset, so the location half of the rule already exists there.

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
- In the cockpit, the catch-up text is shown in the console but is not what is written. The bead's
  Context comes from the model's `align` field (`briefing.ts:164`). The record is named through a
  `closes:` reference (`briefing.ts:167`), so the source is named but not quoted.
- Only #662's note has quotes and timestamps throughout. #665 and #671 tag claims, but most of
  their source-stated claims carry a URL alone. The three notes use three tag vocabularies.
- The trace triager has not run on main yet, so its gap produces no records today.
- The Inbox body that mixes analysis with source text lands in `raw/`, the immutable source layer,
  not just in a wiki page.

## Decision

**Every model-written claim about a source carries three things: the source, the exact words it
rests on, and where those words are. A claim without a quote is a hypothesis.** A hypothesis
cannot be the only support for a check, an ADR, a slice's entrance condition (a **Control gate**
criterion) or an action.

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

### Who writes the quote

Where the source text is in hand when the model writes, copy DailyLogger's design. The model
points at a source and a line range, and code cuts the quote. Where the source is not in hand
(a web page read earlier, audio), the model records the quote and location itself, and the record
says the quote was not re-checked by code. Whether code must re-check quotes is open for the
owner (question 3 below).

### Two states, not many

For this rule a claim is either **quoted** (all three fields present) or a **hypothesis** (any
field missing). Richer tag sets already in use stay, and map onto the two:

| Existing tag | Maps to |
| --- | --- |
| #662 "source-stated", "close paraphrase" with a quote | quoted |
| #662 "our interpretation", "not found" | hypothesis |
| #665 / #671 `[S]`, `[V]`, `[R]` with quote and location | quoted |
| #665 / #671 `[S]`, `[V]`, `[R]` with a URL only; `[I]` | hypothesis |
| `/resume` VERIFIED, GROUND-TRUTH | quoted, when the record holds the words |
| `/resume` UNVERIFIED, CONFLICT, GAP | hypothesis |

A vendor's AI summary (PLAUD's, for example) is model-written. Its claims are hypotheses until
they are tied to quoted transcript lines.

### Where it applies, in order

1. DailyLogger council and claim check.
2. Morning Cockpit Briefing beads.
3. Trace triager report.
4. Core research notes and the wayfinder research template.
5. Vault ingest and capture.
6. The lower-risk producers, by slice or by a recorded decision to accept the risk.

Each producer adopts the rule in its own slice. This ADR changes no producer.

### Open for the owner

These choices change how the rule lands. They are listed with options here. The PR that adds
this ADR gives a recommendation for each.

1. Does a missing quote block publication, or only label the claim a hypothesis?
2. Which producer is the first slice?
3. Must code re-check each quote against the source, or is a recorded quote enough?
4. How are hypotheses shown to readers?
5. Does the fleet adopt one shared set of words for the two states?

### Done when

- The research template and the article pipeline both enforce the rule, with a check that fails
  on an unquoted factual claim.
- Each other gap has a slice or a recorded decision to accept the risk.

## Consequences

### Gains

- A reader can tell, sentence by sentence, what came from a source and what the model added.
- A check, ADR, entrance condition or action can no longer rest on a claim nobody can trace.
- Code-cut quotes make one common failure impossible: a model quoting words the source never had.
- The fleet gets one test that works across producers ("is there a quote?"), instead of one per repo.

### Costs

- Producers need more context. The council has to be given the sources the drafter saw, which
  raises token use per article. [hypothesis: the size of that increase is not measured.]
- Some prose gets heavier. A claim carries a link and a quote, or is marked.
- Prose claim checking is harder than token checking. A check can confirm a quote exists in a
  source; it cannot confirm the quote supports the sentence. That still needs a reviewer.
- Sources that are not text in hand (audio, video, paywalled pages) cannot be re-checked by code.

### Neutral

- Existing notes and beads are not rewritten. The rule applies to new records. Old ones read as
  hypotheses where they lack quotes.
- Three proposed words would join `CONTEXT.md` if this is accepted: **Claim**, **Quote** (with
  its location) and **Hypothesis**. They are not added before acceptance.

## Alternatives considered

| Alternative | Why rejected |
|-------------|--------------|
| Keep provenance per document (a sources list at the end) | That is today's state. It is what the #662 review found unreadable: a reader cannot tell which sentence a source supports. |
| Let the model write quotes and trust them | Models misquote. DailyLogger already moved away from model-written quotes: "Never invent or paraphrase a quote" (`review-actions.ts:644`). |
| Ban model synthesis in sourced records | Loses the useful part. Analysis is allowed. It only has to be marked as a hypothesis. |
| A per-repo rule written into each skill | Gives the three-vocabulary drift already seen in `decisions/research/`. One fleet rule with a mapping is cheaper to check. |
| A confidence score per claim instead of a quote | A score is another model output with no source. A quote can be checked; a score cannot. |

## Provenance

| Field | Value |
| --- | --- |
| Zero-point | Outside review comment on #662 (via the #687 discovery comment, 2026-11-23) |
| Proposal | ojfbot/core#725 |
| Evidence read at | core f10c9cdd4903a269654b70845945e4d6e32de5f6; daily-logger 56a13eb0c1ceeb6c60f2219e9b426f355785be80; morning-cockpit deb780a5bf7d8f8386ef6c64dae9f95a45524bbe; selfco-box dc02fbf (private) |
| Design copied | daily-logger `src/review-actions.ts` + `src/action-evidence-view.ts` (line-range citations, code-cut quotes) |
| Implementation start | _pending_ |
| Implementation end | _pending_ |
