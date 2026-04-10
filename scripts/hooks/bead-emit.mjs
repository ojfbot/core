#!/usr/bin/env node
/**
 * bead-emit.mjs — CLI for hooks to emit beads to the DoltBeadStore.
 *
 * Usage:
 *   node bead-emit.mjs session-start --skill=frame-standup --session-id=abc123
 *   node bead-emit.mjs session-update --session-id=abc123 --repos=core,shell
 *   node bead-emit.mjs session-close --session-id=abc123
 *   node bead-emit.mjs task-done --title="decompose StudyPanel" --session-id=abc123 --repo=seh-study
 *   node bead-emit.mjs pr-created --repo=seh-study --pr=13 --session-id=abc123
 *
 * Convoy commands (for /orchestrate integration):
 *   node bead-emit.mjs task-create --title="Add endpoint" --repo=cv-builder --convoy-id=hq-convoy-ab12
 *   node bead-emit.mjs convoy-create --title="orchestrate: plan+execute TripPlanner" --session-bead-id=hq-session-ab12
 *   node bead-emit.mjs convoy-add-slot --convoy-id=hq-convoy-ab12 --bead-id=cv-task-ef56 --agent-id=worktree-1
 *   node bead-emit.mjs convoy-update-slot --convoy-id=hq-convoy-ab12 --bead-id=cv-task-ef56 --slot-status=done
 *   node bead-emit.mjs convoy-finalize --convoy-id=hq-convoy-ab12
 *
 * Connects to Dolt sql-server on port 3307. Synchronous — hook waits for
 * completion (~200ms) to guarantee bead exists before next action.
 */

import mysql from 'mysql2/promise';
import crypto from 'crypto';

const DOLT_PORT = parseInt(process.env.DOLT_PORT ?? '3307', 10);
const DB = '.beads-dolt';

const [, , command, ...rawArgs] = process.argv;

function parseArgs(args) {
  const result = {};
  for (const arg of args) {
    const match = arg.match(/^--([^=]+)=(.+)$/);
    if (match) result[match[1]] = match[2];
  }
  return result;
}

const args = parseArgs(rawArgs);

