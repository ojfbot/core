/**
 * FrameMail types — A5 adoption.
 *
 * Inter-agent communication built on FrameBead (type: 'mail').
 * Handoff mail is the primary crash-recovery mechanism: when an agent's
 * context fills up or the browser closes, it writes a handoff mail to its
 * own mailbox. On next session, the prime node reads it and resumes.
 *
 * Gas Town mapping:
 *   gt handoff <agent>   → handoff(agentId, summary, store)
 *   gt seance            → getUnreadMail(agentId, store)  (read predecessor context)
 *
 * Delivery modes:
 *   direct    — to a specific agent ID  (labels.to = agentId)
 *   queued    — first-come-first-served from a shared pool (labels.to = queue name)
 *   broadcast — all agents on a channel (labels.to = channel name)
 */

import type { FrameBead } from './bead.js';

export type MailType = 'direct' | 'queued' | 'broadcast' | 'handoff';
export type DeliveryMode = 'direct' | 'queued' | 'broadcast';

/**
 * FrameMail extends FrameBead (type: 'mail') with routing labels.
 *
 * Reserved labels:
 *   from          — agent ID of the sender
 *   to            — agent ID (or queue/channel name) of the recipient
 *   delivery      — DeliveryMode
 *   mail_type     — MailType
 *   read          — 'true' once the recipient has processed this mail
 *   thread_id?    — links replies to an originating mail bead ID
 */
export interface FrameMail extends FrameBead {
  type: 'mail';
  labels: FrameBead['labels'] & {
    from: string;
    to: string;
    delivery: DeliveryMode;
    mail_type: MailType;
    read: 'true' | 'false';
    thread_id?: string;
  };
}

/** Type guard */
export function isFrameMail(bead: FrameBead): bead is FrameMail {
  return (
    bead.type === 'mail' &&
    typeof bead.labels['from'] === 'string' &&
    typeof bead.labels['to'] === 'string'
  );
}
