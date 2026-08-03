Reference for `/triage` Step 2b: the three routes and their criteria in full.

After classification, assign each issue exactly one **route** (Pocock triage state machine,
upstream June 2026; ojfbot S15 verifiability-sorted dispatch):

- **`ready-for-agent`** — ALL of: (a) the acceptance criterion is machine-checkable (a
  runnable test/command exists or can be stated as a one-line `check:`), (b) the claim is
  verified (bug reproduced / behavior confirmed — never route an unverified claim to an
  unattended agent), (c) scope is bounded to one session. State the `check:` command in the
  route reason — it becomes the roadmap slice's `check:` field, which the day-runner's shadow
  stage executes at the slice boundary.
- **`ready-for-human`** — real work whose acceptance is judgment-shaped (design, taste,
  ambiguous scope, cross-repo architecture) or whose claim can't be machine-verified. Not a
  demotion; it's honest routing — the compiler enforces the same split (`agent_eligible`
  without `check:` is demoted to `human_only`).
- **`needs-info`** — can't classify or verify without answers. Name the missing fact.

Add a `Route` column to the proposal table. Anything routed `ready-for-agent` without a
stated check command is a rubric violation — surface it as an anomaly instead.

The route is what an orchestrator/day-runner consumes — severity ranking alone doesn't tell it what is safely delegable. (Full upstream refresh — out-of-scope KB, agent-brief emission — is the F7 adopt-stack pass, tracked separately.)
