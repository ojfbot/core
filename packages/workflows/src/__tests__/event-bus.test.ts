import { describe, it, expect, vi } from 'vitest';
import { FrameEventBus, eventBus, makeEvent } from '../event-bus.js';
import type { FrameEvent } from '../types/event.js';

// ── FrameEventBus unit tests ──────────────────────────────────────────────────

describe('FrameEventBus', () => {
  it('delivers events to all subscribers', () => {
    const bus = new FrameEventBus();
    const received: FrameEvent[] = [];
    bus.on((e) => received.push(e));

    const evt = makeEvent('bead:created', 'core-agent', 'created something', { bead_id: 'core-abc' });
    bus.emit(evt);

    expect(received).toHaveLength(1);
    expect(received[0].type).toBe('bead:created');
  });

  it('delivers to multiple subscribers', () => {
    const bus = new FrameEventBus();
    const a: string[] = [];
    const b: string[] = [];
    bus.on((e) => a.push(e.type));
    bus.on((e) => b.push(e.type));

    bus.emit(makeEvent('bead:updated', 'actor', 'updated'));
    expect(a).toEqual(['bead:updated']);
    expect(b).toEqual(['bead:updated']);
  });

  it('unsubscribe stops delivery', () => {
    const bus = new FrameEventBus();
    const received: FrameEvent[] = [];
    const unsub = bus.on((e) => received.push(e));

    bus.emit(makeEvent('bead:closed', 'actor', 'closed'));
    unsub();
    bus.emit(makeEvent('bead:closed', 'actor', 'closed again'));

    expect(received).toHaveLength(1);
  });

  it('onType only fires for matching type', () => {
    const bus = new FrameEventBus();
    const received: FrameEvent[] = [];
    bus.onType('mail:sent', (e) => received.push(e));

    bus.emit(makeEvent('bead:created', 'actor', 'noise'));
    bus.emit(makeEvent('mail:sent', 'actor', 'mail', { bead_id: 'cv-mail-1' }));
    bus.emit(makeEvent('bead:updated', 'actor', 'noise'));

    expect(received).toHaveLength(1);
    expect(received[0].type).toBe('mail:sent');
  });

  it('onType unsubscribe stops delivery', () => {
    const bus = new FrameEventBus();
    const received: FrameEvent[] = [];
    const unsub = bus.onType('hook:assigned', (e) => received.push(e));

    bus.emit(makeEvent('hook:assigned', 'actor', 'first'));
    unsub();
    bus.emit(makeEvent('hook:assigned', 'actor', 'second'));

    expect(received).toHaveLength(1);
  });

  it('subscriberCount reflects active subscriptions', () => {
    const bus = new FrameEventBus();
    expect(bus.subscriberCount).toBe(0);
    const unsub1 = bus.on(() => {});
    const unsub2 = bus.on(() => {});
    expect(bus.subscriberCount).toBe(2);
    unsub1();
    expect(bus.subscriberCount).toBe(1);
    unsub2();
    expect(bus.subscriberCount).toBe(0);
  });

  it('a throwing subscriber does not stop other subscribers', () => {
    const bus = new FrameEventBus();
    const good: string[] = [];
    bus.on(() => { throw new Error('boom'); });
    bus.on((e) => good.push(e.summary));

    expect(() =>
      bus.emit(makeEvent('bead:created', 'actor', 'test'))
    ).not.toThrow();
    expect(good).toEqual(['test']);
  });
});

// ── makeEvent factory ─────────────────────────────────────────────────────────

describe('makeEvent', () => {
  it('generates a unique ID with correct prefix', () => {
    const evt = makeEvent('bead:created', 'cv-agent', 'created', { bead_id: 'cv-abc-1234' });
    expect(evt.id).toMatch(/^cv-evt-[0-9a-f]{8}$/);
    expect(evt.type).toBe('bead:created');
    expect(evt.actor).toBe('cv-agent');
  });

  it('derives app from bead_id prefix', () => {
    const evt = makeEvent('bead:updated', 'core', 'updated', { bead_id: 'cv-task-1' });
    expect(evt.app).toBe('cv-builder');
  });

  it('derives app from agent_id prefix when no bead_id', () => {
    const evt = makeEvent('agent:idle', 'blog-agent-1', 'idle', { agent_id: 'blog-agent-1' });
    expect(evt.app).toBe('blogengine');
  });

  it('uses explicit app override', () => {
    const evt = makeEvent('bead:created', 'actor', 'created', { app: 'custom-app' });
    expect(evt.app).toBe('custom-app');
  });

  it('includes bead_id and agent_id when provided', () => {
    const evt = makeEvent('hook:assigned', 'actor', 'hook', {
      bead_id: 'core-task-1',
      agent_id: 'core-agent-1',
    });
    expect(evt.bead_id).toBe('core-task-1');
    expect(evt.agent_id).toBe('core-agent-1');
  });

  it('omits bead_id/agent_id when not provided', () => {
    const evt = makeEvent('bead:archived', 'actor', 'archived');
    expect('bead_id' in evt).toBe(false);
    expect('agent_id' in evt).toBe(false);
  });

  it('includes payload when provided', () => {
    const evt = makeEvent('molecule:completed', 'actor', 'done', {
      payload: { steps_completed: 5 },
    });
    expect(evt.payload?.steps_completed).toBe(5);
  });

  it('generates unique IDs across successive calls', () => {
    const ids = new Set(
      Array.from({ length: 20 }, () =>
        makeEvent('bead:created', 'actor', 'x').id
      )
    );
    expect(ids.size).toBe(20);
  });
});

// ── Singleton export ──────────────────────────────────────────────────────────

describe('singleton eventBus', () => {
  it('is the same instance across imports', async () => {
    const { eventBus: importedAgain } = await import('../event-bus.js');
    expect(importedAgain).toBe(eventBus);
  });
});
