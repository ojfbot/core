/**
 * bead-emit.mjs integration tests
 *
 * Requires a running Dolt sql-server on port 3307 with the beads schema.
 * Skipped unless DOLT_TEST=1 is set.
 *
 * Run: DOLT_TEST=1 pnpm vitest run scripts/hooks/__tests__/bead-emit.test.mjs
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import path from 'path';
import mysql from 'mysql2/promise';

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BEAD_EMIT = path.resolve(__dirname, '..', 'bead-emit.mjs');

const DOLT_PORT = parseInt(process.env.DOLT_PORT ?? '3307', 10);
const SKIP = !process.env.DOLT_TEST;

/**
 * Run bead-emit.mjs with the given command and args.
 * Returns { stdout, stderr, code }.
 */
async function emit(command, args = {}) {
  const cliArgs = Object.entries(args).map(([k, v]) => `--${k}=${v}`);
  try {
    const { stdout, stderr } = await execFileAsync('node', [BEAD_EMIT, command, ...cliArgs], {
      timeout: 10_000,
    });
    return { stdout: stdout.trim(), stderr: stderr.trim(), code: 0 };
  } catch (err) {
    return {
      stdout: (err.stdout ?? '').trim(),
      stderr: (err.stderr ?? '').trim(),
      code: err.code ?? 1,
    };
  }
}

/** Parse JSON from bead-emit stdout. */
function parseOutput(result) {
  return JSON.parse(result.stdout);
}

