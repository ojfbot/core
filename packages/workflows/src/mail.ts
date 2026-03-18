/**
 * mail — A5 adoption: FrameMail send, receive, and handoff.
 *
 * Primary use cases:
 *   1. Handoff: agent writes context summary before session end
 *      → prime node picks it up on next session (GUPP #3)
 *   2. Direct mail: agent-to-agent task delegation
 *   3. Broadcast: Mayor broadcasting work to all rig witnesses
 *
 * Gas Town mapping:
 *   gt handoff <agent>   →  handoff(agentId, summary, store)
 *   gt seance            →  getUnreadMail(agentId, store)
 */

import crypto from 'crypto';
import type { BeadStore } from './types/bead.js';
import type { FrameMail, MailType, DeliveryMode } from './types/mail.js';
import { isAgentBead } from './types/agent-bead.js';
import type { AgentStatus } from './types/agent-bead.js';
import { eventBus, makeEvent } from './event-bus.js';

// ── Internal ──────────────────────────────────────────────────────────────────

function mailId(recipientPrefix: string): string {
  return `${recipientPrefix}-mail-${crypto.randomBytes(4).toString('hex')}`;
}

/** Extract prefix from an agent or bead ID (segment before first '-'). */
function prefixOf(id: string): string {
  return id.split('-')[0];
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Send a mail bead from one agent to another.
 *
 * The mail bead is stored under the recipient's rig prefix so the BeadStore
 * routes it to the correct directory.
 *
 * @returns The created FrameMail bead
 */
export async function sendMail(
  from: string,
  to: string,
  subject: string,
  body: string,
  store: BeadStore,
  options: {
    mailType?: MailType;
    delivery?: DeliveryMode;
    threadId?: string;
  } = {},
): Promise<FrameMail> {
  const now = new Date().toISOString();
  const mail: FrameMail = {
    id: mailId(prefixOf(to)),
    type: 'mail',
    status: 'live',
    title: subject,
    body,
    labels: {
      from,
      to,
      delivery: options.delivery ?? 'direct',
      mail_type: options.mailType ?? 'direct',
      read: 'false',
      ...(options.threadId ? { thread_id: options.threadId } : {}),
    },
    actor: from,
    refs: [],
    created_at: now,
    updated_at: now,
  };

  await store.create(mail);
  eventBus.emit(makeEvent('mail:sent', from,
    `mail sent: ${from} → ${to}: "${subject}"`, { bead_id: mail.id }));
  return mail;
}

/**
 * Mark a mail bead as read.
 * Call this after the recipient agent has processed the mail in its prime node.
 *
 * @returns The updated FrameMail bead
 */
export async function readMail(mailBeadId: string, store: BeadStore): Promise<void> {
  const bead = await store.get(mailBeadId);
  if (bead === null) throw new Error(`readMail: bead not found: ${mailBeadId}`);
  await store.update(mailBeadId, {
    labels: { ...bead.labels, read: 'true' },
  });
  eventBus.emit(makeEvent('mail:read', bead.labels['to'] ?? 'unknown',
    `mail read: ${mailBeadId}`, { bead_id: mailBeadId }));
}

/**
 * Retrieve all unread mail addressed to an agent.
 * Sorted oldest-first so the agent processes mail in arrival order.
 */
export async function getUnreadMail(
  agentId: string,
  store: BeadStore,
): Promise<FrameMail[]> {
  const all = await store.query({ type: 'mail', prefix: prefixOf(agentId) });
  return (all as FrameMail[])
    .filter(
      (b) =>
        b.labels['to'] === agentId &&
        b.labels['read'] !== 'true' &&
        b.status !== 'closed' &&
        b.status !== 'archived',
    )
    .sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
}

/**
 * Count unread mail for an agent — used by the prime node (GUPP step 3).
 */
export async function countUnreadMail(
  agentId: string,
  store: BeadStore,
): Promise<number> {
  const unread = await getUnreadMail(agentId, store);
  return unread.length;
}

/**
 * Write a handoff mail and mark the agent as suspended.
 *
 * Call this when the agent's context limit is approaching or the session is
 * ending deliberately. On the next session, the prime node reads the handoff
 * mail and uses it as opening context (GUPP step 3 → process_mail).
 *
 * Gas Town equivalent: `gt handoff <agent>`
 *
 * @param agentId  The agent handing off (sender and recipient — self-mail)
 * @param summary  Markdown summary of current work state, open tasks, context
 * @param store    BeadStore instance
 * @returns        The handoff FrameMail bead
 */
export async function handoff(
  agentId: string,
  summary: string,
  store: BeadStore,
): Promise<FrameMail> {
  // Validate agent exists
  const agentBead = await store.get(agentId);
  if (agentBead === null) throw new Error(`handoff: agent bead not found: ${agentId}`);
  if (!isAgentBead(agentBead)) {
    throw new Error(`handoff: bead ${agentId} is not an AgentBead`);
  }

  // Write handoff mail to own mailbox (self-addressed)
  const mail = await sendMail(
    agentId,
    agentId,
    `Handoff: ${agentBead.title}`,
    summary,
    store,
    { mailType: 'handoff', delivery: 'direct' },
  );

  // Suspend the agent — it will resume on next session via prime node
  await store.update(agentId, {
    labels: {
      ...agentBead.labels,
      agent_status: 'suspended' as AgentStatus,
      last_session: new Date().toISOString(),
    },
  });

  eventBus.emit(makeEvent('agent:handoff', agentId,
    `agent handoff: ${agentId}`, { agent_id: agentId }));
  return mail;
}
