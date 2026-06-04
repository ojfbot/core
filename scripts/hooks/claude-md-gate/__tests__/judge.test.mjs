/**
 * judge.mjs tests — ADR-0081 Slice 2, checkpoint C2.
 * Covers the deterministic plumbing: prompt construction, tolerant verdict parsing, the injected
 * caller, and SAFE-DEGRADE (no key / error → null → gate never blocks). The real-model accuracy
 * run against a labeled fixture set requires ANTHROPIC_API_KEY and is a manual C2 check (SPEC.md).
 *
 * Run: pnpm vitest run scripts/hooks/claude-md-gate/__tests__/judge.test.mjs
 */
import { describe, it, expect } from 'vitest';
import { buildPrompt, parseVerdict, judgeBlock } from '../judge.mjs';

describe('buildPrompt', () => {
  it('includes the file path and the added block', () => {
    const { system, user } = buildPrompt({ filePath: '/r/CLAUDE.md', addedContent: 'DEAKINS_USER_AGENT scraper config' });
    expect(system).toMatch(/loading-discipline/);
    expect(user).toContain('/r/CLAUDE.md');
    expect(user).toContain('DEAKINS_USER_AGENT');
  });
});

describe('parseVerdict', () => {
  it('parses a clean JSON verdict', () => {
    const v = parseVerdict('{"isConditional": true, "suggestedLayer": "L1", "confidence": 0.8, "reasoning": "subtree-only"}');
    expect(v).toEqual({ isConditional: true, suggestedLayer: 'L1', confidence: 0.8, reasoning: 'subtree-only' });
  });
  it('tolerates a code fence and stray prose', () => {
    const v = parseVerdict('Here:\n```json\n{"isConditional": false, "suggestedLayer": "L0", "confidence": 0.9}\n```\n');
    expect(v.isConditional).toBe(false);
    expect(v.suggestedLayer).toBe('L0');
  });
  it('defaults suggestedLayer from isConditional when missing/invalid', () => {
    expect(parseVerdict('{"isConditional": true}').suggestedLayer).toBe('L1');
    expect(parseVerdict('{"isConditional": false}').suggestedLayer).toBe('L0');
  });
  it('clamps confidence to [0,1]', () => {
    expect(parseVerdict('{"isConditional": true, "confidence": 5}').confidence).toBe(1);
    expect(parseVerdict('{"isConditional": true, "confidence": -2}').confidence).toBe(0);
  });
  it('returns null on no JSON / bad JSON / missing isConditional', () => {
    expect(parseVerdict('no json here')).toBe(null);
    expect(parseVerdict('{bad json}')).toBe(null);
    expect(parseVerdict('{"suggestedLayer":"L1"}')).toBe(null);
    expect(parseVerdict('')).toBe(null);
  });
});

describe('judgeBlock', () => {
  it('returns the parsed verdict from an injected caller', async () => {
    const complete = async () => '{"isConditional": true, "suggestedLayer": "L2", "confidence": 0.7, "reasoning": "deep reference"}';
    const v = await judgeBlock({ filePath: '/r/CLAUDE.md', addedContent: 'big schema dump', complete });
    expect(v.isConditional).toBe(true);
    expect(v.suggestedLayer).toBe('L2');
  });
  it('SAFE-DEGRADE: returns null when the caller throws (no key / API error)', async () => {
    const complete = async () => { throw new Error('no ANTHROPIC_API_KEY'); };
    expect(await judgeBlock({ filePath: '/r/CLAUDE.md', addedContent: 'x', complete })).toBe(null);
  });
  it('SAFE-DEGRADE: returns null when the model output is unparseable', async () => {
    const complete = async () => 'I cannot help with that';
    expect(await judgeBlock({ filePath: '/r/CLAUDE.md', addedContent: 'x', complete })).toBe(null);
  });
});
