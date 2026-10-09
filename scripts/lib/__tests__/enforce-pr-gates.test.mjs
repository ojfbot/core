import { describe, it, expect } from 'vitest';
import { enforceRepo, hasPrGate, policyBody, POLICY_NAME } from '../../enforce-pr-gates.mjs';

const repo = { name: 'example', defaultBranchRef: { name: 'main' } };
const rules = ['pull_request', 'deletion', 'non_fast_forward'].map(type => ({ type, ruleset_id: 42 }));
const source = { id: 42, enforcement: 'active', bypass_actors: [] };

describe('effective default-branch PR gates', () => {
  it('accepts a complete active gate without actors', () => {
    expect(hasPrGate(rules, [source])).toBe(true);
  });
  it('rejects admin, app and PR-only bypasses', () => {
    for (const actor of [{ actor_type: 'RepositoryRole', actor_id: 5, bypass_mode: 'always' }, { actor_type: 'Integration', actor_id: 123, bypass_mode: 'pull_request' }]) {
      expect(hasPrGate(rules, [{ ...source, bypass_actors: [actor] }])).toBe(false);
    }
  });
  it('does not mistake another branch, missing bypass data or evaluate mode for protection', () => {
    expect(hasPrGate([], [source])).toBe(false);
    expect(hasPrGate(rules, [{ ...source, bypass_actors: undefined }])).toBe(false);
    expect(hasPrGate(rules, [{ ...source, enforcement: 'evaluate' }])).toBe(false);
  });
  it('requires deletion and force-push protections too', () => {
    expect(hasPrGate(rules.slice(0, 1), [source])).toBe(false);
  });
  it('does not write in audit mode or to already-protected repositories', () => {
    const write = () => { throw new Error('unexpected write'); };
    expect(enforceRepo('owner', repo, false, () => ({ protected: false }), write)).toEqual({ status: 'needs-policy', changed: false });
    expect(enforceRepo('owner', repo, true, () => ({ protected: true }), write)).toEqual({ status: 'protected', changed: false });
  });
  it('creates one gate and verifies server readback', () => {
    const calls = [];
    let protectedNow = false;
    const inspect = () => ({ protected: protectedNow });
    const write = (args, body) => {
      calls.push({ args, body });
      if (!body) return [];
      protectedNow = true;
      return { id: 42 };
    };
    expect(enforceRepo('owner', repo, true, inspect, write)).toEqual({ status: 'protected', changed: true });
    expect(calls[1].args).toEqual(['api', 'repos/owner/example/rulesets', '--method', 'POST', '--input', '-']);
    expect(calls[1].body).toEqual(policyBody());
    expect(enforceRepo('owner', repo, true, inspect, write).changed).toBe(false);
    expect(calls).toHaveLength(2);
  });
  it('repairs an inactive owned policy without touching unrelated rules', () => {
    const calls = [];
    let count = 0;
    const inspect = () => ({ protected: count++ > 0 });
    const write = (args, body) => {
      calls.push(args);
      if (args[1] === 'repos/owner/example/rulesets/9' && !body) return { rules: [], conditions: { ref_name: { include: ['~DEFAULT_BRANCH'], exclude: [] } } };
      return body ? {} : [{ id: 9, name: POLICY_NAME, target: 'branch' }, { id: 10, name: 'Other', target: 'branch' }];
    };
    expect(enforceRepo('owner', repo, true, inspect, write).changed).toBe(true);
    expect(calls[2]).toContain('repos/owner/example/rulesets/9');
    expect(calls[2]).toContain('PUT');
  });
  it('preserves stricter reviews and status checks when repairing a policy', () => {
    const review = { type: 'pull_request', parameters: { required_approving_review_count: 2, require_code_owner_review: true } };
    const checks = { type: 'required_status_checks', parameters: { required_status_checks: [{ context: 'test', integration_id: 15368 }], strict_required_status_checks_policy: true } };
    const repaired = policyBody({ rules: [review, checks], conditions: { ref_name: { include: ['~DEFAULT_BRANCH'], exclude: [] } } });
    expect(repaired.rules).toEqual([review, checks, { type: 'deletion' }, { type: 'non_fast_forward' }]);
    expect(repaired.conditions.ref_name).toEqual({ include: ['~DEFAULT_BRANCH'], exclude: [] });
    expect(repaired.bypass_actors).toEqual([]);
    expect(repaired.enforcement).toBe('active');
  });
  it('refuses to broaden an existing policy beyond its default-branch scope', () => {
    expect(() => policyBody({ rules: [], conditions: { ref_name: { include: ['~ALL'], exclude: ['refs/heads/experiment/*'] } } })).toThrow('unexpected branch scope');
  });
  it('refuses success when readback fails or policy names collide', () => {
    expect(() => enforceRepo('owner', repo, true, () => ({ protected: false }), (_args, body) => body ? {} : [])).toThrow('effective no-bypass gate');
    expect(() => enforceRepo('owner', repo, true, () => ({ protected: false }), () => [{ id: 1, name: POLICY_NAME, target: 'branch' }, { id: 2, name: POLICY_NAME, target: 'branch' }])).toThrow('Duplicate policy');
  });
});
