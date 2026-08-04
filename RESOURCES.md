# RESOURCES

Vetted 2026-08-04. Fleet-internal artifacts are first-class primary sources (D19) — and for this
mission they are *better* than the upstream source, because the mission is about judging **the
fleet's own verdicts**, not about learning what Pocock thinks. Pruned to five.

## Primary

- **`core/decisions/adopt-stack/pocock-writing-great-skills.md`** (D26–D36, decided 2026-08-03) —
  covers Pocock's skill-authoring doctrine and the fleet's per-opinion calls. **Reach for it first:**
  its verdicts are the most heavily *qualified* in the corpus ("ABSORB as judgment signal (J5)",
  "ABSORB, eval-gated", "REJECT as stated; ABSORB the accounting"), which is what makes the
  discriminator visible. Trust: fleet-authored, measured Gate 0, operator-ratified slate.
  **Recommended primary source for going deeper.**

- **`core/decisions/adopt-stack/pocock-skills-v1-1.md`** (D1–D17, decided 2026-07-22) — the first and
  broadest pass; contains the richest REJECT set (D2, D4, D6, D9, D12, D13, D15, D16, D17). Reach for
  it when you want rejects, which carry more information than absorbs. Trust: same.

- **`core/decisions/adopt-stack/pocock-skills-teach.md`** (D18–D25, decided 2026-08-03) — the pass
  that produced `/teach` itself. Reach for it for the one REJECT that is purely local-taste (D25,
  `NOTES.md`) and for D23, the only opinion in the corpus **amended by a measurement taken after the
  verdict** (#386). Trust: same.

- **`adr:wrap-absorb-reject`** (`core/decisions/adr/`) — the framework all three records run on;
  defines what a verdict must carry. Reach for it when you want the rule rather than the instances.
  Trust: accepted ADR. *Note: still draft per the fleet's own memory — the framework governing 36
  ratified verdicts is itself unratified.*

- **`decisions/research/2026-07-17-skill-loop-sota.md`** — the measurement behind D15/D28 (hook-forced
  suggester 84–100% vs router ~80%). Reach for it as the worked example of a reject that is
  *evidence*, not preference. Trust: fleet research record with adversarial verification.

## Secondary — used for one claim only

- **`mattpocock/skills` @ `2ab95809`** (MIT) — the upstream candidate, pinned. Not read in full for
  this lesson; the three records quote it at line level and that is what the lesson cites. Flagged
  because relying on quotations is a real limitation (see Gaps).

## Gaps

- **The upstream source was not read firsthand for this lesson.** Every Pocock quotation here is
  transcribed from a fleet record. If a record mis-quoted him, this lesson inherits the error and
  cannot detect it. This is the honest limit of a lesson built from internal artifacts about an
  external source.
- **His software-fundamentals / TypeScript teaching is not sourced at all.** It was in the original
  topic string and is out of the mission. Nothing here should be taken as covering it.
- **No external community view on his skills library** — no independent assessment of whether other
  teams found the same opinions load-bearing. D20 says delegate to community for *external* domains;
  this one is external, so that delegation is genuinely missing, not correctly omitted.
- **`adr:wrap-absorb-reject` is a draft.** The framework's own status is weaker than the confidence
  the 36 verdicts are stated with. Not resolvable inside this lesson; worth knowing before quoting
  the framework as settled to an interviewer.