describe.skipIf(SKIP)('bead-emit.mjs lifecycle', () => {
  let pool;

  beforeAll(() => {
    pool = mysql.createPool({
      host: '127.0.0.1',
      port: DOLT_PORT,
      user: 'root',
      database: '.beads-dolt',
    });
  });

  afterAll(async () => {
    await pool.end();
  });

  // Title patterns that identify beads created by this suite (safe to purge).
  const TEST_TITLE_CLAUSE =
    "(title LIKE '%test-emit%' OR title LIKE '%Test session%' OR title LIKE '%Test task%' " +
    "OR title LIKE '%Test convoy%' OR title LIKE '%Test PR%' OR title LIKE '%Test agent%' " +
    "OR title LIKE '%agent: testevt%')";

  beforeEach(async () => {
    // Purge events for our test beads first (keep the shared bead_events log clean), then the beads.
    await pool.execute(
      `DELETE FROM bead_events WHERE bead_id IN (SELECT id FROM beads WHERE actor = 'claude-code' AND ${TEST_TITLE_CLAUSE})`,
    );
    await pool.execute(`DELETE FROM beads WHERE actor = 'claude-code' AND ${TEST_TITLE_CLAUSE}`);
    try {
      await pool.execute("CALL DOLT_ADD('-A')");
      await pool.execute("CALL DOLT_COMMIT('-m', 'test: cleanup')");
    } catch { /* no changes */ }
  });

  /** Count bead_events rows for a specific bead — keyed off OUR ids, so concurrent agents can't skew it. */
  async function countEventsFor(beadId) {
    const [rows] = await pool.execute('SELECT COUNT(*) AS n FROM bead_events WHERE bead_id = ?', [beadId]);
    return Number(rows[0].n);
  }

  /** The Dolt commit hash that last changed this bead row (via the dolt_diff_beads system table). */
  async function lastCommitForBead(beadId) {
    const [rows] = await pool.execute(
      'SELECT to_commit FROM dolt_diff_beads WHERE to_id = ? ORDER BY to_commit_date DESC LIMIT 1',
      [beadId],
    );
    return rows.length ? rows[0].to_commit : null;
  }

  /** The Dolt commit hash that introduced this bead's event row (via dolt_diff_bead_events). */
  async function lastCommitForEvent(beadId) {
    const [rows] = await pool.execute(
      'SELECT to_commit FROM dolt_diff_bead_events WHERE to_bead_id = ? ORDER BY to_commit_date DESC LIMIT 1',
      [beadId],
    );
    return rows.length ? rows[0].to_commit : null;
  }

  /** Query a bead by ID from Dolt. */
  async function queryBead(id) {
    const [rows] = await pool.execute('SELECT * FROM beads WHERE id = ?', [id]);
    if (rows.length === 0) return null;
    const r = rows[0];
    return {
      ...r,
      labels: typeof r.labels === 'string' ? JSON.parse(r.labels) : r.labels,
      refs: typeof r.refs === 'string' ? JSON.parse(r.refs) : r.refs,
    };
  }

  // ── Session commands ──────────────────────────────────────────────────

  describe('session-start', () => {
    it('creates a live session bead in Dolt', async () => {
      const result = await emit('session-start', {
        skill: 'test-emit',
        'session-id': 'test-session-001',
      });
      expect(result.code).toBe(0);

      const out = parseOutput(result);
      expect(out.status).toBe('created');
      expect(out.id).toMatch(/^hq-session-/);

      const bead = await queryBead(out.id);
      expect(bead).not.toBeNull();
      expect(bead.type).toBe('session');
      expect(bead.status).toBe('live');
      expect(bead.labels.skill_invoked).toBe('test-emit');
      expect(bead.labels.session_id).toBe('test-session-001');
    });
  });

  describe('session-update', () => {
    it('updates repos_touched on the session bead', async () => {
      const start = parseOutput(await emit('session-start', {
        skill: 'test-emit',
        'session-id': 'test-session-002',
      }));

      const result = await emit('session-update', {
        'session-id': 'test-session-002',
        repos: 'core,shell',
      });
      expect(result.code).toBe(0);

      const bead = await queryBead(start.id);
      expect(JSON.parse(bead.labels.repos_touched)).toEqual(['core', 'shell']);
    });

    it('exits 1 when --session-id is missing', async () => {
      const result = await emit('session-update', { repos: 'core' });
      expect(result.code).not.toBe(0);
      expect(result.stderr).toContain('--session-id required');
    });
  });

  describe('session-close', () => {
    it('closes the session bead and sets audit_locked', async () => {
      const start = parseOutput(await emit('session-start', {
        skill: 'test-emit',
        'session-id': 'test-session-003',
      }));

      const result = await emit('session-close', {
        'session-id': 'test-session-003',
      });
      expect(result.code).toBe(0);

      const bead = await queryBead(start.id);
      expect(bead.status).toBe('closed');
      expect(bead.labels.audit_locked).toBe('true');
      expect(bead.closed_at).not.toBeNull();
    });
  });

  // ── Task commands ─────────────────────────────────────────────────────

  describe('task-done', () => {
    it('creates a closed task bead', async () => {
      const result = await emit('task-done', {
        title: 'Test task done',
        repo: 'core',
        prefix: 'core',
      });
      expect(result.code).toBe(0);

      const out = parseOutput(result);
      expect(out.id).toMatch(/^core-task-/);

      const bead = await queryBead(out.id);
      expect(bead.type).toBe('task');
      expect(bead.status).toBe('closed');
      expect(bead.closed_at).not.toBeNull();
    });

    it('links to session bead via refs when session-id provided', async () => {
      const session = parseOutput(await emit('session-start', {
        skill: 'test-emit',
        'session-id': 'test-session-004',
      }));

      const task = parseOutput(await emit('task-done', {
        title: 'Test task with session',
        repo: 'core',
        'session-id': 'test-session-004',
      }));

      const bead = await queryBead(task.id);
      expect(bead.refs).toContain(session.id);
    });
  });

  describe('task-create', () => {
    it('creates a live task bead (not closed)', async () => {
      const result = await emit('task-create', {
        title: 'Test task create',
        repo: 'core',
      });
      expect(result.code).toBe(0);

      const out = parseOutput(result);
      expect(out.id).toMatch(/^core-task-/);

      const bead = await queryBead(out.id);
      expect(bead.type).toBe('task');
      expect(bead.status).toBe('live');
      expect(bead.closed_at).toBeNull();
    });

    it('uses repo prefix for ID generation', async () => {
      const out = parseOutput(await emit('task-create', {
        title: 'Test task prefix',
        repo: 'TripPlanner',
      }));
      expect(out.id).toMatch(/^Trip-task-/);
    });

    it('adds convoy-id to refs', async () => {
      const convoy = parseOutput(await emit('convoy-create', {
        title: 'Test convoy for task ref',
      }));

      const task = parseOutput(await emit('task-create', {
        title: 'Test task with convoy ref',
        repo: 'core',
        'convoy-id': convoy.id,
      }));

      const bead = await queryBead(task.id);
      expect(bead.refs).toContain(convoy.id);
    });
  });

  // ── PR command ────────────────────────────────────────────────────────

  describe('pr-created', () => {
    it('creates a PR bead and increments session pr_count', async () => {
      const session = parseOutput(await emit('session-start', {
        skill: 'test-emit',
        'session-id': 'test-session-005',
      }));

      const pr = parseOutput(await emit('pr-created', {
        repo: 'core',
        pr: '99',
        'session-id': 'test-session-005',
      }));
      expect(pr.id).toMatch(/^hq-pr-/);

      const prBead = await queryBead(pr.id);
      expect(prBead.type).toBe('pr');
      expect(prBead.status).toBe('live');
      expect(prBead.labels.pr_number).toBe('99');
      expect(prBead.refs).toContain(session.id);

      // Verify session pr_count was incremented
      const sessionBead = await queryBead(session.id);
      expect(sessionBead.labels.pr_count).toBe('1');
    });
  });

  // ── Convoy lifecycle ──────────────────────────────────────────────────

  describe('convoy-create', () => {
    it('creates a convoy bead with forming status', async () => {
      const result = await emit('convoy-create', {
        title: 'Test convoy create',
      });
      expect(result.code).toBe(0);

      const out = parseOutput(result);
      expect(out.id).toMatch(/^hq-convoy-/);

      const bead = await queryBead(out.id);
      expect(bead.type).toBe('convoy');
      expect(bead.status).toBe('live');
      expect(bead.labels.convoy_status).toBe('forming');
      expect(JSON.parse(bead.labels.slots)).toEqual([]);
    });

    it('links to session bead when --session-bead-id provided', async () => {
      const session = parseOutput(await emit('session-start', {
        skill: 'test-emit',
        'session-id': 'test-session-006',
      }));

      const convoy = parseOutput(await emit('convoy-create', {
        title: 'Test convoy with session',
        'session-bead-id': session.id,
      }));

      const convoyBead = await queryBead(convoy.id);
      expect(convoyBead.refs).toContain(session.id);

      // Session should have convoy_id in labels
      const sessionBead = await queryBead(session.id);
      expect(sessionBead.labels.convoy_id).toBe(convoy.id);
    });
  });

  describe('convoy-add-slot', () => {
    it('adds a task as a pending slot', async () => {
      const convoy = parseOutput(await emit('convoy-create', { title: 'Test convoy slots' }));
      const task = parseOutput(await emit('task-create', { title: 'Test task for slot', repo: 'core' }));

      const result = await emit('convoy-add-slot', {
        'convoy-id': convoy.id,
        'bead-id': task.id,
        'agent-id': 'worktree-1',
      });
      expect(result.code).toBe(0);
      const out = parseOutput(result);
      expect(out.slot_count).toBe(1);
      expect(out.status).toBe('added');

      const bead = await queryBead(convoy.id);
      const slots = JSON.parse(bead.labels.slots);
      expect(slots).toHaveLength(1);
      expect(slots[0].beadId).toBe(task.id);
      expect(slots[0].status).toBe('pending');
      expect(slots[0].agentId).toBe('worktree-1');

      // convoy_status should transition from forming to active
      expect(bead.labels.convoy_status).toBe('active');
    });

    it('is idempotent — second add returns already_exists', async () => {
      const convoy = parseOutput(await emit('convoy-create', { title: 'Test convoy idempotent' }));
      const task = parseOutput(await emit('task-create', { title: 'Test task idempotent', repo: 'core' }));

      await emit('convoy-add-slot', { 'convoy-id': convoy.id, 'bead-id': task.id });
      const second = parseOutput(await emit('convoy-add-slot', { 'convoy-id': convoy.id, 'bead-id': task.id }));
      expect(second.status).toBe('already_exists');
      expect(second.slot_count).toBe(1);
    });
  });

  describe('convoy-update-slot', () => {
    it('updates slot status', async () => {
      const convoy = parseOutput(await emit('convoy-create', { title: 'Test convoy update' }));
      const task = parseOutput(await emit('task-create', { title: 'Test task update', repo: 'core' }));
      await emit('convoy-add-slot', { 'convoy-id': convoy.id, 'bead-id': task.id });

      const result = await emit('convoy-update-slot', {
        'convoy-id': convoy.id,
        'bead-id': task.id,
        'slot-status': 'active',
      });
      expect(result.code).toBe(0);

      const bead = await queryBead(convoy.id);
      const slots = JSON.parse(bead.labels.slots);
      expect(slots[0].status).toBe('active');
    });

    it('exits 1 for missing required args', async () => {
      const r1 = await emit('convoy-update-slot', { 'bead-id': 'x', 'slot-status': 'done' });
      expect(r1.code).not.toBe(0);
      expect(r1.stderr).toContain('--convoy-id required');

      const r2 = await emit('convoy-update-slot', { 'convoy-id': 'x', 'slot-status': 'done' });
      expect(r2.code).not.toBe(0);
      expect(r2.stderr).toContain('--bead-id required');
    });
  });

  describe('convoy-finalize', () => {
    it('completes when all slots are done', async () => {
      const convoy = parseOutput(await emit('convoy-create', { title: 'Test convoy finalize-done' }));
      const t1 = parseOutput(await emit('task-create', { title: 'Test task fin1', repo: 'core' }));
      const t2 = parseOutput(await emit('task-create', { title: 'Test task fin2', repo: 'core' }));

      await emit('convoy-add-slot', { 'convoy-id': convoy.id, 'bead-id': t1.id });
      await emit('convoy-add-slot', { 'convoy-id': convoy.id, 'bead-id': t2.id });
      await emit('convoy-update-slot', { 'convoy-id': convoy.id, 'bead-id': t1.id, 'slot-status': 'done' });
      await emit('convoy-update-slot', { 'convoy-id': convoy.id, 'bead-id': t2.id, 'slot-status': 'done' });

      const result = parseOutput(await emit('convoy-finalize', { 'convoy-id': convoy.id }));
      expect(result.final_status).toBe('completed');

      const bead = await queryBead(convoy.id);
      expect(bead.status).toBe('closed');
      expect(bead.labels.convoy_status).toBe('completed');
      expect(bead.closed_at).not.toBeNull();
    });

    it('fails when any slot failed', async () => {
      const convoy = parseOutput(await emit('convoy-create', { title: 'Test convoy finalize-fail' }));
      const t1 = parseOutput(await emit('task-create', { title: 'Test task fail1', repo: 'core' }));
      const t2 = parseOutput(await emit('task-create', { title: 'Test task fail2', repo: 'core' }));

      await emit('convoy-add-slot', { 'convoy-id': convoy.id, 'bead-id': t1.id });
      await emit('convoy-add-slot', { 'convoy-id': convoy.id, 'bead-id': t2.id });
      await emit('convoy-update-slot', { 'convoy-id': convoy.id, 'bead-id': t1.id, 'slot-status': 'done' });
      await emit('convoy-update-slot', { 'convoy-id': convoy.id, 'bead-id': t2.id, 'slot-status': 'failed' });

      const result = parseOutput(await emit('convoy-finalize', { 'convoy-id': convoy.id }));
      expect(result.final_status).toBe('failed');

      const bead = await queryBead(convoy.id);
      expect(bead.status).toBe('closed');
    });

    it('stays active when slots are still pending', async () => {
      const convoy = parseOutput(await emit('convoy-create', { title: 'Test convoy finalize-active' }));
      const t1 = parseOutput(await emit('task-create', { title: 'Test task active1', repo: 'core' }));
      const t2 = parseOutput(await emit('task-create', { title: 'Test task active2', repo: 'core' }));

      await emit('convoy-add-slot', { 'convoy-id': convoy.id, 'bead-id': t1.id });
      await emit('convoy-add-slot', { 'convoy-id': convoy.id, 'bead-id': t2.id });
      await emit('convoy-update-slot', { 'convoy-id': convoy.id, 'bead-id': t1.id, 'slot-status': 'done' });
      // t2 stays pending

      const result = parseOutput(await emit('convoy-finalize', { 'convoy-id': convoy.id }));
      expect(result.final_status).toBe('active');

      const bead = await queryBead(convoy.id);
      expect(bead.status).toBe('live'); // not closed
    });
  });

  // ── Full lifecycle ────────────────────────────────────────────────────

  describe('full lifecycle', () => {
    it('session → convoy → tasks → finalize → close', async () => {
      // 1. Start session
      const session = parseOutput(await emit('session-start', {
        skill: 'test-emit',
        'session-id': 'test-session-lifecycle',
      }));

      // 2. Create convoy linked to session
      const convoy = parseOutput(await emit('convoy-create', {
        title: 'Test convoy lifecycle',
        'session-bead-id': session.id,
      }));

      // 3. Create tasks and add as slots
      const t1 = parseOutput(await emit('task-create', {
        title: 'Test task lifecycle-1',
        repo: 'core',
        'convoy-id': convoy.id,
      }));
      const t2 = parseOutput(await emit('task-create', {
        title: 'Test task lifecycle-2',
        repo: 'shell',
        'convoy-id': convoy.id,
      }));

      await emit('convoy-add-slot', { 'convoy-id': convoy.id, 'bead-id': t1.id, 'agent-id': 'w1' });
      await emit('convoy-add-slot', { 'convoy-id': convoy.id, 'bead-id': t2.id, 'agent-id': 'w2' });

      // 4. Progress through slot statuses
      await emit('convoy-update-slot', { 'convoy-id': convoy.id, 'bead-id': t1.id, 'slot-status': 'active' });
      await emit('convoy-update-slot', { 'convoy-id': convoy.id, 'bead-id': t2.id, 'slot-status': 'active' });
      await emit('convoy-update-slot', { 'convoy-id': convoy.id, 'bead-id': t1.id, 'slot-status': 'done' });
      await emit('convoy-update-slot', { 'convoy-id': convoy.id, 'bead-id': t2.id, 'slot-status': 'done' });

      // 5. Create a PR in the session
      await emit('pr-created', {
        repo: 'core',
        pr: '100',
        'session-id': 'test-session-lifecycle',
      });

      // 6. Finalize convoy
      const fin = parseOutput(await emit('convoy-finalize', { 'convoy-id': convoy.id }));
      expect(fin.final_status).toBe('completed');

      // 7. Close session
      await emit('session-close', { 'session-id': 'test-session-lifecycle' });

      // Verify final state
      const sessionBead = await queryBead(session.id);
      expect(sessionBead.status).toBe('closed');
      expect(sessionBead.labels.audit_locked).toBe('true');
      expect(sessionBead.labels.pr_count).toBe('1');
      expect(sessionBead.labels.convoy_id).toBe(convoy.id);

      const convoyBead = await queryBead(convoy.id);
      expect(convoyBead.status).toBe('closed');
      expect(convoyBead.labels.convoy_status).toBe('completed');
      expect(convoyBead.refs).toContain(session.id);
    });
  });

  // ── Edge cases ────────────────────────────────────────────────────────

  describe('active-sessions', () => {
    it('returns only live sessions', async () => {
      await emit('session-start', { skill: 'test-emit', 'session-id': 'test-session-active' });
      const result = parseOutput(await emit('active-sessions'));
      expect(result.sessions).toBeDefined();
      expect(Array.isArray(result.sessions)).toBe(true);
      // At least our test session should be there
      const found = result.sessions.some(s => {
        const labels = typeof s.labels === 'string' ? JSON.parse(s.labels) : s.labels;
        return labels.session_id === 'test-session-active';
      });
      expect(found).toBe(true);
    });
  });

  describe('convoy-status', () => {
    it('runs without crashing (output goes to console)', async () => {
      const convoy = parseOutput(await emit('convoy-create', { title: 'Test convoy status display' }));
      const result = await emit('convoy-status', { 'convoy-id': convoy.id });
      expect(result.code).toBe(0);
      // convoy-status writes to console, not JSON
      expect(result.stdout).toContain('Test convoy status display');
    });
  });

  describe('unknown command', () => {
    it('exits 1 with usage message', async () => {
      const result = await emit('not-a-command');
      expect(result.code).not.toBe(0);
      expect(result.stderr).toContain('Unknown command');
    });
  });

  // ── Event spine (S1 — coordination rollout) ───────────────────────────
  // The bead_events table existed but was never written. Every mutating verb must now
  // append exactly one event row, committed in the SAME DOLT_COMMIT as its bead write.

  describe('event spine (S1)', () => {
    it('C1: each mutating verb class emits a bead_events row (session/task/pr/convoy/agent)', async () => {
      const session = parseOutput(await emit('session-start', {
        skill: 'test-emit',
        'session-id': 'test-evt-session',
      }));
      expect(await countEventsFor(session.id)).toBeGreaterThanOrEqual(1);

      const task = parseOutput(await emit('task-create', { title: 'Test task evt', repo: 'core' }));
      expect(await countEventsFor(task.id)).toBeGreaterThanOrEqual(1);

      // pr-created with no --session-id → single bead, single commit (no pr-count side-write)
      const pr = parseOutput(await emit('pr-created', { repo: 'core', pr: '77' }));
      expect(await countEventsFor(pr.id)).toBeGreaterThanOrEqual(1);

      const convoy = parseOutput(await emit('convoy-create', { title: 'Test convoy evt' }));
      expect(await countEventsFor(convoy.id)).toBeGreaterThanOrEqual(1);

      // namespaced app 'testevt' so we never collide with a real core-agent-worker bead
      const agent = parseOutput(await emit('agent-create', {
        role: 'worker',
        app: 'testevt',
        'session-id': 'test-evt-session',
      }));
      expect(await countEventsFor(agent.id)).toBeGreaterThanOrEqual(1);
    });

    it('C2: the event lands in the SAME dolt commit as its bead (no second commit)', async () => {
      const task = parseOutput(await emit('task-create', { title: 'Test task same-commit', repo: 'core' }));
      const beadCommit = await lastCommitForBead(task.id);
      const eventCommit = await lastCommitForEvent(task.id);
      expect(beadCommit).not.toBeNull();
      expect(eventCommit).not.toBeNull();
      // Same hash ⇒ DOLT_ADD -A staged both rows into one DOLT_COMMIT. A second commit would diverge.
      expect(eventCommit).toBe(beadCommit);
    });

    it('C2: event count == verb count over a sequence (parity, one event per verb)', async () => {
      const ids = [];
      ids.push(parseOutput(await emit('session-start', { skill: 'test-emit', 'session-id': 'test-evt-seq' })).id);
      ids.push(parseOutput(await emit('task-create', { title: 'Test task seq', repo: 'core' })).id);
      ids.push(parseOutput(await emit('task-done', { title: 'Test task seq done', repo: 'core' })).id);
      ids.push(parseOutput(await emit('convoy-create', { title: 'Test convoy seq' })).id);

      let total = 0;
      for (const id of ids) total += await countEventsFor(id);
      expect(total).toBe(ids.length);
    });

    it('event row shape matches dolt-schema (event_type, actor, summary, timestamp)', async () => {
      const task = parseOutput(await emit('task-create', { title: 'Test task shape', repo: 'core' }));
      const [rows] = await pool.execute('SELECT * FROM bead_events WHERE bead_id = ? LIMIT 1', [task.id]);
      expect(rows.length).toBe(1);
      const e = rows[0];
      expect(e.event_type).toBe('task-create');
      expect(e.actor).toBe('claude-code');
      expect(typeof e.summary).toBe('string');
      expect(e.timestamp).toBeTruthy();
    });

    it('S2: agent-* events carry actor = the agent bead id (enables liveness GROUP BY actor)', async () => {
      // namespaced app so we never touch a real core-agent-* bead
      const agent = parseOutput(await emit('agent-create', {
        role: 'worker',
        app: 'testevt',
        'session-id': 'test-evt-actor',
      }));
      const [rows] = await pool.execute(
        "SELECT actor, event_type FROM bead_events WHERE bead_id = ? AND event_type LIKE 'agent-%' LIMIT 1",
        [agent.id],
      );
      expect(rows.length).toBe(1);
      // The differentiator vs S1: agent events are keyed to the agent, not the uniform 'claude-code'.
      expect(rows[0].actor).toBe(agent.id);
      expect(rows[0].actor).not.toBe('claude-code');
    });
  });
});
