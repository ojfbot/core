# Coverage Priorities

## What to Test First (highest value per line of test)

### 1. Zod Schemas at API Boundaries
- Every `req.body`/`req.params` schema: valid input, invalid input, edge cases
- Schema composition (`.merge`, `.extend`, `.pick`)
- Default values and transforms

### 2. Bead Mappers
- `mapJobToBead()` and equivalents: correct field mapping, status derivation
- Edge cases: missing optional fields, expired deadlines

### 3. Agent System Prompts (Snapshot Tests)
- `getSystemPrompt()` output stability — catch accidental prompt regressions
- Prompt template variable substitution

### 4. Redux Slices
- Reducers: each action creator produces correct state
- Selectors: return expected derived state
- Async thunks: pending/fulfilled/rejected states

### 5. Utility Functions
- Pure functions: input → output, boundary values
- Config loaders: missing files, malformed JSON, env fallbacks

### 6. Express Route Handlers
- Happy path: correct status code + response body
- Validation failures: 400 with Zod error details
- Auth failures: 401/403

## What NOT to Test

- **React component rendering** — no Storybook, no JSDOM. Visual regression CI covers this.
- **CSS/styling** — covered by visual regression screenshots
- **Third-party library wrappers** — trust the library, test YOUR logic
- **Console output** — test behavior, not logging
- **Generated files** — test the generator, not the output
