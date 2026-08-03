# Worked exemplar — ADR-0081 (CLAUDE.md loading-discipline)

Reference for `/gated-slice`, moved verbatim from SKILL.md: the canonical worked example of a Control-Gated Slice plan.

The canonical example (see `knowledge/seh-mapping.md` for the full walk-through):

- **Slices:** S1 measure + audit (merged) · S3 rollout (merged) · S2 enforcement gate (in progress).
- **S2 Control Gates C0→C7:** C0 criteria spec · C1 deterministic tripwire · C2 Haiku judge ·
  C3 TPM/event log · **C4 shadow mode (Brassboard, observe-only)** · C5 clearance + block→ask ·
  C6 flip-to-enforce (RIDM-gated) · C7 generalization review.
- **TPMs:** M1 always-loaded footprint · M2 Layer-1 conditionality · M3 gate precision / override rate
  (>30% override = overfit) · M4 over-decomposition · M5 judge false-block rate.
- **Data-gated promotion:** **M3 + M5 gate the C4→C6 (shadow→operational) RIDM decision** — the gate
  stays in Brassboard emitting M3/M5 until both clear threshold; C6 is the flip made on that data.
