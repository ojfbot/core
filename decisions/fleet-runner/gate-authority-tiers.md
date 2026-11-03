# Gate authority tiers and the stochastic step contract

Date: 2026-11-03. Status: **Proposed input to #313** (what authority the conductor holds), with obligations for #318 (supervision) and #316 (consumption). Initiative: [core #307](https://github.com/ojfbot/core/issues/307), map [`control-plane-conductor`](../wayfinder/control-plane-conductor.md).

This document proposes a classification schema and a call contract. It accepts no runtime, store, host, threshold or implementation slice. It grants no agent any new authority. It sets no numeric policy: every threshold below is a parameter that #313 decides from shadow evidence.

## Operator direction

On 2026-11-03 the operator asked for a higher degree of autonomy and automation in the control plane, on these terms:

1. The control plane may have **bounded agentic capabilities**. Every stochastic (model) call is wrapped in a deterministic runner and checker, is challenged adversarially, and is subject to deterministic validation.
2. **Some gates are human-only.** Others can be **machine- or agent-reviewable**, decided by a tiered schema of trust, impact, certainty and risk. Those gates provide entrance and success criteria for downstream work.
3. The schema should allow rollback and decomposition, and support context management that delivers **large chunks between human checks**.
4. State can be **scrubbed back to versioned predecessors**, so the origin of a change can be located precisely.

The same day, the operator added a principle: **no single agentic interface** (Claude, Codex or an owned harness), and no single machine, is the source of truth or the governor of other clients. Authority and state belong to platform services. Agents are bounded clients of those services.

## Relation to existing decisions

| Existing | What this proposal adds |
| --- | --- |
| ADR-0086 Control-Gated Slices: Control Gates, Entrance and Success Criteria as TPMs, a shadow (Brassboard) stage, RIDM promotion | Says **who or what may decide a gate**, derived from declared properties rather than case by case |
| Draft `progressive-autonomy-gates`: gate-0, gate-1, gate-2 per slice class | Replaces the single ordinal with four axes. The gate-0/1/2 labels remain as the projection of the derived authority (§6) |
| ADR-0024: the plan is rendered and approved before execution | Generalised to every stochastic step: a model output is a proposal, applied only by deterministic code after checks (§1) |
| ADR-0109: publication hold on unknown outcomes | Unknown outcome is an escalation trigger (§3); an I3 effect is never machine-decided |
| #318: independent verifier, no self-grading | Gate canaries and holdout checks measure the gates themselves (§5) |

## 1. Stochastic step contract

A model call never mutates authoritative state directly. It runs as one **stochastic step** inside a deterministic runner, which does all of the following:

1. **Pins its inputs.** Model id and version, prompt hash, sampling settings (temperature does not guarantee determinism, so the output is stored rather than assumed reproducible), tool grants, and content hashes of every input artifact.
2. **Validates its output against a schema.** Malformed output is a failed step, never something interpreted.
3. **Treats the output as a proposal.** Deterministic code applies an accepted proposal. The model holds no write path of its own (ADR-0024 lineage).
4. **Runs deterministic checks** declared for the gate: tests, lint, invariants, policy and privacy guards, hash and provenance checks.
5. **Sends the proposal to an independent challenger** when the gate's verifiability is V2 (§2). The challenger runs in a separate context, preferably a different model family or method, and is instructed to refute, not review. Its findings are recorded whether or not they block.
6. **Respects a budget.** Bounded attempts, tokens, wall time and cost. Exhausting it is a recorded outcome, never silent success.
7. **Emits an immutable gate record** (§4) with the pins, check results, challenger findings, the decision, and which authority made it.

A timeout, crash or lost reply leaves the step **unresolved**, never passed (ADR-0109 lineage).

## 2. Classification axes

Each gate *class* is classified when it is defined. The classification is data in the gate definition, reviewable in a PR, not a judgment made at decision time.

| Axis | Levels | Set by |
| --- | --- | --- |
| **Impact** (blast radius) | **I0** derived or cached output that can be reproduced from pinned inputs · **I1** inside one repository or private workspace, not yet shared · **I2** shared state: a default branch, a shared queue, behaviour other people or services see · **I3** external or irreversible: publishing, sending, deleting, spending, credentials, crossing a privacy boundary | The gate type, deterministically |
| **Reversibility** | **R0** automatic rollback to a pinned predecessor · **R1** reversible with deliberate effort (a revert PR, a restore) · **R2** cannot be undone | The gate type, deterministically |
| **Verifiability** (certainty) | **V0** a deterministic check fully decides the question · **V1** a statistical evaluation with a pre-registered rule and interval decides it · **V2** model judgment, calibrated against attributable human decisions · **V3** values, taste or strategy that only the operator decides | Declared, then audited in shadow |
| **Trust** (earned) | The measured agreement between a class's machine or agent verdicts and attributable human decisions, plus its gate-canary catch rate (§5) | Measured; never self-reported by the deciding agent |

Model-reported confidence is not a measure of certainty. It counts only after calibration against recorded human decisions.

## 3. Deriving gate authority

A fixed rule table maps the axes to the **gate authority**, meaning who or what may pass the gate. It is evaluated deterministically.