async function run() {
  const pool = mysql.createPool({
    host: '127.0.0.1',
    port: DOLT_PORT,
    user: 'root',
    database: DB,
    connectionLimit: 1,
  });

  try {
    switch (command) {
      case 'session-start': {
        const id = `hq-session-${crypto.randomBytes(4).toString('hex')}`;
        const now = new Date().toISOString();
        await pool.execute(
          `INSERT INTO beads (id, type, status, title, body, labels, actor, refs, created_at, updated_at)
           VALUES (?, 'session', 'live', ?, '', ?, 'claude-code', '[]', ?, ?)`,
          [
            id,
            `Claude session: ${args.skill ?? 'interactive'}`,
            JSON.stringify({
              session_id: args['session-id'] ?? '',
              skill_invoked: args.skill ?? '',
              repos_touched: '[]',
              pr_count: '0',
            }),
            now,
            now,
          ],
        );
        await doltCommit(pool, `session:start ${id}`);
        // Output the bead ID so the hook can capture it
        console.log(JSON.stringify({ id, status: 'created' }));
        break;
      }

      case 'session-update': {
        const sessionId = args['session-id'];
        if (!sessionId) { console.error('--session-id required'); process.exit(1); }

        // Find the live session bead for this Claude session
        const [rows] = await pool.execute(
          "SELECT id, labels FROM beads WHERE type = 'session' AND status = 'live' AND JSON_EXTRACT(labels, '$.session_id') = ?",
          [sessionId],
        );
        const beads = rows;
        if (beads.length === 0) { console.error('No active session bead found'); process.exit(1); }

        const bead = beads[0];
        const labels = typeof bead.labels === 'string' ? JSON.parse(bead.labels) : bead.labels;

        if (args.repos) {
          const existing = JSON.parse(labels.repos_touched || '[]');
          const newRepos = args.repos.split(',');
          const merged = [...new Set([...existing, ...newRepos])];
          labels.repos_touched = JSON.stringify(merged);
        }
        if (args['pr-count']) {
          labels.pr_count = args['pr-count'];
        }

        await pool.execute(
          'UPDATE beads SET labels = ?, updated_at = ? WHERE id = ?',
          [JSON.stringify(labels), new Date().toISOString(), bead.id],
        );
        await doltCommit(pool, `session:update ${bead.id}`);
        console.log(JSON.stringify({ id: bead.id, status: 'updated' }));
        break;
      }

      case 'session-close': {
        const sessionId = args['session-id'];
        if (!sessionId) { console.error('--session-id required'); process.exit(1); }

        const [rows] = await pool.execute(
          "SELECT id FROM beads WHERE type = 'session' AND status = 'live' AND JSON_EXTRACT(labels, '$.session_id') = ?",
          [sessionId],
        );
        const beads = rows;
        if (beads.length === 0) { console.error('No active session bead found'); process.exit(1); }

        const now = new Date().toISOString();
        await pool.execute(
          "UPDATE beads SET status = 'closed', closed_at = ?, updated_at = ?, labels = JSON_SET(labels, '$.audit_locked', 'true') WHERE id = ?",
          [now, now, beads[0].id],
        );
        await doltCommit(pool, `session:close ${beads[0].id}`);
        console.log(JSON.stringify({ id: beads[0].id, status: 'closed' }));
        break;
      }

      case 'task-done': {
        const id = `${args.prefix ?? 'hq'}-task-${crypto.randomBytes(4).toString('hex')}`;
        const now = new Date().toISOString();
        const refs = [];
        if (args['session-id']) {
          // Find the session bead to link as ref
          const [rows] = await pool.execute(
            "SELECT id FROM beads WHERE type = 'session' AND JSON_EXTRACT(labels, '$.session_id') = ? LIMIT 1",
            [args['session-id']],
          );
          if (rows.length > 0) refs.push(rows[0].id);
        }

        await pool.execute(
          `INSERT INTO beads (id, type, status, title, body, labels, actor, refs, created_at, updated_at, closed_at)
           VALUES (?, 'task', 'closed', ?, '', ?, 'claude-code', ?, ?, ?, ?)`,
          [
            id,
            args.title ?? 'Task completed',
            JSON.stringify({ repo: args.repo ?? '', session_id: args['session-id'] ?? '' }),
            JSON.stringify(refs),
            now, now, now,
          ],
        );
        await doltCommit(pool, `task:done ${id}`);
        console.log(JSON.stringify({ id, status: 'created' }));
        break;
      }

      case 'pr-created': {
        const id = `${args.prefix ?? 'hq'}-pr-${crypto.randomBytes(4).toString('hex')}`;
        const now = new Date().toISOString();
        const refs = [];
        if (args['session-id']) {
          const [rows] = await pool.execute(
            "SELECT id FROM beads WHERE type = 'session' AND JSON_EXTRACT(labels, '$.session_id') = ? LIMIT 1",
            [args['session-id']],
          );
          if (rows.length > 0) refs.push(rows[0].id);
        }

        await pool.execute(
          `INSERT INTO beads (id, type, status, title, body, labels, actor, refs, created_at, updated_at)
           VALUES (?, 'pr', 'live', ?, '', ?, 'claude-code', ?, ?, ?)`,
          [
            id,
            `PR #${args.pr ?? '?'} on ${args.repo ?? 'unknown'}`,
            JSON.stringify({
              repo: args.repo ?? '',
              pr_number: args.pr ?? '',
              session_id: args['session-id'] ?? '',
            }),
            JSON.stringify(refs),
            now, now,
          ],
        );
        await doltCommit(pool, `pr:created ${id}`);

        // Also update session bead pr_count
        if (args['session-id']) {
          const [rows] = await pool.execute(
            "SELECT id, labels FROM beads WHERE type = 'session' AND JSON_EXTRACT(labels, '$.session_id') = ? LIMIT 1",
            [args['session-id']],
          );
          if (rows.length > 0) {
            const labels = typeof rows[0].labels === 'string' ? JSON.parse(rows[0].labels) : rows[0].labels;
            labels.pr_count = String((parseInt(labels.pr_count || '0', 10) + 1));
            await pool.execute(
              'UPDATE beads SET labels = ?, updated_at = ? WHERE id = ?',
              [JSON.stringify(labels), now, rows[0].id],
            );
            await doltCommit(pool, `session:pr-count ${rows[0].id}`);
          }
        }

        console.log(JSON.stringify({ id, status: 'created' }));
        break;
      }

      case 'task-create': {
        const id = `${args.prefix ?? (args.repo ? args.repo.slice(0, 4) : 'hq')}-task-${crypto.randomBytes(4).toString('hex')}`;
        const now = new Date().toISOString();
        const refs = [];
        if (args['convoy-id']) refs.push(args['convoy-id']);
        if (args['session-id']) {
          const [rows] = await pool.execute(
            "SELECT id FROM beads WHERE type = 'session' AND JSON_EXTRACT(labels, '$.session_id') = ? LIMIT 1",
            [args['session-id']],
          );
          if (rows.length > 0) refs.push(rows[0].id);
        }

        await pool.execute(
          `INSERT INTO beads (id, type, status, title, body, labels, actor, refs, created_at, updated_at)
           VALUES (?, 'task', 'live', ?, '', ?, 'claude-code', ?, ?, ?)`,
          [
            id,
            args.title ?? 'Task created',
            JSON.stringify({ repo: args.repo ?? '', session_id: args['session-id'] ?? '' }),
            JSON.stringify(refs),
            now, now,
          ],
        );
        await doltCommit(pool, `task:create ${id}`);
        console.log(JSON.stringify({ id, status: 'created' }));
        break;
      }

      case 'convoy-create': {
        const id = `hq-convoy-${crypto.randomBytes(4).toString('hex')}`;
        const now = new Date().toISOString();
        const refs = [];
        if (args['session-bead-id']) refs.push(args['session-bead-id']);

        await pool.execute(
          `INSERT INTO beads (id, type, status, title, body, labels, actor, refs, created_at, updated_at)
           VALUES (?, 'convoy', 'live', ?, '', ?, 'claude-code', ?, ?, ?)`,
          [
            id,
            args.title ?? 'Convoy',
            JSON.stringify({ convoy_status: 'forming', slots: '[]' }),
            JSON.stringify(refs),
            now, now,
          ],
        );

        // Link convoy back to session bead
        if (args['session-bead-id']) {
          try {
            const [rows] = await pool.execute(
              'SELECT labels FROM beads WHERE id = ?',
              [args['session-bead-id']],
            );
            if (rows.length > 0) {
              const labels = typeof rows[0].labels === 'string' ? JSON.parse(rows[0].labels) : rows[0].labels;
              labels.convoy_id = id;
              await pool.execute(
                'UPDATE beads SET labels = ?, updated_at = ? WHERE id = ?',
                [JSON.stringify(labels), now, args['session-bead-id']],
              );
            }
          } catch { /* best effort */ }
        }

        await doltCommit(pool, `convoy:create ${id}`);
        console.log(JSON.stringify({ id, status: 'created' }));
        break;
      }

      case 'convoy-add-slot': {
        const convoyId = args['convoy-id'];
        if (!convoyId) { console.error('--convoy-id required'); process.exit(1); }
        const beadId = args['bead-id'];
        if (!beadId) { console.error('--bead-id required'); process.exit(1); }

        const [rows] = await pool.execute(
          'SELECT labels FROM beads WHERE id = ? AND type = ?',
          [convoyId, 'convoy'],
        );
        if (rows.length === 0) { console.error('Convoy not found'); process.exit(1); }

        const labels = typeof rows[0].labels === 'string' ? JSON.parse(rows[0].labels) : rows[0].labels;
        const slots = JSON.parse(labels.slots || '[]');

        // Idempotent — skip if already in slots
        if (slots.some((s) => s.beadId === beadId)) {
          console.log(JSON.stringify({ convoy_id: convoyId, slot_count: slots.length, status: 'already_exists' }));
          break;
        }

        const newSlot = { beadId, status: 'pending' };
        if (args['agent-id']) newSlot.agentId = args['agent-id'];
        slots.push(newSlot);

        labels.slots = JSON.stringify(slots);
        if (labels.convoy_status === 'forming') labels.convoy_status = 'active';

        await pool.execute(
          'UPDATE beads SET labels = ?, updated_at = ? WHERE id = ?',
          [JSON.stringify(labels), new Date().toISOString(), convoyId],
        );
        await doltCommit(pool, `convoy:add-slot ${beadId} → ${convoyId}`);
        console.log(JSON.stringify({ convoy_id: convoyId, slot_count: slots.length, status: 'added' }));
        break;
      }

      case 'convoy-update-slot': {
        const convoyId = args['convoy-id'];
        if (!convoyId) { console.error('--convoy-id required'); process.exit(1); }
        const beadId = args['bead-id'];
        if (!beadId) { console.error('--bead-id required'); process.exit(1); }
        const slotStatus = args['slot-status'];
        if (!slotStatus) { console.error('--slot-status required'); process.exit(1); }

        const [rows] = await pool.execute(
          'SELECT labels FROM beads WHERE id = ? AND type = ?',
          [convoyId, 'convoy'],
        );
        if (rows.length === 0) { console.error('Convoy not found'); process.exit(1); }

        const labels = typeof rows[0].labels === 'string' ? JSON.parse(rows[0].labels) : rows[0].labels;
        const slots = JSON.parse(labels.slots || '[]');
        const slot = slots.find((s) => s.beadId === beadId);
        if (!slot) { console.error('Slot not found'); process.exit(1); }

        slot.status = slotStatus;
        labels.slots = JSON.stringify(slots);

        await pool.execute(
          'UPDATE beads SET labels = ?, updated_at = ? WHERE id = ?',
          [JSON.stringify(labels), new Date().toISOString(), convoyId],
        );
        await doltCommit(pool, `convoy:slot-update ${beadId} → ${slotStatus}`);
        console.log(JSON.stringify({ convoy_id: convoyId, bead_id: beadId, slot_status: slotStatus }));
        break;
      }

      case 'convoy-finalize': {
        const convoyId = args['convoy-id'];
        if (!convoyId) { console.error('--convoy-id required'); process.exit(1); }

        const [rows] = await pool.execute(
          'SELECT labels FROM beads WHERE id = ? AND type = ?',
          [convoyId, 'convoy'],
        );
        if (rows.length === 0) { console.error('Convoy not found'); process.exit(1); }

        const labels = typeof rows[0].labels === 'string' ? JSON.parse(rows[0].labels) : rows[0].labels;
        const slots = JSON.parse(labels.slots || '[]');

        const hasFailed = slots.some((s) => s.status === 'failed');
        const allSettled = slots.every((s) => s.status === 'done' || s.status === 'failed');

        const finalStatus = hasFailed ? 'failed' : allSettled ? 'completed' : 'active';
        labels.convoy_status = finalStatus;
        labels.slots = JSON.stringify(slots);

        const now = new Date().toISOString();
        const closedAt = finalStatus !== 'active' ? now : null;
        const beadStatus = finalStatus !== 'active' ? 'closed' : 'live';

        await pool.execute(
          'UPDATE beads SET status = ?, labels = ?, updated_at = ?, closed_at = ? WHERE id = ?',
          [beadStatus, JSON.stringify(labels), now, closedAt, convoyId],
        );
        await doltCommit(pool, `convoy:finalize ${convoyId} → ${finalStatus}`);
        console.log(JSON.stringify({ convoy_id: convoyId, final_status: finalStatus }));
        break;
      }

      case 'active-sessions': {
        const [rows] = await pool.execute(
          "SELECT id, title, labels, created_at FROM beads WHERE type = 'session' AND status = 'live' ORDER BY created_at DESC",
        );
        console.log(JSON.stringify({ sessions: rows }));
        break;
      }

      default:
        console.error(`Unknown command: ${command}`);
        console.error('Usage: bead-emit.mjs <session-start|session-update|session-close|task-done|task-create|pr-created|convoy-create|convoy-add-slot|convoy-update-slot|convoy-finalize|active-sessions>');
        process.exit(1);
    }
  } finally {
    await pool.end();
  }
}

async function doltCommit(pool, message) {
  try {
    await pool.execute("CALL DOLT_ADD('-A')");
    await pool.execute("CALL DOLT_COMMIT('-m', ?)", [message]);
  } catch { /* no changes */ }
}

run().catch((err) => {
  console.error('bead-emit error:', err.message);
  process.exit(1);
});
