# ADR-0024: G3 Approval Queue as security primitive, not a permission dialog

Date: 2026-03-18
Status: Accepted
OKR: 2026-Q1 / O1 / KR3 (Cross-domain hero demo — production-ready)
Repos affected: shell
Shipped: [shell] #37 (`704f5ee`)

---

## Context

NL instance spawning and cross-domain fan-out writes are high-impact operations: a single
ShellAgent utterance can touch multiple app instances, create threads, and issue writes across
sub-apps. Users must be protected from unintended consequences without being buried in confirm
dialogs that they learn to dismiss.

Two UX patterns were considered: a binary confirmation dialog ("Are you sure?") or a structured
diff of the intended state change displayed before execution.

## Decision

The G3 Approval Queue presents a **structured diff of the plan** before any high-impact action
executes. The user sees which apps will open, which threads will be modified, and which tool
calls will fire. They can **edit the plan**, not just approve or cancel. Execution is a separate
step gated on user confirmation of the rendered plan.

ShellAgent produces a declarative plan object before any action executes. The queue renders that
object. There is no reconstruction of intent from an action log — the plan is displayed before
the plan runs.

## Consequences

### Gains
- **A confirm dialog answers "did the user consent?" The Approval Queue answers "does the user
  understand what they're consenting to?"** For cross-domain fan-out writes — where ShellAgent
  might touch three sub-apps in one utterance — a binary confirm is not sufficient UX. The user
  needs to see the blast radius before it fires.
- The queue is the mechanism that makes NL spawning safe to ship at all. Without it, an NL
  misinterpretation could silently spawn unintended instances or issue writes to the wrong
  threads. The queue surfaces the misinterpretation before harm.
- Edit-before-confirm means the user can correct ShellAgent's interpretation without starting
  over. This is qualitatively different from approve/cancel — it treats the plan as a
  collaborative draft.

### Costs
- **Verification gap (as-shipped):** the correctness of the Approval Queue's rendered diff under
  a complex cross-domain fan-out write has not been confirmed with a real test case. Phase 4 is
  merged, not production-verified. [shell] #37 review item: verify G3 renders correct structured
  diff for a cross-domain fan-out write before treating Phase 4 as production-ready.
- ShellAgent must produce a correct and complete plan object before execution — the queue is only
  as good as the plan it renders. A plan object that omits a side effect will not surface that
  side effect to the user for confirmation.

### Neutral
- The queue does not protect against ShellAgent misidentifying intent (see ADR-0022 and
  ADR-0023). It protects against the user not understanding the consequences of a correctly
  identified intent. These are separate failure modes addressed by separate mechanisms.

## Samir pillar

**Security as emergent UX** — security properties emerge from good interaction design, not from
modal interruptions. The queue is a design decision that happens to produce a security property,
not a security feature bolted on after the UX was designed.
