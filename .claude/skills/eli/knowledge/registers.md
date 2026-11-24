# The two register contracts

Reference for `eli` Step 3. Both registers draw on the same fact base (Step 2); they differ in
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
- [ ] **Uncertainty preserved** — retain supplied ranges and their stated drivers; distinguish
  estimates from measured counts. Missing estimates or drivers remain unknown.

Length: as long as the steps demand, no longer. Tables welcome for step/effort/done-state.

## 📊 Executive register

**Reader model:** decision-maker with 60 seconds. Wants the answer, the confidence, the risks,
and what (if anything) they must decide or unblock. Zero interest in mechanics.

Contract checklist:

- [ ] **Sentence 1 = the answer** — cost, date range, and/or the decision being asked for
- [ ] **≤3 supporting bullets** — each is reason + evidence, not narrative
- [ ] **Risk table** — up to 3 established risks as risk → mitigation → who holds it. Keep
  missing mitigations/owners unknown; if no risks were established, say so instead of inventing rows.
- [ ] **Asks explicit** — if something is needed from the reader, it's a labeled line, not implied
- [ ] **≤120 words** excluding the risk table
- [ ] **No mechanics** — if a bullet explains *how*, move it to the intern register

## Worked micro-example

Subject: "add retry logic to the ingest worker".

Established fact base:
- Effort: approximately 4 hours (estimate); calendar target: this week, dependent on a staging
  API key from the platform team.
- Current failure: vendor requests sometimes fail; the failure count is unknown.
- Proposed implementation: capped exponential backoff (increasing waits between attempts),
  maximum retry delay 60 seconds, and a dead-letter path for exhausted retries.
- Risk: third-party rate limits unknown; mitigation: capped backoff and dead-letter handling;
  risk owner: the engineering team.

**Intern:** 1) Reproduce a failed vendor request so we have a failing case —
done when the error is captured in a test. 2) Wrap the fetch in capped exponential backoff
(retry with growing waits, maximum delay 60 seconds) — done when the test passes with injected failures.
3) Add a dead-letter path (parking lane for jobs that exhaust retries) — done when a
forced-failure job lands there with its error attached. Approximately 4 hours of effort (estimate);
calendar target this week depends on the platform team's staging API key. Third-party rate
limits remain unknown; capped backoff and dead-letter handling mitigate that risk, owned by
the engineering team. The current failure count is unknown.

**Exec:** Retry hardening targets this week at approximately 4 hours of effort (estimate),
dependent on a staging API key from the platform team.
- Current failure count is unknown; no quantified reduction is established.

| Risk | Mitigation | Owner |
|---|---|---|
| Third-party rate limits unknown | Capped backoff and dead-letter handling | Engineering team |

**Ask:** Platform team to provide the staging API key.

The intern version explains the mechanism and its 60-second ceiling; the executive version
omits that implementation detail. Both preserve effort, calendar dependency, unknown failure
count, risk, mitigation and owner without supplying missing facts.

## Unknown-only inputs

If a subject has measured counts but no estimate, deadline, dependencies or risks, retain the
counts and any explicit arithmetic. State that the missing information is not established.
Do not turn a missing risk into a claim that there is no risk, or invent a decision/owner/ask.
