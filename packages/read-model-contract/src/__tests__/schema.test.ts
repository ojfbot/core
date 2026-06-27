import { describe, it, expect } from 'vitest';
import { buildReadModelSchema } from '../index.js';

describe('read-model contract SDL', () => {
  it('builds into a valid GraphQL schema with a Query type', () => {
    const schema = buildReadModelSchema();
    expect(schema.getQueryType()).toBeDefined();
    expect(schema.getQueryType()?.name).toBe('Query');
  });

  it('is query-only — declares no Mutation type (ADR-0011 #4 / ADR-0013 #5)', () => {
    const schema = buildReadModelSchema();
    expect(schema.getMutationType()).toBeUndefined();
    expect(schema.getSubscriptionType()).toBeUndefined();
  });
});
