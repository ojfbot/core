/**
 * skill:acted stub tests — the SECOND event type on the SAME spine.
 *
 * Proves the primitive is type-general: OPAV-S1's `skill:acted` flows through the
 * very same EventLedger + eventEmit + honesty contract as gate-event, with its
 * correlation_id = the S0 SUGGESTION_ID. S1 adds a TYPE, not a system. The projector
 * and the independent Stop-hook detector are deferred to the S0/S1 PR.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { EventLedger } from '../tracking/ledger.js';
import { eventEmit } from '../tracking/emit.js';
import { buildSkillActed, lintSkillActed } from '../tracking/skill-acted.js';

let tmpDir: string;
beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tracking-acted-test-'));
});
afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('skill:acted on the shared spine', () => {
  it('lands in the same ledger via the same emit path, keyed on the SUGGESTION_ID', async () => {
    const ledger = new EventLedger('opav-loop', tmpDir);
    await eventEmit(
      ledger,
      buildSkillActed({ suggestionId: 'SUG-abc123', skill: 'tdd', evidence: { scheme: 'tpm', ref: 'TPM-1' } }),
    );
    const events = await ledger.read();
    expect(events).toHaveLength(1);
    expect(events[0].event_type).toBe('skill:acted');
    expect(events[0].correlation_id).toBe('SUG-abc123'); // == S0 SUGGESTION_ID
  });

  it('reuses the one honesty contract — an acted event with no evidence is rejected', async () => {
    const ledger = new EventLedger('opav-loop', tmpDir);
    await expect(
      eventEmit(ledger, buildSkillActed({ suggestionId: 'SUG-x', skill: 'tdd' })),
    ).rejects.toThrow(/evidence/i);
    expect(await ledger.read()).toHaveLength(0);
  });

  it('coexists with gate-events in the same ledger file', async () => {
    const ledger = new EventLedger('opav-loop', tmpDir);
    await eventEmit(ledger, buildSkillActed({ suggestionId: 'SUG-1', skill: 'validate', evidence: { scheme: 'pr', ref: '9' } }));
    const events = await ledger.read();
    expect(events.map((e) => e.event_type)).toContain('skill:acted');
  });
});

describe('C0 — skill:acted schema', () => {
  it('carries mode and expected_artifact in the payload', () => {
    const ev = buildSkillActed({
      suggestionId: 'SUG-c0',
      skill: 'adr',
      mode: 'shadow',
      expectedArtifact: 'decisions/adr/NNNN-*.md',
      evidence: { scheme: 'path', ref: '/tmp/x' },
    });
    expect(ev.payload).toMatchObject({
      skill: 'adr',
      mode: 'shadow',
      expected_artifact: 'decisions/adr/NNNN-*.md',
    });
  });

  const wellFormed = () =>
    buildSkillActed({
      suggestionId: 'SUG-ok',
      skill: 'adr',
      mode: 'active',
      expectedArtifact: 'decisions/adr/NNNN-*.md',
      evidence: { scheme: 'path', ref: '/tmp/x' },
    });

  it('lintSkillActed accepts a well-formed event', () => {
    const lint = lintSkillActed(wellFormed());
    expect(lint.valid).toBe(true);
    expect(lint.errors).toEqual([]);
  });

  it('rejects a missing or empty correlation_id (the SUGGESTION_ID join key)', () => {
    const ev = { ...wellFormed(), correlation_id: '' };
    const lint = lintSkillActed(ev);
    expect(lint.valid).toBe(false);
    expect(lint.errors.join(' ')).toMatch(/correlation_id/);
  });

  it('rejects a missing op_id (idempotency key)', () => {
    const ev = { ...wellFormed(), op_id: '' };
    expect(lintSkillActed(ev).errors.join(' ')).toMatch(/op_id/);
  });

  it('rejects an unknown mode', () => {
    const ev = wellFormed();
    const bad = { ...ev, payload: { ...ev.payload, mode: 'live' } };
    expect(lintSkillActed(bad).errors.join(' ')).toMatch(/mode/);
  });

  it('rejects a missing expected_artifact', () => {
    const ev = wellFormed();
    const bad = { ...ev, payload: { ...ev.payload, expected_artifact: undefined } };
    expect(lintSkillActed(bad).errors.join(' ')).toMatch(/expected_artifact/);
  });

  it('rejects a wrong event_type / to_state', () => {
    expect(lintSkillActed({ ...wellFormed(), event_type: 'gate-event' }).valid).toBe(false);
    expect(lintSkillActed({ ...wellFormed(), to_state: 'passed' }).valid).toBe(false);
  });

  it('lints a 20-event well-formed fixture 20/20 (C0 TPM)', () => {
    const fixture = Array.from({ length: 20 }, (_, i) =>
      buildSkillActed({
        suggestionId: `SUG-${i}`,
        skill: i % 2 ? 'tdd' : 'validate',
        mode: i % 3 ? 'shadow' : 'active',
        expectedArtifact: 'some/artifact.md',
        evidence: { scheme: 'tpm', ref: `TPM-${i}` },
      }),
    );
    const passing = fixture.filter((ev) => lintSkillActed(ev).valid).length;
    expect(passing).toBe(20);
  });
});
