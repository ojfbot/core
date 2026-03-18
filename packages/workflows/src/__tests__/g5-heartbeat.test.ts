/**
 * G5 — Heartbeat event tests
 *
 * Verifies startHeartbeat() emits agent:heartbeat events on the eventBus
 * at the specified interval and that the stop function halts emissions.
 *
 * Uses vitest fake timers so tests run without real wall-clock delay.
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { eventBus } from '../event-bus.js';
import { startHeartbeat } from '../agent-lifecycle.js';
import type { FrameEvent } from '../types/event.js';

describe('G5: heartbeat', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('emits heartbeat events on the event bus', () => {
    const received: FrameEvent[] = [];
    const unsub = eventBus.on(e => {
      if (e.type === 'agent:heartbeat') received.push(e);
    });

    const stop = startHeartbeat('core-agent-witness', 100);
    vi.advanceTimersByTime(350); // 3 full intervals
    stop();
    unsub();

    expect(received.length).toBe(3);
    expect(received[0].type).toBe('agent:heartbeat');
    expect(received[0].agent_id).toBe('core-agent-witness');
  });

  it('stop function prevents further emissions', () => {
    const received: FrameEvent[] = [];
    const unsub = eventBus.on(e => {
      if (e.type === 'agent:heartbeat') received.push(e);
    });

    const stop = startHeartbeat('core-agent-witness', 100);
    vi.advanceTimersByTime(150); // 1 full interval
    stop();
    vi.advanceTimersByTime(300); // would be 3 more if not stopped
    unsub();

    expect(received.length).toBe(1);
  });
});
