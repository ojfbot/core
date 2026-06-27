import { describe, it, expect } from 'vitest';
import { buildReadModelSchema } from '../index.js';
import { GraphQLObjectType } from 'graphql';

/**
 * Coverage + seam guards. The read surface and its forward-declared evolution points (F2 repo-scoped
 * briefing, L1 tile links, L3 popover) are load-bearing for the dependent slices — dropping one here
 * silently breaks F2/L1/L3 downstream, so they are asserted, not assumed.
 */
describe('read-model contract — surface coverage', () => {
  const schema = buildReadModelSchema();

  it('declares the UX-surface types', () => {
    for (const t of [
      'RepoCard', 'RepoLink', 'RepoPopover', 'Liveness', 'AgentLivenessState',
      'AgentLiveness', 'BriefingSnapshot', 'BriefingThread', 'BriefingBranch',
      'BriefingArtifact', 'WorkItem',
    ]) {
      expect(schema.getType(t), `type ${t} present`).toBeDefined();
    }
  });

  it('exposes the read surface as Query fields', () => {
    const q = schema.getQueryType()!;
    expect(Object.keys(q.getFields()).sort()).toEqual(
      ['agentLiveness', 'briefing', 'fleet', 'workItems'],
    );
  });

  it('keeps the F2 seam: briefing(repo:) argument exists', () => {
    const briefing = schema.getQueryType()!.getFields().briefing;
    expect(briefing.args.map((a) => a.name)).toContain('repo');
  });

  it('keeps the L1/L3 seams: RepoCard.links and RepoCard.popover exist', () => {
    const repoCard = schema.getType('RepoCard') as GraphQLObjectType;
    const fields = repoCard.getFields();
    expect(fields.links, 'RepoCard.links (L1)').toBeDefined();
    expect(fields.popover, 'RepoCard.popover (L3)').toBeDefined();
  });

  it('keeps the F2 seam: BriefingSnapshot.repo exists', () => {
    const snap = schema.getType('BriefingSnapshot') as GraphQLObjectType;
    expect(snap.getFields().repo, 'BriefingSnapshot.repo (F2)').toBeDefined();
  });
});
