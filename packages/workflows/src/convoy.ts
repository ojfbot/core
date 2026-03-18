/**
 * convoy — A8 adoption: multi-agent convoy coordination.
 *
 * `createConvoy(title, actor, store)` — creates a FrameConvoy bead.
 * `addToConvoy(convoyId, beadId, store, agentId?)` — adds a work slot.
 * `convoyProgress(convoyId, store)` — live progress snapshot.
 * `finalizeConvoy(convoyId, store)` — mark completed or failed based on slots.
 *
 * Gas Town mapping:
 *   gt convoy create <title>        →  createConvoy(title, actor, store)
 *   gt convoy add <convoy> <bead>   →  addToConvoy(convoyId, beadId, store)
 *   gt convoy status <convoy>       →  convoyProgress(convoyId, store)
 */

import crypto from 'crypto';
import type { BeadStore } from './types/bead.js';
import type {
  FrameConvoy,
  ConvoySlot,
  ConvoyStatus,
  ConvoyProgressReport,
} from './types/convoy.js';
import { isFrameConvoy } from './types/convoy.js';
import { eventBus, makeEvent } from './event-bus.js';

// ── Internal helpers ──────────────────────────────────────────────────────────

function convoyId(actorPrefix: string): string {
  return `${actorPrefix}-convoy-${crypto.randomBytes(4).toString('hex')}`;
}

function prefixOf(id: string): string {
  return id.split('-')[0];
}

function parseSlots(raw: string): ConvoySlot[] {
  try {
    return JSON.parse(raw) as ConvoySlot[];
  } catch {
    return [];
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Create a new convoy bead.
 *
 * @param title   Human-readable convoy name (e.g. "Blog Publish: AI Weekly #42")
 * @param actor   Agent or user creating the convoy
 * @param store   BeadStore instance
 * @returns       The created FrameConvoy bead
 */
export async function createConvoy(
  title: string,
  actor: string,
  store: BeadStore,
): Promise<FrameConvoy> {
  const now = new Date().toISOString();
  const convoy: FrameConvoy = {
    id: convoyId(prefixOf(actor)),
    type: 'convoy',
    status: 'live',
    title,
    body: '',
    labels: {
      convoy_status: 'forming',
      slots: '[]',
    },
    actor,
    refs: [],
    created_at: now,
    updated_at: now,
  };

  await store.create(convoy);
  eventBus.emit(makeEvent('convoy:created', actor,
    `convoy created: "${title}"`, { bead_id: convoy.id }));
  return convoy;
}

/**
 * Add a work bead (and optionally its assigned agent) to a convoy slot.
 *
 * The new slot starts in 'pending' status. Call updateSlotStatus() or
 * finalizeConvoy() to advance state.
 *
 * @throws if convoyId does not resolve to a FrameConvoy bead
 */
export async function addToConvoy(
  convoyBeadId: string,
  beadId: string,
  store: BeadStore,
  agentId?: string,
): Promise<void> {
  const raw = await store.get(convoyBeadId);
  if (raw === null) throw new Error(`addToConvoy: convoy not found: ${convoyBeadId}`);
  if (!isFrameConvoy(raw)) {
    throw new Error(`addToConvoy: bead ${convoyBeadId} is not a FrameConvoy (type: ${raw.type})`);
  }

  const slots = parseSlots(raw.labels.slots);
  if (slots.some((s) => s.beadId === beadId)) return; // idempotent

  const newSlot: ConvoySlot = {
    beadId,
    status: 'pending',
    ...(agentId ? { agentId } : {}),
  };
  slots.push(newSlot);

  await store.update(convoyBeadId, {
    labels: {
      ...raw.labels,
      convoy_status: 'active' as ConvoyStatus,
      slots: JSON.stringify(slots),
    },
  });

  eventBus.emit(makeEvent('convoy:updated', raw.actor,
    `convoy slot added: ${beadId} → ${convoyBeadId}`,
    { bead_id: convoyBeadId }));
}

/**
 * Update the status of a single slot within a convoy.
 * Called by executing agents as they progress through their work bead.
 */
export async function updateSlotStatus(
  convoyBeadId: string,
  beadId: string,
  slotStatus: ConvoySlot['status'],
  store: BeadStore,
): Promise<void> {
  const raw = await store.get(convoyBeadId);
  if (raw === null || !isFrameConvoy(raw)) return;

  const slots = parseSlots(raw.labels.slots);
  const slot = slots.find((s) => s.beadId === beadId);
  if (!slot) return;
  slot.status = slotStatus;

  await store.update(convoyBeadId, {
    labels: { ...raw.labels, slots: JSON.stringify(slots) },
  });

  eventBus.emit(makeEvent('convoy:updated', raw.actor,
    `convoy slot ${slotStatus}: ${beadId}`,
    { bead_id: convoyBeadId }));
}

/**
 * Derive a live progress snapshot for a convoy without mutating it.
 *
 * @throws if convoy bead not found or wrong type
 */
export async function convoyProgress(
  convoyBeadId: string,
  store: BeadStore,
): Promise<ConvoyProgressReport> {
  const raw = await store.get(convoyBeadId);
  if (raw === null) throw new Error(`convoyProgress: convoy not found: ${convoyBeadId}`);
  if (!isFrameConvoy(raw)) {
    throw new Error(`convoyProgress: bead ${convoyBeadId} is not a FrameConvoy`);
  }

  const slots = parseSlots(raw.labels.slots);
  const counts = { done: 0, active: 0, pending: 0, failed: 0 };
  for (const s of slots) {
    if (s.status === 'done') counts.done++;
    else if (s.status === 'active') counts.active++;
    else if (s.status === 'pending') counts.pending++;
    else if (s.status === 'failed') counts.failed++;
  }

  return {
    convoyId: convoyBeadId,
    title: raw.title,
    status: raw.labels.convoy_status,
    total: slots.length,
    ...counts,
    slots,
  };
}

/**
 * Finalize a convoy: set status to 'completed' if no slots failed,
 * 'failed' if any slot failed.
 *
 * Call this after all expected slots have reported done/failed.
 */
export async function finalizeConvoy(
  convoyBeadId: string,
  store: BeadStore,
): Promise<ConvoyStatus> {
  const raw = await store.get(convoyBeadId);
  if (raw === null) throw new Error(`finalizeConvoy: convoy not found: ${convoyBeadId}`);
  if (!isFrameConvoy(raw)) {
    throw new Error(`finalizeConvoy: bead ${convoyBeadId} is not a FrameConvoy`);
  }

  const slots = parseSlots(raw.labels.slots);
  const hasFailed = slots.some((s) => s.status === 'failed');
  const allSettled = slots.every((s) => s.status === 'done' || s.status === 'failed');

  const finalStatus: ConvoyStatus = hasFailed ? 'failed' : allSettled ? 'completed' : 'active';

  await store.update(convoyBeadId, {
    labels: { ...raw.labels, convoy_status: finalStatus },
    ...(finalStatus !== 'active' ? { status: 'closed' as const } : {}),
  });

  eventBus.emit(makeEvent('convoy:updated', raw.actor,
    `convoy ${finalStatus}: "${raw.title}"`,
    { bead_id: convoyBeadId }));

  return finalStatus;
}
