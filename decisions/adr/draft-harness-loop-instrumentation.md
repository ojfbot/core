# ADR-XXXX: Loop harnesses ride the OPAV spine; automation is gated on triggers, invocation is not
slug: harness-loop-instrumentation
serial: draft
rev:
Date: 2026-07-29
Status: Proposed
domain: observation
type: architecture
OKR:
Commands affected: /grill-with-docs, /handoff, /plan-feature, /roadmap, /merge-quiz, /blind-sweep
Repos affected: core
gate:
baseline:
traces:
  supersedes:
  amends:
  relates-to: [skill-action-instrumentation, control-gated-slices, lint-shadow-to-gate, two-track-skill-telemetry]
  parent:
  part-of-series:

---

## Context

Two research documents (a swipe-file conversion of Thariq Shihipar's "finding your unknowns"
material, plus a literature-grounding pass) proposed eight instrumented loop harnesses, H1–H8,
to replace eight one-shot prompts with sampled, scored, logged loops. Both assumed the fleet
lacked harness infrastructure and proposed a new `harness:` YAML contract plus a per-repo
`.ojf/loop-log.jsonl` carrying a `human_delta` field.

Both assumptions were wrong, and measuring first is what showed it.

**The infrastructure already exists, three times over.** `decisions/loops/loops.md` is a linted
registry whose fields (`trigger`/`verifier`/`stop_rule`/`evidence_ref`) already express the
proposed contract. `reconcile-skill-acted.mjs` already implements the disposition model
(`acted` / `engaged_no_act` / `capture_miss` / `pending` / `ignored` / `skill-authoring`), a
two-source contract, a rebuildable projector view, and shadow-first discipline — and
`engaged_no_act` *is* `human_delta`, built and running. `expected-artifact.ts` already maps
skills to the artifact that proves action. A second ledger would have half-populated both.

**What is missing is not harnesses. It is a non-zero act rate on the harness already running.**
Over the 30 days to 2026-07-29 the recorder scored 442 suggestions: 385 `ignored`, 47
`engaged_no_act`, 5 `skill-authoring`, 2 `capture_miss`, 2 `pending`, **1 `acted`**.

Two causes were separated by measurement rather than assumed:

1. **A real defect.** `EXPECTED_ARTIFACT['grill-with-docs']` demanded a `CONTEXT.md` write while
   `grill-with-docs/SKILL.md` forbade exactly that ("Do NOT silently edit the file"), and in
   sibling repos `domain-knowledge/CONTEXT.md` is a *symlink into core* — a fleet-shared artifact
   no single session should write. The skill wrote nothing to disk at all, so `acted` was
   structurally unreachable: a hand-applied diff scored `capture_miss`, everything else scored
   `engaged_no_act`. The skill had 0 invocations against 46 suggestions, all terminating
   `ignored`. Rebuilding the projector after the fix reclassified a **false `capture_miss`** —
   the failure metric had been reporting work-done-but-hidden where none occurred.

2. **Not a plumbing gap.** The hypothesis that the emit instruction was missing is false:
   `suggest-skill.sh:228` injects the full `skill-acted-emit.mjs` command, with the live
   `suggestion_id`, into every suggestion. The agent is told, every time, and does not comply.
   The remaining gap is agent compliance, not wiring — the same finding as adr:follow-skill-suggestions.

That second point decides what may be *automated*. A harness whose trigger is "a card enters a
domain" or "the spec phase opens" is a prompt someone has to remember to type, and there are 30
days of evidence that this does not happen — the swipe file's own thesis, that unknowns grow
faster than attention, applies recursively to the harnesses themselves. It does not decide what
may be *built*: see the Decision.

## Decision

Loop-harness records become new event families on the existing OPAV spine — never a parallel
`.ojf/loop-log.jsonl` — and **only harnesses whose trigger is a hook or a merge gate are
automated**, while the capabilities themselves ship as skills the operator can invoke.
H6 (`deviation-log`, Stop hook) and H8 Stage A (`merge-quiz`, PreToolUse observer) ship as
harnesses; H5 and the useful parts of P03/P05/P07 fold into skills that already run.

**Automation and invocation are separate questions, and conflating them cost real capability.**
The first cut of this decision deferred H1 and H8's quiz entirely, reasoning that their triggers
depend on the operator remembering. That reasoning holds against wiring them as *unattended*
harnesses; it does not hold against building them as **skills the operator invokes deliberately**.
The 1-in-442 figure measures suggestions being *ignored* — it says nothing about a skill someone
types on purpose, and H8 Stage A measures whether a gate would fire while no gate exists to fire.
So `/merge-quiz` and `/blind-sweep` ship as user-scope skills: advisory, never blocking, sharing
the harnesses' ledgers. H2 and H4 remain unbuilt.

## Consequences

### Gains

- One ledger, one disposition model, one set of anti-Goodhart guardrails. Harness output joins
  the same provenance chain as vault material and stays queryable together.
- `/grill-with-docs` becomes measurable for the first time: the open-unknowns ledger it now
  writes after the confirmation gate is an artifact it is actually permitted to produce, so
  `acted` is reachable. The measurement fix and the feature are the same change.
- The deviation recurrence count generates the ADR backlog for free — a deviation in one repo is
  an edge case, the same one in three is a missing convention.
