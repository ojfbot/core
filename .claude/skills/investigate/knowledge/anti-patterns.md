# Investigation Anti-Patterns

Patterns that produce wrong or wasted investigations. Recognize and avoid these.

## Hypothesis-first (most common)

**Pattern:** State a probable cause in the first sentence, then look for evidence that confirms it.

**Why it fails:** Confirmation bias. You find the evidence you're looking for. The actual cause is elsewhere.

**Correct approach:** State the symptom precisely. Collect all available evidence. Build the cause map. Then form hypotheses.

---

## Too wide

**Pattern:** "The system is broken" — investigating everything at once.

**Why it fails:** No evidence triage. The investigation never converges. Findings are a list of problems, not a causal chain.

**Correct approach:** Narrow to the specific symptom first. What is the *observable* failure? One failing assertion, one error message, one user-reported behavior.

---

## Too narrow

**Pattern:** Tunnel-vision on the most obvious component. If the UI is broken, only read UI files.

**Why it fails:** Root causes are often in the layer below the symptom. UI error → API contract broken → type mismatch in data layer.

**Correct approach:** After identifying the symptom layer, explicitly ask: what provides input to this layer? Trace one level up.

---

## Assuming the last commit is guilty

**Pattern:** Check git log, find the last change near the failure, blame it.

**Why it fails:** The last commit may have revealed a pre-existing latent bug, not introduced it. Or the commit is unrelated.

**Correct approach:** Use git bisect or a targeted diff. Trace the failure signature back through time, not just the most recent change.

---

## Reading without running

**Pattern:** Reading code carefully but never reproducing the failure.

**Why it fails:** Code that looks correct can fail due to runtime state, environment differences, or data conditions you can't see in static analysis.

**Correct approach:** If reproduction is possible, reproduce it. Confirm the symptom is real and repeatable before investing in deep analysis.

---

## Symptom-as-cause

**Pattern:** "The bug is that the button is red." (treating the visual effect as the cause)

**Why it fails:** The visual is the end of a causal chain. The cause is earlier.

**Correct approach:** Ask "what produced this symptom?" repeatedly until you reach a code decision or data state, not another symptom.

---

## Premature fix

**Pattern:** Finding a plausible-looking code path and proposing a fix mid-investigation.

**Why it fails:** Fixes applied before the cause is fully understood often address a symptom and mask the root cause. The bug reappears in a different form.

**Correct approach:** Complete the cause map. Identify all contributing factors. Then propose a fix that addresses the root, not the leaf.
