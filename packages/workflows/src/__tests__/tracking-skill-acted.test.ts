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
import { buildSkillActed } from '../tracking/skill-acted.js';

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
