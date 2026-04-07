# Test Patterns

## Vitest Setup

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'
export default defineConfig({
  test: {
    globals: true,
    environment: 'node', // or 'jsdom' for browser code
  },
})
```

## Testing Zod Schemas

```typescript
import { Bio } from '../models/bio'

describe('Bio schema', () => {
  it('parses valid input', () => {
    const result = Bio.safeParse(validBio)
    expect(result.success).toBe(true)
  })

  it('rejects missing required fields', () => {
    const result = Bio.safeParse({})
    expect(result.success).toBe(false)
    expect(result.error.issues).toContainEqual(
      expect.objectContaining({ path: ['personal'] })
    )
  })
})
```

## Testing Express Routes (supertest)

```typescript
import request from 'supertest'
import { app } from '../app'

describe('GET /api/beads', () => {
  it('returns bead array', async () => {
    const res = await request(app).get('/api/beads')
    expect(res.status).toBe(200)
    expect(res.body).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'job-listing' })
    ]))
  })
})
```

## Snapshot Testing Agent Prompts

```typescript
describe('JobAnalysisAgent', () => {
  it('system prompt is stable', () => {
    const agent = new JobAnalysisAgent()
    expect(agent.getSystemPrompt()).toMatchSnapshot()
  })
})
```

## Mocking Anthropic SDK

```typescript
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'mocked response' }],
      }),
    },
  })),
}))
```

## Testing Redux Slices

```typescript
import reducer, { addJob } from '../store/jobSlice'

describe('jobSlice', () => {
  it('adds a job', () => {
    const state = reducer(undefined, addJob(mockJob))
    expect(state.jobs).toHaveLength(1)
  })
})
```
