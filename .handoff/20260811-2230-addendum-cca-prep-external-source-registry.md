# Addendum to 20260811-1900-spec-cca-prep-repo — external-source registry seed (S2 `research` mode)

Date: 2026-08-11 · From: core campaign session · For: the cca-prep repo session (slice 2+)

> **SUPERSESSION + AUDIT NOTE (2026-08-12).** The cowork session's three-tier
> `research/source-policy.json` (canon / reference / prohibited) supersedes the flat registry
> JSON shape proposed below — adopt theirs; this file's per-source verdicts remain the audit
> evidence. Two corrections the core session adds to the cowork handoff
> (`research/sources/20260812-third-party-prep-sources.md` era):
> 1. **Contamination gate missing from W5/W6:** blind-solve `qa` validates answer keys, not
>    student decorrelation. The Cowork-authored seed banks (12 CCDV-F, 12 CCAR-P, 45 CCAR-F)
>    were authored with the operator in the loop — default them to `surface: "practice"`;
>    calibration/mock entry requires per-batch operator attestation of non-exposure.
> 2. **Transient-fetch resolution:** external question text is never persisted anywhere
>    (cowork W2 rule wins over this addendum's earlier private-cache allowance); persist item
>    references (ID/URL/hash) + telemetry only, fetch text at drill time — Leitner over
>    external items survives without text persistence.
> Canonical boundary record: `~/selfco/wiki/sources/cca-external-prep-sources.md`.

Dia research surfaced four third-party CCA-F prep sources; the core session audited them
2026-08-11 (direct fetch + reputation search). Canonical audit page:
`~/selfco/wiki/sources/cca-external-prep-sources.md`. This addendum seeds the S2 `research`
mode's external-source registry and formalizes one denylist entry.

## Registry seed (proposed shape — `research/sources.json` or equivalent)

```json
{
  "version": 1,
  "sources": [
    {
      "id": "certsafari",
      "url": "https://www.certsafari.com/anthropic/claude-certified-architect-foundations",
      "exam": "ccar-f",
      "verdict": "use",
      "purpose": "external-drill-pool",
      "notes": "Free, ~480 q, per-domain modes, explanations, Guide 1.0-aligned. Original-synthetic posture; answer keys noisy until spot-validated.",
      "audited": "2026-08-11"
    },
    {
      "id": "claudecertificationguide",
      "url": "https://claudecertificationguide.com/mock-exam",
      "exam": "ccar-f",
      "verdict": "use-with-caution",
      "purpose": "reserved-timed-mock-instrument",
      "notes": "Free 28q/56min + 60q/120min, /1000 scoring, pass 720. Provenance opaque but no braindump claims. Reserve 60q as valid mock #1; 28q burns first as instrument validation.",
      "audited": "2026-08-11"
    },
    {
      "id": "udemy-ccar-f-practice",
      "url": "https://www.udemy.com/course/claude-architect-exam-practice-tests/",
      "exam": "ccar-f",
      "verdict": "defer",
      "purpose": "paid-fallback",
      "notes": "3x60 paid set, described as 2026-aligned but generic. Only if generation pipeline slips AND both free pools burned; ask operator before purchase.",
      "audited": "2026-08-11"
    },
    {
      "id": "skillcertpro",
      "url": "https://skillcertpro.com",
      "exam": "*",
      "verdict": "denylist",
      "purpose": null,
      "notes": "BRAINDUMP: advertises 'Real Exam Question taken from Previous Exams' — NDA-violating source class. Reviews report ~30% wrong keys. Never use for any exam; 'felt very close to the live exam' endorsements are themselves the signal.",
      "audited": "2026-08-11"
    }
  ]
}
```

## Binding rules the registry must carry (from the audit page; boundary REVISED 2026-08-12)

1. **Denylist is by class, not just by name:** any source claiming real/previous exam
   questions is excluded fleet-wide; Skillcertpro is the first named entry. Tier-independent —
   applies to drilling, caching, and generation alike.
2. **Ingestion boundary (revised per operator 2026-08-12):** the firewall is
   **generation-side, not app-side**. Third-party question text never reaches the deck
   authoring path (author agents, briefs, generate/qa inputs) and never enters the publishable
   repo. But the training app MAY plumb external sources for the operator's own learning:
   (a) external session telemetry (source/valid/timed mock detail + own-words miss notes);
   (b) per-source adapters caching external items in a PRIVATE local store (vault-side or
   gitignored) and serving them through the app's drill UI with unified Leitner/telemetry
   state, tagged by source. New slice candidate: **external-source adapter surface** —
   tracking tier first (no scraping; near-free), adapter tier second (per-site fetchers,
   fragile by nature, cache never published).
3. **Mock telemetry fields:** external mock ingestion needs `source`, `valid`, `timed` in the
   mocks detail — extends the already-filed mock-validity-flag [project] note (drill-app note
   #4 carries this too; `triage-notes` will surface it).
4. **Budget doctrine:** external pools are reserved instruments (decorrelated material powers
   the valid-mock gate). Schedule lives in the vault synthesis page — don't burn the CCG 60q
   pool on drills.

## Slice-2 tie-in

Valid mock #2 is planned to come from the S2 generation pipeline (fresh 60q deck, mock mode)
in week 4 (~Sep 1–7). That keeps the "generation pipeline before GroupThink skin"
recommendation time-critical: the pipeline is now on the gate path, not just the freshness path.
