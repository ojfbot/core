Audit the provided TypeScript code for type safety gaps.

## What to look for

1. **`any` usage** — Flag every `any` type. Suggest a concrete replacement.
2. **Loose records** — `Record<string, string>` or `Record<string, unknown>` where keys are known. Replace with a mapped type or interface.
3. **Missing discriminated unions** — Related string literals used as plain `string`. Should be `type Foo = 'a' | 'b' | 'c'`.
4. **Type assertions** — `as Type` casts that bypass type checking. Each needs justification or a type guard.
5. **Implicit any** — Parameters or return types that rely on inference when explicit types would prevent regressions.
6. **Optional vs undefined** — `prop?: T` vs `prop: T | undefined` used inconsistently.
7. **Branded types** — IDs passed as plain `string` where a branded type would prevent mix-ups (e.g., `UserId` vs `PostId`).
8. **Exhaustiveness** — Switch/if-else chains on union types missing `never` exhaustiveness check.
9. **Generic constraints** — Unconstrained generics (`<T>`) where `<T extends Base>` would be safer.

## Output

For each finding:
- **Location** — file:line
- **Issue** — what's unsafe
- **Suggested fix** — concrete code change
- **Risk** — what could go wrong without the fix

Rank findings by risk (highest first).
