# Reference — dynamic workflows, loops, and routines

The compressed essence of the Boris Cherny transcript segment supplied 2026-08-04, plus what the
live `Workflow` tool contract adds. **Scope honesty:** this covers the *supplied excerpt* of a
~36-minute talk, not the whole talk. Source:
[ycrootaccess.com/p/boris-cherny-building-claude-code](https://www.ycrootaccess.com/p/boris-cherny-building-claude-code).

Lessons are read once; references get revisited (D24). This is the desk copy.

---

## The three mechanisms

| | Dynamic workflow | Loop | Routine |
|---|---|---|---|
| Shape of work | **one** task, decomposed | one **repetitive** task | one **repetitive** task |
| Context | shared across stages | not shared between runs | not shared between runs |
| Memory | within the run | may share memory | may share memory |
| Runs | on demand | locally (a local cron) | in the cloud — laptop can close |
| Invoked by | saying "use a workflow" | an interval | a schedule |

Boris's own framing: for a dynamic workflow "it's one task and you break it up into chunks"; for
loops and routines "it's one task that is repetitive that doesn't share context, but it might share
memory."

## What a dynamic workflow actually is

Bun as the sandbox, with a virtual machine started inside it. Claude starts many agents and
orchestrates them — explicitly *not* one agent, and not merely ten in parallel. The staged pattern
he describes: a first pass fans out; a second stage verifies or summarises that work; a third stage
fans out again.

Named use cases: rewriting a codebase, in-depth analysis over complicated data, or a complex feature
spanning multiple stages and "maybe dozens of pull requests."

### The algebra

> "essentially an algebra for agents … there's a way to run agents in sequence. There's a way to run
> agents in parallel."

Two composition operators over agents. Because composing agents yields something agent-shaped, the
result composes again — which is what makes staged fan-out expressible rather than hand-rolled.
Boris attributes the design to a functional-programming background.

### What the live tool contract adds

The transcript names the operators; the runtime settles the questions it leaves open.

- **`parallel(thunks)` is a barrier.** It awaits every branch. A failed branch resolves to `null`
  rather than rejecting — filter before use.
- **`pipeline(items, ...stages)` has no barrier.** Each item flows through every stage
  independently; item A can be in stage 3 while B is in stage 1.
- **Default to `pipeline`.** A barrier is justified only by a genuine cross-item dependency: dedup
  across the whole set, early-exit on zero, or a prompt that references the other results. "I need to
  flatten/filter first" and "the stages are conceptually separate" are *not* justifications.
- **Determinism is enforced.** `Date.now()`, `Math.random()`, and argless `new Date()` throw,
  because resume replays the longest unchanged prefix of agent calls and that is only sound for a
  pure function of (script, args). Pass timestamps in; stamp results after.
- **Caps.** Concurrency `min(16, cores − 2)` per workflow; 1000 agents per run lifetime; 4096 items
  per `parallel`/`pipeline` call. Nesting via `workflow()` is one level only.
- **Structured output.** Passing a JSON Schema forces the subagent through a validated tool call, so
  results come back as objects rather than prose to parse.

*Caveat: a tool contract is version-specific and will drift. The transcript's concepts should
outlive it.*

## Test-time compute — the argument underneath

Boris places this in the scaling-laws frame. Historically, model intelligence scaled with network
size, training data, and training flops; more recently, test-time compute was added — which he
glosses as, in effect, how many tokens get generated. Dynamic workflows are then "a new way to
orchestrate test time compute," and a way to ramp up how much of it a hard task can absorb.

Worth holding precisely: this is an argument about *orchestrating* compute at inference, not a claim
that the model itself improved.

## Self-maintenance: routines pointed at their own codebases

Started from a Slack channel, run across the CLI, iOS, Android, and desktop apps. Roughly 20–30
routines daily.

| Routine | What it does |
|---|---|
| Dead-code cleanup | finds dead code by static and dynamic analysis, opens PRs daily |
| Ship experiments | deletes an experiment already rolled out to 100% and ships it |
| Write tests | adds coverage where the codebase needs it |
| Delete tests | removes useless tests left by older models or by people |
| **Abstraction police** | finds near-duplicate abstractions across codebases and unifies them |

The dead-code routine is **one sentence**, and the static-and-dynamic-analysis approach was not
prompted — it was worked out by the model. That is the load-bearing detail: the leverage came from
the mechanism, not from prompt craft.

Boris's stated direction is "on the path to fully automating the maintenance of our apps," freeing
engineers for new product and user contact.

## Claims by confidence

Keep these apart — they are not all the same kind of statement.

| Claim | Standing |
|---|---|
| The mechanisms exist and have this shape | **Demonstrated** — his own system, his own words |
| `parallel` barriers, `pipeline` doesn't, purity enforced | **Verifiable** — live tool contract |
| One-sentence prompt; analysis approach unprompted | **Reported**, specific and checkable |
| "Thousands" of agents from one task | **Estimated** — he hedges in the transcript: "I'm not sure. I can ask Claude" |
| 20–30 routines daily; hundreds–thousands of agents daily | **Estimated**, same hedge |
| "Work of dozens or hundreds of engineers" | **Unmeasured** — a comparison, not a measurement |

## Branching suggestions — what to follow next

Ordered by what they'd change, not by interest.

1. **Run one workflow on a real fan-out you already have.** Skill-hardening Wave 2 is dispatched and
   is exactly the shape: per-skill work, independent, with a verify stage. Pipeline, not barrier. The
   cheapest possible test of whether the algebra transfers.
2. **Ask which of your chores are abstraction-police-shaped.** The pattern works because a duplicated
   abstraction is cheap to verify and safe to be wrong about. Your equivalents are probably
   bead-lint conformance, ADR index rebuilds, and dead-symlink repair — *not* anything touching
   northstar `current:` or roadmap status, where being wrong is expensive.
3. **Rule the loop-versus-routine gap.** `decisions/loops/loops.md` runs `launchd` — local loops
   only, no cloud equivalent. Following this means deciding what has to be true before an unattended
   routine may open a PR against the fleet. That is a `/wayfinder` grilling ticket, not a slice.
4. **Reconcile with the 80%-cut evidence.** The same talk argues for *deleting* prompt scaffolding
   while this segment argues for *orchestrating* more compute. Those are compatible — less
   instruction, more structure — but the fleet is currently accreting both. Worth an explicit call.
5. **Write the thing that doesn't exist.** Boris says this hasn't been written about much and the
   sourcing confirmed it. A concrete write-up of the algebra with worked pipeline-vs-barrier cases
   would be genuinely novel — and it maps onto the FDE positioning forcing function from lesson
   0001's mission.

## Related in this fleet

- `decisions/loops/loops.md` — the existing local-loop registry (`launchd` triggers)
- `/orchestrate` — the fleet's 4-layer decomposition, which predates and does not use this mechanism
- **Zero** references to dynamic workflows exist anywhere in core as of 2026-08-04 — this is new
  ground here, which is why no fleet-internal primary source is cited above