- The two *automated* harnesses depend on nothing being remembered. The two *skills* are
  deliberately invoked, which is a different and legitimate trigger — and unlike an unattended
  loop, an unused skill costs nothing but a catalog row.
- The comprehension heatmap (repo × domain, EWMA) turns "am I actually learning this domain or
  just accumulating repos" from a feeling into a falling number with a name on it.

### Costs

- `merge-quiz` adds a synchronous `PreToolUse(Bash)` hook to every session. Mitigated by a bash
  prefilter that rejects non-merge commands in ~4ms without spawning node; the `.mjs` must never
  be installed directly as the hook entry.
- Deviation capture depends on agent compliance with a CLAUDE.md instruction — the same
  compliance channel that is currently failing elsewhere. The independent detector bounds the
  damage (it parses the file rather than trusting a count) but cannot manufacture a self-report
  that never happened. Expect `implementation-notes.md` to be absent at first; that is the
  measurement, not a bug.
- H2 (taste ledger) and H4 (`reference:` lineage edge) are not built. H3's VOI filter ships as
  a question gate inside `/grill-with-docs` rather than as a standalone harness, so the
  `actually_changed_plan` calibration record it would have produced does not yet accumulate —
  that remains the highest-value unbuilt piece.
- `/merge-quiz` and `/blind-sweep` add two catalog rows to a suggester already emitting 385
  ignored suggestions per 30 days. Their triggers are deliberately narrow (near-exact phrases)
  so they are invocable without widening that channel.

### Neutral

- `validate` and `plan-feature` carry `EXPECTED_ARTIFACT` entries with the same reachability
  smell as the one fixed here. They are annotated as surfaced ambiguities rather than guessed at,
  per that file's own rule, because resolving them changes what those skills *are*.
- RAGAS retrieval scoring and the relay-boundary restatement harness stay unbuilt. The relay-boundary harness is the most
  original idea in either report and deserves its own experiment with its own eval.

## Standing invariants

Three rules here are load-bearing and must survive later "optimisation":

1. **Deviations-per-session is a discovery rate, never a defect rate.** Never target it downward,
   never rank repos by fewest, never put it where low looks good. The cheapest way to minimise it
   is to stop logging, which destroys the signal while improving the metric.
2. **H8's quiz must be generated by a session that did not write the code**, from the diff and
   the spec, as a subagent with no Write/Edit tools. An implementer quizzing itself tests what it
   is most confident about — self-preference bias converting a comprehension gate into a rubber
   stamp.
3. **`/merge-quiz`'s bank must never be generated in the authoring context**, and the skill
   never merges — it reports a verdict and the human acts.
4. **H8 Stage A can end in retirement.** If no merge would have been gated across ~20
   observations, H8 is retired rather than promoted. A harness with near-zero human_delta is
   theatre with a log file, and retiring it is the loop working.

## Alternatives considered

| Alternative | Why rejected |
|-------------|--------------|
| Build all eight as unattended harnesses in the reports' order (H6→H8→H2→H5→H4→H3→H1) | Five of the eight trigger on a remembered prompt. As *unattended* loops they would add registry entries, not loops. Shipping the same capability as explicitly-invoked skills is a different question and is what H1/H8's quiz now do. |
| Ship H8 Stage A with no quiz to promote to | Rejected on the second pass. Observing whether a gate *would* fire, while no gate and no quiz exist, measures a hypothetical. `/merge-quiz` makes Stage A's counterfactual real without violating shadow-first, because the skill is advisory rather than an automated control. |
| Build `.ojf/loop-log.jsonl` per repo with OTel GenAI naming as specified | Creates a second spine beside a mature one that already carries the disposition model, the two-source contract and the projector. Better per-repo locality does not pay for two half-populated ledgers. |
| Fix the act edge first and defer every harness | The 1/442 rate is partly agent compliance, which no single slice closes. Hook-triggered harnesses route around compliance entirely, so they are the fix rather than a competitor to it. |
| Add `sample:`/`harnesses:` fields to the loops and northstar schemas | Unnecessary: every harness shipped is k=1 or bank-then-sample, and `trigger: hook` is already valid. The `harness-routine` trigger value named in `rm:rm-l2-ojfbot#S29`'s deliverable prose was never implemented in `loops-lint.mjs` — authoring against it would have ERRORed. |
| Add an `l2-harness-conformance` fleet property | `ns:l2-ojfbot#P2` already covers "daily work traces to a measurable property" at 30%. A second property would double-count before any data exists. |
| Describe H1/Step 4.5 as unknown-unknown detection | LLMs are documented to surface known unknowns well and confabulate genuine unknown-unknowns (QuestBench 2503.22674, CLAMBER 2405.12063, 2606.08571). It is framed as a checklist of domain-standard considerations that may have been skipped. |

## Provenance

| Field | Value |
| --- | --- |
| Zero-point | 442 suggestions / 30d → 1 `acted`, 385 `ignored`, 47 `engaged_no_act`, 2 `capture_miss` (`reconcile-skill-acted.mjs --window=2592000000`, 2026-07-29). `/grill-with-docs`: 0 invocations, 46 suggestions, all `ignored`. |
| Implementation start | 2026-07-29 |
| Implementation end | _pending_ |
