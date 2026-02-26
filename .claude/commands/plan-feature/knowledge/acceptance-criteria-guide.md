# Acceptance Criteria Guide

Acceptance criteria are the contract between product intent and engineering implementation. They must be testable — verifiable by reading code or running a test, not by judgment.

## Format (Given/When/Then)

```
Given [precondition — the state before the action]
When [action — what the user or system does]
Then [expected outcome — what must be true afterward]
```

## Properties of good acceptance criteria

**Testable:** Can be verified by a test or by inspection, not by opinion.
- Good: "The API returns 401 when no token is provided"
- Bad: "The API is secure"

**Atomic:** One criterion per statement.
- Good: Two separate criteria for auth failure and auth success
- Bad: "Auth works correctly in all cases"

**Specific:** Names the exact component, endpoint, or behavior.
- Good: "The `POST /api/articles` endpoint returns the created article's ID"
- Bad: "Creating an article works"

**Bounded:** Describes the scope of the change (not the entire system).
- Good: "The form validates that email is required before submitting"
- Bad: "The form works"

## Anti-patterns

**Implementation criteria** (describe how, not what):
- Bad: "Stores the user's email in the `users` table using a Prisma upsert"
- Good: "After login, the user's profile shows their email address"

**Unmeasurable criteria:**
- Bad: "Performance is good"
- Good: "The page loads within 2 seconds on a 4G connection (LCP < 2s)"

**Duplicate criteria:**
- If two criteria say the same thing from different angles, collapse them.

## Test matrix structure

For each AC, identify:
| AC | Test type | Test file | Pass condition |
|----|-----------|-----------|----------------|
| Auth required | Unit | `auth.test.ts` | Returns 401 |
| Auth success | Integration | `auth.test.ts` | Returns 200 + token |
| Edge: expired token | Unit | `auth.test.ts` | Returns 401 |

## How many ACs to write

- Simple CRUD feature: 3-5
- Auth feature: 5-8 (happy path + all failure modes)
- Complex multi-step flow: 8-12 (one per meaningful state transition)
- If you have >15, the feature is too large — split it

## Security criteria (always include)

For any feature that touches user data or auth:
- "Unauthenticated requests return 401"
- "User A cannot access User B's [resource]"
- "Input exceeding [limit] is rejected with 400"
