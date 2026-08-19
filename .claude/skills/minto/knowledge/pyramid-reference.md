# Pyramid construction reference

Reference for `/minto`. Self-contained for headless reads (dealdesk PM agents load this
file from disk at prompt-assembly time); the canonical concept pages live in the vault:

- `~/selfco/wiki/concepts/minto-pyramid-principle.md` — the framework of record
- `~/selfco/wiki/concepts/mece.md` — the grouping test
- `~/selfco/wiki/concepts/scqa.md` — the intro pattern + order variants
- `~/selfco/wiki/entities/barbara-minto.md` — provenance

Source canon: Barbara Minto, *The Pyramid Principle* (1978; rev. 1996).

## The three rules of a valid pyramid

1. **Vertical — question/answer dialogue.** Each idea raises exactly one question in
   the reader's mind; the level below answers exactly that question. A parent is a
   *summary* of its children, never a label over them.
2. **Horizontal — same kind, MECE.** Ideas in one grouping are the same category of
   idea (all reasons, all steps, all parts — never a mix), mutually exclusive,
   collectively exhaustive as an answer to the parent's question.
3. **Ordered, never arbitrary.** One ordering per grouping, held throughout:
   - **Time** — steps of a process (use when the support is a sequence)
   - **Structure** — parts of a whole (use when the support partitions a thing)
   - **Degree** — ranked by importance (use when the support is parallel reasons;
     strongest first)

## Deductive vs inductive groupings

- **Deductive**: premise → premise → therefore. Tight but forces the reader to hold a
  chain; keep it low in the pyramid if used at all.
- **Inductive**: N parallel claims of the same type under one summary. Minto's default
  for the key line — the reader gets the answer without the chain.

## SCQA mechanics

| Element | Contract |
|---|---|
| Situation | Stable context the audience already accepts — their brief, their stack, the agreed baseline. Zero new information. |
| Complication | The destabilizer that makes the document exist *now*: changed, broke, threatens, or newly possible. |
| Question | The single question the complication forces. Two questions = wrong scope. |
| Answer | The governing thought, verbatim. Apex of the pyramid. |

Order variants: **SCQA** (default, builds tension) · **ASC** (answer-first — executives,
status updates) · **CSA** (complication-first — genuine burning platform). Elements are
fixed; only sequence moves.

## Worked micro-example

Input claims: "SSE keeps the UI responsive" · "polling tripled our API bill" ·
"websockets need infra we don't run" · "we should adopt SSE for progress updates" ·
"SSE is already used by two sibling apps".

```
Governing thought: Adopt SSE for progress updates.
Key line (degree):
  1. It is the only option that fits current infra (websockets need infra we don't run)
  2. It cuts cost (polling tripled the API bill)
  3. It is fleet-proven (two sibling apps already run it; UI stays responsive)
```

Note the test applied: "UI responsive" alone was not a same-kind peer — it folded under
fleet-proven as evidence. That fold (demote evidence under a claim rather than promote
it to a peer) is the most common repair.
