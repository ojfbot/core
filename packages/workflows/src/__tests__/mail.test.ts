/**
 * A5 adoption tests — FrameMail, handoff, prime node mail routing
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { FilesystemBeadStore } from '../bead-store/FilesystemBeadStore.js';
import { initAgent, closeAgent } from '../agent-lifecycle.js';
import { sendMail, readMail, getUnreadMail, countUnreadMail, handoff } from '../mail.js';
import { runPrimeNode } from '../prime-node.js';
import { isFrameMail } from '../types/mail.js';

let tmpDir: string;
let store: FilesystemBeadStore;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mail-test-'));
  store = new FilesystemBeadStore(tmpDir);
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

// ── sendMail ─────────────────────────────────────────────────────────────────

describe('sendMail', () => {
  it('creates a FrameMail bead in the store', async () => {
    const mail = await sendMail('hq-agent-mayor', 'cv-agent-witness', 'Task ready', 'Do the thing', store);
    expect(mail.type).toBe('mail');
    expect(mail.labels.from).toBe('hq-agent-mayor');
    expect(mail.labels.to).toBe('cv-agent-witness');
    expect(mail.labels.read).toBe('false');
    expect(mail.labels.mail_type).toBe('direct');
    expect(isFrameMail(mail)).toBe(true);
  });

  it('persists the bead to the store', async () => {
    const mail = await sendMail('hq-agent-mayor', 'cv-agent-witness', 'Test', 'Body', store);
    const stored = await store.get(mail.id);
    expect(stored).not.toBeNull();
    expect(stored?.type).toBe('mail');
  });

  it('uses recipient prefix for bead ID routing', async () => {
    const mail = await sendMail('hq-agent-mayor', 'cv-agent-witness', 'Test', 'Body', store);
    expect(mail.id.startsWith('cv-')).toBe(true);
  });

  it('supports thread_id for reply chaining', async () => {
    const original = await sendMail('a', 'b-agent', 'Original', 'Body', store);
    const reply = await sendMail('b-agent', 'a', 'Re: Original', 'Reply', store, {
      threadId: original.id,
    });
    expect(reply.labels.thread_id).toBe(original.id);
  });
});

// ── readMail + getUnreadMail ──────────────────────────────────────────────────

describe('readMail / getUnreadMail', () => {
  it('marks mail as read', async () => {
    const mail = await sendMail('hq-agent-mayor', 'cv-agent-witness', 'Test', 'Body', store);
    await readMail(mail.id, store);
    const updated = await store.get(mail.id);
    expect(updated?.labels['read']).toBe('true');
  });

  it('getUnreadMail returns only unread mail for the recipient', async () => {
    const m1 = await sendMail('hq-agent-mayor', 'cv-agent-witness', 'A', 'body', store);
    const m2 = await sendMail('hq-agent-mayor', 'cv-agent-witness', 'B', 'body', store);
    await sendMail('hq-agent-mayor', 'blog-agent-witness', 'C', 'body', store); // different recipient

    const unread = await getUnreadMail('cv-agent-witness', store);
    const ids = unread.map((m) => m.id);
    expect(ids).toContain(m1.id);
    expect(ids).toContain(m2.id);
    expect(unread.some((m) => m.labels.to !== 'cv-agent-witness')).toBe(false);
  });

  it('read mail excluded from getUnreadMail', async () => {
    const mail = await sendMail('hq-agent-mayor', 'cv-agent-witness', 'Test', 'Body', store);
    await readMail(mail.id, store);
    const unread = await getUnreadMail('cv-agent-witness', store);
    expect(unread.find((m) => m.id === mail.id)).toBeUndefined();
  });

  it('getUnreadMail returns oldest-first', async () => {
    const m1 = await sendMail('a', 'cv-x', 'First', '', store);
    await new Promise((r) => setTimeout(r, 5)); // ensure distinct timestamps
    const m2 = await sendMail('a', 'cv-x', 'Second', '', store);
    const unread = await getUnreadMail('cv-x', store);
    expect(unread[0].id).toBe(m1.id);
    expect(unread[1].id).toBe(m2.id);
  });

  it('countUnreadMail returns correct count', async () => {
    await sendMail('a', 'cv-agent', 'X', '', store);
    await sendMail('a', 'cv-agent', 'Y', '', store);
    expect(await countUnreadMail('cv-agent', store)).toBe(2);
  });
});

// ── handoff ───────────────────────────────────────────────────────────────────

describe('handoff', () => {
  it('writes a handoff mail bead addressed to self', async () => {
    await initAgent(store, 'blog-agent-worker', 'worker', 'blogengine');
    const mail = await handoff('blog-agent-worker', 'Working on draft post. Next: edit step.', store);

    expect(mail.labels.from).toBe('blog-agent-worker');
    expect(mail.labels.to).toBe('blog-agent-worker');
    expect(mail.labels.mail_type).toBe('handoff');
    expect(mail.labels.read).toBe('false');
    expect(mail.body).toContain('draft post');
  });

  it('sets agent status to suspended', async () => {
    await initAgent(store, 'blog-agent-worker', 'worker', 'blogengine');
    await handoff('blog-agent-worker', 'Context summary', store);

    const agent = await store.get('blog-agent-worker');
    expect(agent?.labels['agent_status']).toBe('suspended');
  });

  it('records last_session on handoff', async () => {
    const before = new Date().toISOString();
    await initAgent(store, 'blog-agent-worker', 'worker', 'blogengine');
    await handoff('blog-agent-worker', 'Summary', store);
    const after = new Date().toISOString();

    const agent = await store.get('blog-agent-worker');
    const lastSession = agent?.labels['last_session']!;
    expect(lastSession >= before).toBe(true);
    expect(lastSession <= after).toBe(true);
  });

  it('throws if agent does not exist', async () => {
    await expect(handoff('nonexistent-agent', 'Summary', store)).rejects.toThrow('not found');
  });

  it('throws if bead is not an AgentBead', async () => {
    // Plant a non-agent bead
    const now = new Date().toISOString();
    await store.create({ id: 'blog-task-fake', type: 'task', status: 'live', title: 'X',
      body: '', labels: {}, actor: 'system', refs: [], created_at: now, updated_at: now });
    await expect(handoff('blog-task-fake', 'Summary', store)).rejects.toThrow('not an AgentBead');
  });
});

// ── Prime node mail routing ────────────────────────────────────────────────────

describe('prime node — mail routing (A5 integration)', () => {
  it('routes to process_mail when agent has unread mail', async () => {
    await initAgent(store, 'cv-agent-witness', 'witness', 'cv-builder');
    await sendMail('hq-agent-mayor', 'cv-agent-witness', 'New task', 'Do X', store);

    const route = await runPrimeNode('cv-agent-witness', store);
    expect(route.next).toBe('process_mail');
    if (route.next === 'process_mail') {
      expect(route.mailCount).toBe(1);
    }
  });

  it('routes to await_input when all mail is read', async () => {
    await initAgent(store, 'cv-agent-witness', 'witness', 'cv-builder');
    const mail = await sendMail('hq-agent-mayor', 'cv-agent-witness', 'Task', 'Body', store);
    await readMail(mail.id, store);

    const route = await runPrimeNode('cv-agent-witness', store);
    expect(route.next).toBe('await_input');
  });

  it('hook takes priority over unread mail (GUPP)', async () => {
    await initAgent(store, 'cv-agent-witness', 'witness', 'cv-builder');

    // Both hook and mail present
    const now = new Date().toISOString();
    await store.create({ id: 'cv-task-urgent', type: 'task', status: 'live',
      title: 'Urgent task', body: '', labels: {}, actor: 'system', refs: [],
      created_at: now, updated_at: now });
    const agent = await store.get('cv-agent-witness');
    await store.update('cv-agent-witness', {
      labels: { ...agent!.labels, hook: 'cv-task-urgent' },
    });
    await sendMail('hq-agent-mayor', 'cv-agent-witness', 'Also a mail', 'body', store);

    const route = await runPrimeNode('cv-agent-witness', store);
    expect(route.next).toBe('execute_hook'); // hook wins
  });

  it('handoff flow: write handoff → reopen → prime routes to process_mail', async () => {
    // Session 1: agent hands off with context
    await initAgent(store, 'blog-agent-worker', 'worker', 'blogengine');
    await handoff('blog-agent-worker', 'Working on draft post. Current section: intro.', store);

    // Session 2: agent restarts
    await initAgent(store, 'blog-agent-worker', 'worker', 'blogengine');
    const route = await runPrimeNode('blog-agent-worker', store);

    expect(route.next).toBe('process_mail');
    if (route.next === 'process_mail') {
      expect(route.mailCount).toBe(1);
    }

    // Retrieve the handoff mail — should contain the context summary
    const unread = await getUnreadMail('blog-agent-worker', store);
    expect(unread[0].labels.mail_type).toBe('handoff');
    expect(unread[0].body).toContain('draft post');
  });
});
