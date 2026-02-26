# Cause Map Template

A cause map is a structured representation of the causal chain leading from the root cause to the observed symptom. Use this template during Phase 3 of the investigation.

## Format

```
Symptom: [exact observable failure — error message, assertion, user report]
  ↑ caused by
Layer N (symptom layer): [component/function/query that produces the symptom]
  ↑ caused by
Layer N-1: [component/function/data that drives layer N to the wrong state]
  ↑ caused by
...
Root cause: [the earliest identifiable decision, change, or data state]

Contributing factors:
- [environmental condition that made this worse or harder to catch]
- [missing safeguard that would have caught this earlier]
```

## Example (TypeScript type error at runtime)

```
Symptom: TypeError: Cannot read properties of undefined (reading 'id') at cart.tsx:47
  ↑ caused by
cart.tsx:47: user.cart.id accessed when user.cart is undefined
  ↑ caused by
useCart() returns undefined when no cart session exists
  ↑ caused by
CartProvider renders children before fetching session — cart state is undefined on first render
  ↑ caused by
Root cause: CartProvider added Suspense boundary in PR #143 but didn't initialize cart to null

Contributing factors:
- No loading state renders cart UI before data arrives
- TypeScript types allow undefined but component assumed cart is always present
```

## How to build the map

1. Start with the *exact* symptom — quote the error message or describe the specific failure state.
2. Ask: "What code is executing when this happens?" → that's layer N.
3. Ask: "What input or state caused layer N to behave incorrectly?" → that's layer N-1.
4. Repeat until you reach something that changed (code, data, environment) or was always wrong.
5. List contributing factors separately — these are not causes but amplifiers or missed catches.

## When the map is complete

You should be able to draw a straight line from root cause to symptom through concrete code references. If any link in the chain is "unclear" or "possibly", that's a gap — investigate that link before writing the final report.

## Multiple causal chains

If the same symptom can result from two independent causes (OR gate):

```
Symptom: [same symptom]
  ↑ can be caused by either:

Chain A:
  Layer A-N → ... → Root cause A

Chain B:
  Layer B-N → ... → Root cause B
```

Determine which chain is active in the current incident before proposing a fix.