| Condition (first match wins) | Gate authority |
| --- | --- |
| I3, or R2, or V3 | **Human only.** Permanent for the class; no trust earned elsewhere promotes it |
| V0 and R0 | **Deterministic**: the declared checks decide |
| V1, I ≤ I2, R0 or R1 | **Machine**: the pre-registered rule decides; the outcome appears in the next human digest |
| V2, I ≤ I2, R0 or R1, and the class's trust is above its promotion threshold | **Agent-reviewable**: proposer, independent challenger and deterministic checks must all pass |
| V2 below the trust threshold | **Shadow**: the agent verdict is recorded and a human decides; agreement becomes trust evidence |

**Escalation triggers** move a single decision up one tier, to a human where the table allows nothing above it:
- the proposer and challenger disagree;
- a deterministic check fails, or its result is missing;
- the decision falls outside calibrated confidence;
- the input is novel for the class (a new model, schema version or data distribution);
- the effect outcome is unknown;
- the grant was revoked or the subject revision changed after the verdict.

**Demotion is always available.** A bad machine or agent decision returns the class to shadow by a recorded decision (draft `progressive-autonomy-gates` lineage).

### Milestone gates

A **milestone gate** is a human gate that bundles many lower-tier gate records. Large decomposed chunks get delivered between human checks this way. The operator reviews one evidence pack per milestone:
- the gate records;
- diffs and metrics against baselines;
- every escalation and how it was handled;
- open unknowns.

The operator does not review each step. A milestone's entrance criteria name the gate records it needs. Downstream slices name the milestone record in their own entrance criteria.

## 4. Gate records, pins and rollback

- **A gate record is append-only.** It holds the gate class and its classification version, subject identity and revision, pins (§1), check results, challenger findings, the deciding authority's identity, the decision, and its time.
- **A passed gate defines a pinned baseline**: source revision, data and artifact content hashes, model ids and config hash. Rollback re-points consumers at an earlier baseline. Nothing is rewritten.
- **Finding a change's origin is a bisection over baselines**, using a deterministic check. It works only if the pins are complete, which makes pin completeness a deterministic (V0) check on the gate record itself.
- **Retention:** content-addressed artifacts that any retained baseline references are kept. Storage and retention policy stay with #311 and #318. Dolt, which already backs the bead store, is one candidate because it versions tables with commit, diff and revert. This document does not select it.
- **Context boundary:** the next agent loads gate records and the artifacts they pin, not transcripts. A gate record is the handoff unit for decomposed work.

## 5. Measuring the gates themselves

1. **Gate canaries.** Known-bad changes, drawn from real past defects and synthetic mutations, are injected regularly into each machine and agent gate class. A class's catch rate is part of its trust (§2). A gate that never fails is unverified, not safe.
2. **Holdout checks.** Some checks are never shown to the proposer, so optimising for visible checks does not pass a gate (Goodhart's law). Rotating them is a #318 obligation.
3. **Challenger independence** is measured, not assumed. Record how often challengers from the same model family agree on canaries they both miss, and prefer diverse challengers, property-based tests or a different method where correlation is high.
4. **No self-grading.** The agent that proposed a change never supplies the trust evidence for its own class (#318).

## 6. Projection onto existing gate labels

| Derived authority | `autonomy` label (draft progressive-autonomy-gates) |
| --- | --- |
| Human only; shadow | `gate-0` |
| Deterministic; machine | `gate-1`, for the class once promoted by RIDM |
| Agent-reviewable | `gate-2`, once promoted by RIDM |

Until #313 accepts a policy, the runner treats every class as `gate-0`, as the draft already requires.

## 7. Worked example: a receiving workload

BookcaseDiscovery's local compute (detection, reading, renders, the test suite) is registered on the #307 map as a receiving workload (note of 2026-11-03).

| Gate class | Classification | Derived authority |
| --- | --- | --- |
| A compute job's output matches its cache key (photo hash, model id, code version, parameters) | I0 · R0 · V0 | Deterministic |
| A pre-registered evaluation verdict (e.g. an AUC rule with a bootstrap interval) | I1 · R0 · V1 | Machine |
| Merging an evaluation report PR to the default branch | I2 · R1 · V2 | Shadow until trusted, then agent-reviewable |
| A product design ruling (what the overlay should look like) | I1 · R1 · V3 | Human only |
| Private photos leaving the owner's machines, or anything published | I3 | Human only |

## 8. Decisions left to #313 and #318

- **Promotion and demotion thresholds** for each class: the agreement run and canary catch rate. They are calibrated parameters, recorded at promotion time.
- **Identity and signing for gate records**, so a human decision cannot be forged by an agent or a shared account (P2a, #313).
- **Who may change a class's classification**, and how such changes are reviewed. Reclassification is itself a human-only gate in this proposal.
- **Canary rate and source**, and how much holdout coverage is enough.
- **Where gate records live** (#311), and how they survive host or provider changes.

## Proof obligations

These are proposed additions to existing proof gates, not new slices.

| Gate in the fleet-runner proof sequence | Evidence this proposal needs |
| --- | --- |
| P2, durable work item | Gate records with complete pins on one synthetic command; a stale worker's verdict is rejected after its lease expires |
| P2b, scheduling and human control | A human-only gate holds dependent work while unrelated machine-gated work proceeds |
| P3, external effect | An I3 effect cannot pass under any machine authority; an unknown outcome escalates |
| #318, supervision | A canary run reports each class's catch rate; challenger agreement on canaries is measured |
