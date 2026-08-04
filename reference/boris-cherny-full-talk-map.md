# Reference — Boris Cherny, *Building Claude Code* (YC Startup School 2026)

Map of the **whole talk**, read from primary source 2026-08-04:
[ycrootaccess.com/p/boris-cherny-building-claude-code](https://www.ycrootaccess.com/p/boris-cherny-building-claude-code).
Not paywalled; full transcript present.

Thirteen topics. Deep dives live elsewhere in the corpus — this is the map that says what's in the
talk and which parts are worth your time.

> **Provenance note.** An earlier corpus entry
> ([[teach/agent-algebra-dynamic-workflows/|agent-algebra-dynamic-workflows]]) was built from one
> operator-supplied excerpt and recorded "the full talk was not obtained." That is now superseded:
> the page is reachable and everything below is primary. Recording the correction rather than
> quietly overwriting it.

---

## 1 · Opus 5 capabilities
Runs continuously for "days, weeks, months" without scaffolding tools; with Auto Mode, without user
intervention. Claims a new frontier in prompt-injection resistance.

## 2 · Prompt-injection defense
Three layers: alignment research producing a well-aligned model; a classifier reading neuron
activation patterns from mechanistic-interpretability work; and an Auto Mode classifier. He says they
can no longer demonstrate prompt injection with all three in place — **explicitly not a claim of
invulnerability**, only that demonstrations now fail.

## 3 · The 80% cut ★
80% of Claude Code's system prompt deleted for Opus 5, and the model tests "a little bit more
intelligent" without it. **The qualifier every summary drops:** some prompts are kept anyway, because
they help product usability and the behavior you want when people use it. That clause is the whole
difference between a sorting rule and a license to delete.
→ taught in [[teach/prompt-ablation/|prompt-ablation]]

## 4 · Ablation methodology ★
Delete the entire prompt → restore line by line to find each line's impact → evals assess each piece
→ restore only what the model **repeatedly stumbles** on. Every model release, across prompts, tools,
and harness code. Knobs: `--system-prompt` override, and `CLAUDE_CODE_SIMPLE=1` (strips all system
prompts, including those inside tools).
→ taught in [[teach/prompt-ablation/|prompt-ablation]]

## 5 · Product overhang
The gap between what a model can do and what products let it do — products "get in the way." Original
Claude Code as the example: coding tools offered autocomplete while models could already write whole
files. **The most portable idea in the talk** and the least discussed.

## 6 · Give the model harder tasks
Describe the task, the guardrails, and the exit criteria, then let it run — rather than prescribing
steps. He's explicit that this "wouldn't have worked six months ago."

## 7 · Bun: Zig → Rust in 11 days
100,000+ line runtime rewritten via dynamic workflows, one prompt with steering, validated against
existing Node and Bun test suites. Estimates over a year conventionally; now the production runtime.
**Does not claim** error-free or zero human review.

## 8 · Prompt engineering → capability elicitation
The "prompt engineer" role gives way to eliciting capability: hand over tasks that look too hard,
then supply verification. **Does not claim** prompt engineering is obsolete or that every task wants
less specification.

## 9 · The two-week Swift rewrite
A Claude Tag session rewriting the Electron desktop app in Swift, with pixel-by-pixel comparison and
instructions not to stop. Running 14–15 days, thousands of agents spawned, and it decided on its own
to live-blog progress to an internal Slack channel. **Does not claim** it finished or that output is
production-ready — worth holding, since this is the talk's most-quoted anecdote.

## 10 · Dynamic workflows ★
Bun sandbox + VM; agents composed in sequence and parallel — "an algebra for agents," from a
functional-programming background. Staged fan-out → verify → fan-out. Framed as a new way to
orchestrate test-time compute.
→ taught in [[teach/agent-algebra-dynamic-workflows/|agent-algebra-dynamic-workflows]]

## 11 · Loops and routines ★
One repetitive task, no shared context, possibly shared memory. Loop = local; routine = cloud. ~20–30
daily across their codebases: dead-code removal, shipping fully-rolled-out experiments, writing
missing tests, deleting useless ones, and "abstraction police" unifying near-duplicate abstractions.
The dead-code routine is one sentence; the static-and-dynamic-analysis approach was not prompted.
→ taught in [[teach/agent-algebra-dynamic-workflows/|agent-algebra-dynamic-workflows]]

## 12 · "Coding is solved" — with the hedge attached
Hedged in the same breath: solved for the kind of coding *he* does, not for everyone. Still struggles
on deep systems code and distributed systems; fine-grained UI verification is imperfect; vision and
computer use improved but incomplete.

## 13 · Advice for CS students
Learn by building what you want, then what others want. Pair technical skill with business sense,
design sense, and talking to users. Not an argument against theory — an argument for applying it.

---

## Claims by confidence

| Claim | Standing |
|---|---|
| The 80% cut, the ablation loop, the two flag/env knobs | **Primary**, his own account |
| Dynamic workflows, loops/routines and their shapes | **Primary**, his own system |
| `parallel` barriers vs `pipeline`; purity enforced for resume | **Verifiable** — live tool contract, not from the talk |
| Bun rewrite: 11 days, 100k+ lines, in production | **Reported**, specific and checkable |
| Swift rewrite: 14–15 days, thousands of agents | **In progress** — outcome unknown by his own statement |
| "Work of dozens or hundreds of engineers"; agent counts | **Estimated** — he hedges these himself |
| "Coding is solved" | **Scoped by him** to his own work; do not quote unhedged |

## Branching suggestions — what to follow

1. **Sort before you cut.** Run the keep/cut sort over `core/CLAUDE.md` (~5,034 tok). Expect most of
   it to be house rules that survive; the finding is the *mixture*, not the size.
2. **Build the ruler first.** Ablation's step 3 is "use evals," and that is the step the fleet cannot
   perform — the comprehension heatmap has zero cells. This may be the real prerequisite sitting
   underneath skill hardening.
3. **Try `CLAUDE_CODE_SIMPLE=1` as a probe, not a policy.** One session, an unimportant task, and
   observe. Cheap, and it makes the abstract argument concrete.
4. **Run one dynamic workflow.** Wave 2 is already pipeline-shaped. See
   [[teach/agent-algebra-dynamic-workflows/|the algebra lesson]] for operator choice.
5. **Ask the product-overhang question (§5) about your own surfaces.** Where is Arcade, or the
   cockpit, hobbling something the model could already do? This is the idea most likely to transfer
   outside the harness, and the one nobody is discussing.
6. **Hold §12's hedge.** "Coding is solved" is the line that will get quoted at you. He scoped it to
   his own work in the same sentence, and your fleet has systems-shaped corners.

## Related

- [[teach/agent-algebra-dynamic-workflows/|agent-algebra-dynamic-workflows]] — §10–11 taught
- [[teach/prompt-ablation/|prompt-ablation]] — §3–4 taught
- `decisions/loops/loops.md` — the fleet's local-loop registry (`launchd`); no cloud-routine equivalent
