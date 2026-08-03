Reference for `/pr-review`: how this skill relates to `/validate`.

This is `/validate`'s two-axis audit (**Spec**: does the change do what was asked? · **Standards**: auth, secrets, types, logging, tests, framework invariants, lint) run against a GitHub PR diff, plus a teach-don't-just-block framing. Use `/validate` for a local working-tree check; use this for a PR. The auto-blocking rules are identical.
