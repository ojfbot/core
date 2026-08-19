# The two register contracts

Reference for `/eli` Step 3. Both registers draw on the same fact base (Step 2); they differ in
ordering and grain, never in truth.

---

## 🎓 Intern register

**Reader model:** capable, junior, new to this project. Needs mechanics, sequence, and the why
behind each step. Will be asked "how's it going?" tomorrow and must answer concretely.

Contract checklist:

- [ ] **Stepwise** — numbered steps or sub-milestones in execution order
- [ ] **Why before what** — each step opens with the one-clause reason it exists
- [ ] **Terms defined on first use** — one clause, inline, only terms of art (not basics)
- [ ] **Observable done-state per step** — "done when X" where X is checkable, not "done when finished"
- [ ] **Effort vs calendar distinguished** — "≈3h of work, lands day 2" not "takes day 2"
- [ ] **Dependencies flagged where they bite** — "can't start until we have Y from Z"
- [ ] **Ranges, not point estimates**, with the driver of the spread named

Length: as long as the steps demand, no longer. Tables welcome for step/effort/done-state.

## 📊 Executive register

**Reader model:** decision-maker with 60 seconds. Wants the answer, the confidence, the risks,
and what (if anything) they must decide or unblock. Zero interest in mechanics.

Contract checklist:

- [ ] **Sentence 1 = the answer** — cost, date range, and/or the decision being asked for
- [ ] **≤3 supporting bullets** — each is reason + evidence, not narrative
- [ ] **Risk table** — top 2–3 risks as risk → mitigation → who holds it
- [ ] **Asks explicit** — if something is needed from the reader, it's a labeled line, not implied
- [ ] **≤120 words** excluding the risk table
- [ ] **No mechanics** — if a bullet explains *how*, move it to the intern register

## Worked micro-example

Subject: "add retry logic to the ingest worker" (fact base: ~4h effort, lands this week, risk =
third-party rate limits unknown, mitigated by capped exponential backoff; need staging API key
from platform team).

**Intern:** 1) Reproduce the failure (flaky 503s from the vendor) so we have a failing case —
done when the error is captured in a test. 2) Wrap the fetch in capped exponential backoff
(retry with growing waits, ceiling 60s) — done when the test passes with injected 503s.
3) Add a dead-letter path (parking lane for jobs that exhaust retries) — done when a
forced-failure job lands there with its error attached. ≈4h total effort; calendar lands this
week once the platform team provides the staging key (blocker for step 1).

**Exec:** Retry hardening ships this week at ≈half a day's effort; no decision needed, one
unblock: a staging API key from the platform team. • Eliminates the current silent ingest drops
(23 last week). • Bounded blast radius — worker-only change. | Risk: vendor rate limits unknown →
capped backoff + dead-letter lane → owned by us.

Note what moved between registers: the *mechanism* (backoff, dead-letter) is intern-only; the
*count of drops* and the *ask* lead the exec version. Same facts throughout.
