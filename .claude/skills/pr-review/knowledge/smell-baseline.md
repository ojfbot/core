# Standards-axis smell baseline (Fowler, *Refactoring* ch. 3)

Shared by `/pr-review` and `/validate` (single source of truth — `/validate` cross-references this
file, never copies it). Adapted from mattpocock/skills v1.1 `code-review` (pinned `ed37663`; verdict
D10 in `decisions/adopt-stack/pocock-skills-v1-1.md`; `adr:two-axis-review-hardening`).

The baseline applies even when the repo documents nothing. Two rules bind it:

- **The repo overrides.** A documented repo standard (`domain-knowledge/coding-standards.md`,
  CONTRIBUTING, ADRs) always wins; where it endorses something the baseline would flag, suppress
  the smell.
- **Always a judgement call.** Each smell is a labelled heuristic — "possible Feature Envy" — never
  a hard violation and never a blocker. Skip anything tooling already enforces (ESLint,
  `@frame/eslint-plugin`, tsc).

When the Standards axis runs as a sub-agent, paste this baseline **in full** into its prompt — the
sub-agent has no other access to it.

Each smell reads *what it is* → *how to fix*; match against the diff, name the smell, quote the hunk:

- **Mysterious Name** — a function, variable, or type whose name doesn't reveal what it does or holds. → Rename it; if no honest name comes, the design is murky.
- **Duplicated Code** — the same logic shape appears in more than one hunk or file in the change. → Extract the shared shape, call it from both.
- **Feature Envy** — a method that reaches into another object's data more than its own. → Move the method onto the data it envies.
- **Data Clumps** — the same few fields or params keep travelling together (a type wanting to be born). → Bundle them into one type, pass that.
- **Primitive Obsession** — a primitive or string standing in for a domain concept that deserves its own type. → Give the concept its own small type.
- **Repeated Switches** — the same `switch`/`if`-cascade on the same type recurs across the change. → Replace with polymorphism, or one map both sites share.
- **Shotgun Surgery** — one logical change forces scattered edits across many files in the diff. → Gather what changes together into one module.
- **Divergent Change** — one file or module is edited for several unrelated reasons. → Split so each module changes for one reason.
- **Speculative Generality** — abstraction, parameters, or hooks added for needs the spec doesn't have. → Delete it; inline back until a real need shows.
- **Message Chains** — long `a.b().c().d()` navigation the caller shouldn't depend on. → Hide the walk behind one method on the first object.
- **Middle Man** — a class or function that mostly just delegates onward. → Cut it, call the real target direct.
- **Refused Bequest** — a subclass or implementer that ignores or overrides most of what it inherits. → Drop the inheritance, use composition.

Relation to `/tdd`: small cleanups happen at green inside the loop (`adr:tdd-skill` rev A);
this baseline is where cross-cutting structural feedback lives. A recurring smell across reviews is
a `/deepen` or `/techdebt` candidate, not a per-PR fight.
