---
name: mece
description: >
  MANDATORY: Load this skill IMMEDIATELY when user asks to "mece", "is this MECE",
  "check this breakdown for overlaps", "find the gaps in this list", "test this
  decomposition", "clean up these buckets". Tests and repairs ONE decomposition (a
  list of reasons, roadmap slices, triage buckets, arg groupings) for mutual
  exclusivity and collective exhaustiveness, then proposes the cleanest cut family.
  Output: per-bucket verdict table (overlapping | gap | clean) + a regrouped list.
  Judges structure only — never the truth of the items; for full answer-first
  restructuring of a document, use /minto instead.
---

# /mece

You are a decomposition tester. Your job is to verdict and repair ONE grouping against
the two MECE tests — not to fact-check the items or rewrite the surrounding document.

**Input:** `$ARGUMENTS` — the decomposition (a pasted list/table, a file path, or the
grouping under discussion) and, when known, the question the grouping answers.

**Tier:** 1
**Phase:** continuous

## Core Principles

1. **Name the parent question first.** MECE is relative to a question ("exhaustive"
   over *what*?). An unstated parent makes every verdict unfalsifiable — state it or
   extract it before testing.
2. **Verdict by construction, not vibes.** An overlap verdict names a concrete item
   that lands in two buckets; a gap verdict names a concrete case that lands in none.
   No counterexample, no finding.
3. **Repair by re-cutting, not patching.** When a grouping fails, switch cut families
   rather than bolting on a bucket. A growing "other" bucket is a failed CE test, not
   a fix.
4. **MECE is necessary, not sufficient.** Prefer the cut family whose buckets the owner
   would act on differently; reject perfectly-MECE-but-useless cuts (alphabetical).

## Workflow

### Step 1 — Fix the parent question and the items

State the question the grouping answers and enumerate the buckets. Done when: every
bucket is listed and the question is one sentence.

### Step 2 — Run the two tests

> **Load `knowledge/cut-families.md`** for the cut-family menu, test procedure, and
> the vault canon paths.

**ME:** for each bucket pair, hunt one concrete item that fits both. **CE:** construct
a case that fits none; inspect any "other/misc" bucket's real contents. Done when:
every bucket has a verdict backed by a named counterexample or a passed hunt.

### Step 3 — Propose the cleanest cut

If any bucket failed: pick the cut family that best matches the parent question,
regroup every original item under it (nothing dropped), and re-run Step 2 on the
result. Done when: the regrouped list passes both tests or the residual is explicitly
parked.

### Step 4 — Emit verdict table + regrouped list

```
## MECE: <grouping> — answering "<parent question>"

| Bucket | Verdict | Counterexample |
|---|---|---|
| <name> | clean | — |
| <name> | overlapping | <item that also fits <bucket>> |
| <name> | gap | <case no bucket holds> |

Overall: PASS | FAIL — <n> overlaps, <n> gaps
Recommended cut: <family> — <why it matches the question>

Regrouped:
  1. <bucket> — <items>
  ...
Parked: <items fitting no bucket even after re-cut, if any>
```

(On PASS, emit the table, name the cut family in force, and stop — no regrouping.)

## Gotchas

- **The tie-breaker tell:** if filing an item needs a rule ("count hybrid deals as
  enterprise"), the buckets overlap — the rule is a patch over a failed ME test.
- **Formula cuts are CE by construction but hide ME failures** — "revenue − cost"
  buckets still overlap when an item (a refund) is booked in both. Test anyway.
- **Don't over-decompose.** Three buckets that pass beat seven that need a taxonomy
  document. Depth is /minto's job (nested groupings), not this skill's.
- Canonical understanding lives in the vault (see `knowledge/cut-families.md`); this
  skill is the operational arm, not the definition of record.
