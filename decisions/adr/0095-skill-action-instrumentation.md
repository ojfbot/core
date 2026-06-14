# ADR-0095: Skill-action instrumentation — a two-source, honesty-contracted `skill:acted` signal

slug: skill-action-instrumentation
serial: 0095
domain: workflow-engine
type: architecture

- **Status:** Accepted — Slice 1 of the OPAV-loop gated-slice plan (measure-first; everything downstream gates on its number). C0–C2 (SHADOW) shipped to `main` via PR #158.
- **Date accepted:** 2026-06-14
- **Depends on:** `suggestion-identity-and-denominator` (S0 — the `SUGGESTION_ID` this echoes)
- **Related:** ADR-0092 (why the signal must be agent-emitted, not a Skill-tool hook), ADR-0068, `duplex-work-item-sync` (shared op_id idempotency + honesty contract)

---

## Context

After ADR-0092, most skills are followed **inline** (read the SKILL.md by path), which **bypasses the
Skill tool**, so `log-skill.sh` PostToolUse(Skill) never fires. The "stale since 2026-05-11" telemetry
is this by design. Net: we can measure what is *suggested*, not what is *acted on*. The action-rate is
the denominator the S3 autonomy gate and S5 autonomy depend on — it must exist and be **trustworthy
against a dishonest agent**, because S5 closes work unattended on it.

## Decision

1. **`skill:acted` event, agent-emitted** (not a tool hook — the action routes around the tool), carrying
   `SUGGESTION_ID` (S0), `skill`, `repo`, `mode`, `op_id`, and a skill-specific `expected_artifact`.
   **Consume the tracking spine, don't author it:** `buildSkillActed` → `eventEmit` against the existing
   `EventLedger`; reuse the spine's `assertHonest()` unchanged (one contract, invariant #2). `mode` and
   `expected_artifact` live in `skill:acted.payload`, **not** the shared `TrackingEvent` type (editing that
   type is spine-owned and would change S4/S5). `skill:acted` is evidence-mandatory by construction —
   `assertHonest()` throws without a resolvable `evidence_ref`.
2. **Two-source from day one.** An **independent Stop-hook / PostToolUse-on-Read-of-a-SKILL.md** reconciler
   detects inline follows from the session transcript, cross-checked against the self-emitted event.
   Agent compliance alone is the exact failure mode that produced 0.8% — never rely on it as the sole source.
3. **Honesty contract (the anti-gaming core).** The corroborating trace must be **produced by a different
   mechanism than the emitter and be skill-specific** (an ADR stub for `/adr`, a CONTEXT.md diff for
   `/grill-with-docs`). **Ban self-written log-line-as-its-own-corroboration.** A small audited allowlist
   covers genuinely traceless skills. Add an **adversarial trace-injection test** (seed fake events →
   validator must catch them). Add a **third verdict** (pending/indeterminate) so slow/unconventional
   output isn't binary-forced to "unbacked."
4. **Shadow → active (RIDM), HARD prerequisite for S5.** The validator runs observe-only (annotate) until
   false-flag ≤5% + coverage ≥90% sustained ≥2wk/≥100 events; then it may quarantine unbacked events out
   of the backed-only rate. **S5 autonomy may not be licensed while the validator is merely annotate-only.**
5. **Idempotency:** `skill:acted` carries an `op_id`; retries + the Stop-hook reconciler dedup at the join.
6. **Scope honestly:** report action-rate as `acted / suggested-uninstalled` (the inline-path denominator,
   ≈15 events today) with a **minimum-N power gate** before S3 consumes it; broaden emit or widen the
   inline surface to grow N.

## Disposition model — two-tier, with `engaged_no_act` as a first-class state *(added at sign-off 2026-06-13)*

"Engaged" (read the skill) and "acted" (produced the skill's artifact) are **different events, not a
confidence gradient.** Tier 1 *engaged* is the free S0 inline signal (`corroborate-follow.mjs` — a
`SKILL.md` Read); it is **not** a `skill:acted` event. Tier 2 *acted* is the evidence-mandatory
`skill:acted`. S1 projects each suggestion to exactly one terminal disposition:

| disposition | condition | role in the rate |
|---|---|---|
| `acted` | `skill:acted` emitted + artifact resolves (C2-valid) | numerator |
| `engaged_no_act` | engaged, no `skill:acted`, **and no artifact on disk** | **expected terminal — NOT a gap, NOT a failure; excluded from the capture-rate denominator** |
| `capture_miss` | engaged, no `skill:acted`, **but an artifact DOES exist** | the real C1 failure the ≥70% bar targets |
| `pending` | engaged, `act_expected`, within window, artifact not yet present | third verdict (C2) |
| `ignored` | not engaged | S0 ignored denominator |

**Artifact existence is the discriminator** between honest non-completion (`engaged_no_act`) and a genuine
self-report failure (`capture_miss`) — and it reuses the exact on-disk resolver C2 already needs, no new
mechanism. Capture-rate is therefore `acted / (acted + capture_miss)`, so honest non-completion never reads
as a gap. **Engaged-only skills** (no durable artifact: `/recon`, `/zoom-out`, `/summarize`, `/caveman`)
carry `act_expected: false` in the `expected_artifact` map and terminate at `engaged_no_act` by design.

**Fail-closed for the acted classification** (invariant #3): an event the validator cannot classify counts
as **not acted** (unclassified ⇒ human-gated), the opposite of S2 relevance which fails open. S1 output
feeds suggestion *ranking* only, never autonomy scope (firebreak, invariant #7).

## Consequences

- **Gains:** a two-source, gaming-resistant action-rate — the trustworthy number the loop is built on.
- **Costs:** the Stop-hook reconciler + per-skill `expected_artifact` map + the validator are real work;
  the honest denominator is tiny-N until the inline surface widens.
- **Risk closed:** without the two-source + honesty contract, an autonomous agent could act-falsely AND
  verify-falsely; this makes self-report un-trustable-alone by construction.

## Verification
Capture-rate `acted / (acted + capture_miss)` ≥70% vs the *independent* signal (denominator excludes
`engaged_no_act`); over-capture/false-emit ≤10%; validator catches seeded fakes (adversarial trace-injection);
the action-rate readout reproduces and passes a join correctness oracle (precision/recall vs a gold set);
min-N power gate present before S3 may consume the rate.
