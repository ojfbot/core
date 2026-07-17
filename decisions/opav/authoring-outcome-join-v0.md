# Authoring→outcome join v0 — `vault` (shadow, observational)

- Slice: `rm:rm-l1-core#S16` (adr:two-track-skill-telemetry — "the join is the loop closing")
- Date: 2026-07-17
- Mode: **SHADOW** — observational, single skill, no gate consumes this. It exists to prove
  the evolution track can be joined to a use-track outcome, not to conclude anything yet.

## The really-changed skill

`vault` is the most-authored skill in the evolution stream (15 `skill:authoring` events,
2026-05-12 → 2026-06-18) and the second-most-suggested skill in the joinable era (29
suggestions carrying a `suggestion_id`).

**Join boundary** — the last vault authoring event inside the joinable era:

```json
{"ts":"2026-06-18T19:03:29Z","event":"skill:authoring","skill":"vault","session_id":"e315b7ca-8ec6-41e5-8a78-351f48bf9436","files_touched":[".claude/skills/vault/SKILL.md",".claude/skills/vault/vault.md"],"kind":"extended"}
```

(This is the same session as gold row `0BEF5CB0`'s sibling era — a SKILL.md + legacy
`vault.md` extension.)

## Outcome joined: use-track follow rate before vs after

Population: era-0093 vault suggestions (`suggestion_id` present), installed population,
dispositions from `~/selfco/tracking/skill-dispositions.jsonl` (rebuilt 2026-07-17 under
the S16 predicate). "Followed" = corroborated engagement or C2-valid acted (independent
signals, never self-report alone). `skill-authoring` rows are excluded from the use
denominator per the two-track rule.

| window | suggestions | use-track denominator | followed | follow rate |
|---|---|---|---|---|
| before (2026-06-13 → 06-18T19:03Z) | 13 | 12 (1 skill-authoring excluded) | 4 | **33.3%** |
| after (06-18T19:03Z → 07-17) | 16 | 16 | 2 | **12.5%** |

## Honest reading

The 2026-06-18 definition change did **not** improve vault's follow rate — it declined
33.3% → 12.5%. Denominators are small (12 / 16) and the windows are confounded (different
work mix, the Northstar-Roadtrip era, no control), so this is **not** evidence the edit
hurt — it is evidence the join mechanism works and that vault's trigger breadth is a
candidate for S9/S10 scrutiny (vault fires on many prompts it doesn't fit; see the
over-firing tail). Per doctrine: the honest decline is reported as-is, not fudged.

## Reproduce

```bash
node scripts/hooks/reconcile-skill-acted.mjs --rebuild   # dispositions view
# join: filter skill=vault in ~/selfco/tracking/skill-dispositions.jsonl by
# suggested_at against the boundary ts; authoring events in
# ~/selfco/tracking/skill-authoring.jsonl
```
