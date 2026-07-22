# Seams and anti-patterns

Re-expressed from mattpocock/skills v1.1 `tdd` reference material (pinned `ed37663`; verdict D8 in
`decisions/adopt-stack/pocock-skills-v1-1.md`), adapted to this repo's conventions. Loaded from
`/tdd` step 2 (agree the seams) and consulted during the loop, not after.

## What a seam is

A **seam** is the public boundary you test at: the interface where behavior is observable without
reaching inside. Tests live at seams, never against internals. Code inside the seam can change
entirely; the tests shouldn't.

A good test at a good seam reads like a specification — `it('user can checkout with valid cart')`
tells you exactly what capability exists — and survives refactors because it doesn't care about
internal structure. Name tests in the project's domain language (`CONTEXT.md` vocabulary), and
respect ADRs in the area under test.

## Choosing seams

- **Fewest seams, highest level.** The ideal number is one: the highest boundary that still
  exercises the behavior deterministically. You can't test everything — agreeing the seams up front
  is how testing effort lands on critical paths and complex logic instead of every edge case.
- **Pre-agreed means confirmed.** The seam list is confirmed with the user (or inherited from the
  spec's Testing Decisions) before the first test. A test at an unconfirmed seam doesn't get written.

## Where mocks belong

Mock at **system boundaries** only: external APIs (payment, email), time and randomness, sometimes
the database (prefer a test DB) and filesystem. Never mock your own modules or internal
collaborators — a mock of something you control is the implementation-coupling anti-pattern below.

Design the boundaries for mockability:

- **Dependency injection.** Pass external clients in; don't construct them inside the function
  (`processPayment(order, paymentClient)`, not `new StripeClient(env.KEY)` inline).
- **SDK-style interfaces over generic fetchers.** One specific function per external operation
  (`api.getUser(id)`, `api.createOrder(data)`) — each mock returns one shape, no conditional logic
  in test setup, and it's obvious which endpoints a test exercises.

## Anti-pattern catalog

### Implementation-coupled

Mocks internal collaborators, tests private methods, asserts on call counts/order, or verifies
through a side channel instead of the interface. The tell: the test breaks on a refactor when
behavior hasn't changed.

```ts
// BAD: bypasses the interface to verify
await createUser({ name: "Alice" });
const row = await db.query("SELECT * FROM users WHERE name = ?", ["Alice"]);
expect(row).toBeDefined();

// GOOD: verifies through the interface
const user = await createUser({ name: "Alice" });
expect((await getUser(user.id)).name).toBe("Alice");
```

### Tautological

The assertion recomputes the expected value the way the code does, so the test passes by
construction and can never disagree with the implementation. Expected values must come from an
independent source of truth — a known-good literal, a worked example, the spec.

```ts
// BAD: expected value recomputed the way the code computes it
const expected = items.reduce((sum, i) => sum + i.price, 0);
expect(calculateTotal(items)).toBe(expected);

// GOOD: independent known literal
expect(calculateTotal([{ price: 10 }, { price: 5 }])).toBe(15);
```

Hand-derived snapshots built by the same procedure as the code, and constants asserted equal to
themselves, are the same trap wearing different clothes.

### Horizontal slicing

Writing all the tests first, then all the implementation. Bulk tests verify *imagined* behavior —
they test the shape of things rather than user-facing behavior, go insensitive to real changes, and
lock in test structure before the implementation has taught you anything. Work in **vertical
slices**: one test → one minimal implementation → repeat, each test a **tracer bullet** aimed by
what the previous cycle showed.

## Relation to the loop

These rules bind every cycle of `/tdd`: seam agreed (step 2) → red at that seam for the expected
reason → minimal green → full suite → refactor offers at green. Refactoring stays in the loop at
green for small fresh-context cleanups (`adr:tdd-skill` rev A — a deliberate divergence from
upstream); cross-cutting structural smells surface at review via the shared smell baseline
(`adr:two-axis-review-hardening`).
