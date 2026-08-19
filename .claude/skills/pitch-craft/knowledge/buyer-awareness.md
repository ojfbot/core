# Buyer-awareness classification and question registers

Reference for `/pitch-craft` Step 1. Self-contained for headless reads (dealdesk PM
agents load this file from disk at prompt-assembly time).

Rule of record: the operator feedback memory
`~/.claude/projects/-Users-yuri-ojfbot/memory/feedback_index_pitch_questions_to_buyer_awareness.md`
(2026-08-18, first Upwork pitch). Vault canon this composes with:
`~/selfco/wiki/concepts/scqa.md` (the Situation is the buyer's own context),
`~/selfco/wiki/concepts/continuous-discovery.md` (where discovery questions DO belong),
`~/selfco/wiki/concepts/pattern-ask-for-the-sale.md` (the close, at every stage).

## The rule

Index the question register to the buyer's awareness stage **before** reaching for
discovery canon. A solution-aware technical buyer must get questions **only someone
already solving their problem would ask**, each anchored to a specific line of their
brief — never pain-excavation or value-justification questions, which force them to
repeat their own brief and read as consultant theater.

## Classification rubric

| Stage | Evidence markers in the brief | Question register |
|---|---|---|
| **Solution-aware** | Detailed technical brief; named stack/tools; documented failure notes or prior attempts; explicit filters ("skip the fluff", "operators only"); stakes already stated | **Build-shaping questions in build order** — spec surface → technique → runtime constraints. Each question cites the brief line it shapes (e.g. preset cardinality, reference-set source, latency budget at end-of-flow). |
| **Problem-aware** | Names the pain but not a solution shape; asks "how would you approach…"; no stack commitments | Mixed: 1–2 approach-framing questions + 1–2 story questions establishing the job and its stakes. |
| **Problem-unaware** | Vague ask; symptoms described without a named problem; exploratory tone | Discovery story questions (continuous-discovery style): walk me through the last time…, what did the wrong result cost…, what moves in your numbers. |

When markers conflict, classify by the strongest *technical* evidence: a buyer who
names their stack and their failure mode is solution-aware even if their prose sounds
exploratory.

## The anchoring test (solution-aware only)

Every question must pass: **"does this demonstrate having read a specific line of
their brief, and does the answer change what we build?"** A question failing either
half is cut or displaced. The corrected questions from the origin incident all pass:
preset cardinality (their preset list), reference-set source (their conformance
target), latency budget at end-of-flow (their pipeline description).

## Displacement, not deletion

Discovery and value-justification questions struck from a solution-aware pitch move to
the **post-contract kickoff call**, where they set acceptance thresholds and
before/after baselines. Emit them under a separate `Kickoff (post-contract)` heading so
they survive.

## Invariant across all stages

The explicit CTA survives at every awareness stage (pattern-ask-for-the-sale): one
concrete, confident next step. Awareness classification changes the *questions*, never
whether you ask for the sale.
