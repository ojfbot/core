/**
 * eventBus — A7 adoption: singleton FrameEvent bus.
 *
 * All BeadStore mutations, hook assignments, mail delivery, and agent state
 * changes emit a FrameEvent through this bus. Subscribers receive events
 * synchronously in emission order.
 *
 * Usage:
 *
 *   // Subscribe
 *   const unsub = eventBus.on((event) => console.log(event.summary));
 *
 *   // Subscribe to specific type
 *   const unsub = eventBus.onType('bead:created', (event) => { ... });
 *
 *   // Unsubscribe
 *   unsub();
 *
 * CoreReader wires this to an SSE stream:
 *   eventBus.on((event) => sseClients.forEach(c => c.send(JSON.stringify(event))));
 *
 * Shell wires this to the Redux unread badge:
 *   eventBus.on((event) => store.dispatch(incrementUnread(event)));
 */

import crypto from 'crypto';
import type { FrameEvent, FrameEventType } from './types/event.js';

export type EventHandler = (event: FrameEvent) => void;

export class FrameEventBus {
  private readonly handlers = new Set<EventHandler>();

  /**
   * Emit an event to all subscribers.
   * Handlers are called synchronously in insertion order.
   * A handler that throws does not prevent other handlers from running.
   */
  emit(event: FrameEvent): void {
    for (const handler of this.handlers) {
      try {
        handler(event);
      } catch (err) {
        console.error(`[EventBus] subscriber threw on ${event.type}:`, err);
      }
    }
  }

  /**
   * Subscribe to all events.
   * @returns Unsubscribe function
   */
  on(handler: EventHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  /**
   * Subscribe to a specific event type.
   * @returns Unsubscribe function
   */
  onType(type: FrameEventType, handler: EventHandler): () => void {
    const filtered: EventHandler = (event) => {
      if (event.type === type) handler(event);
    };
    this.handlers.add(filtered);
    return () => this.handlers.delete(filtered);
  }

  /** Number of active subscribers — useful for testing and diagnostics */
  get subscriberCount(): number {
    return this.handlers.size;
  }
}

/** Singleton event bus — import and use directly. */
export const eventBus = new FrameEventBus();

// ── Factory helper ────────────────────────────────────────────────────────────

/** Extract app identifier from a bead/agent ID prefix. */
function appFromId(id: string): string {
  const prefix = id.split('-')[0];
  const map: Record<string, string> = {
    core: 'core', cv: 'cv-builder', blog: 'blogengine',
    trip: 'tripplanner', pure: 'purefoy', hq: 'shell',
  };
  return map[prefix] ?? prefix;
}

/**
 * Build a FrameEvent. Generates a unique ID and timestamp.
 * The `id` is prefixed with the app derived from `bead_id` or `agent_id`.
 */
export function makeEvent(
  type: FrameEventType,
  actor: string,
  summary: string,
  options: {
    bead_id?: string;
    agent_id?: string;
    app?: string;
    payload?: Record<string, unknown>;
  } = {},
): FrameEvent {
  const refId = options.bead_id ?? options.agent_id ?? actor;
  const app = options.app ?? appFromId(refId);
  const prefix = refId.split('-')[0];
  return {
    id: `${prefix}-evt-${crypto.randomBytes(4).toString('hex')}`,
    timestamp: new Date().toISOString(),
    type,
    actor,
    app,
    summary,
    ...(options.bead_id ? { bead_id: options.bead_id } : {}),
    ...(options.agent_id ? { agent_id: options.agent_id } : {}),
    ...(options.payload ? { payload: options.payload } : {}),
  };
}
