#!/usr/bin/env node
/**
 * bead-emit.mjs — CLI for hooks to emit beads to the DoltBeadStore.
 *
 * Usage:
 *   node bead-emit.mjs session-start --skill=frame-standup --session-id=abc123
 *   node bead-emit.mjs session-update --session-id=abc123 --repos=core,shell
 *   node bead-emit.mjs session-close --session-id=abc123
 *   node bead-emit.mjs task-done --title="decompose StudyPanel" --session-id=abc123 --repo=seh-study
 *   node bead-emit.mjs pr-created --repo=seh-study --pr=13 --session-id=abc123 [--trace-id=<uuid>]
 *   node bead-emit.mjs queue-post --title="Fix X" --repo=core [--trace-id=<uuid>]  # minted if absent
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

/**
 * RESERVED_QUEUE_LABELS — the unassigned-queue label contract (ADR-0002, coordination rollout S3).
 * Mirrored in morning-cockpit packages/shared/src/dolt-bead.ts. Set by queue-post; enforced by
 * queue-claim (S4). The schema home is packages/workflows/src/bead-store/dolt-schema.sql.
 *
 *   labels.queue      'available' | 'claimed' | 'expired' | 'incubating' | 'quarantined'
 *                     — 'available' marks a DELIBERATELY posted task, vs default-'created' cruft.
 *                     — 'quarantined' (S18) parks a suspect bead out of every queue lane WITHOUT
 *                       deleting anything; set by bead-quarantine, never by sweep.
 *   labels.kind       's' | 'm' | 'l'  — size/TTL class (TTL below).
 *   labels.autonomy   'human_only' (default) | 'agent_eligible' | 'either'  — who may claim.
 *   labels.posted_at  ISO — when queue-post ran.
 *   labels.expires_at ISO — posted_at + kind TTL. Expired-but-available renders STALE.
 *
 * Roadmap-dispatch labels (roadmap-schema.md; set by roadmap-compile.mjs via queue-post flags).
 * A queue bead carrying roadmap_ref is a compiled DISPATCH PROJECTION of a roadmap slice — the
 * markdown file is canonical, the bead is the projection; the compiler reconciles by roadmap_ref.
 *
 *   labels.roadmap_ref   'rm:<slug>#S<n>' — the slice this bead projects. Idempotency key.
 *   labels.advances      'ns:<slug>#P<n>' — the northstar property the slice moves.
 *   labels.autonomy_gate 'gate-0' | 'gate-1' | 'gate-2' — the MERGE gate (progressive-autonomy-
 *                        gates ADR). Distinct from labels.autonomy (claim eligibility) above.
 *   labels.why           short human line: what merging this delivers.
 *
 * Trace identity (S21, SHADOW — emitted, nothing consumes it yet):
 *   labels.trace_id      UUID minted at queue-post/compile (--trace-id or minted here), threaded
 *                        queue bead → day-runner brief/session env (TRACE_ID) → pr-created bead +
 *                        'Trace:' PR-body line. Optional everywhere — beads without it keep working.
 *                        Key follows OTel gen_ai trace-correlation naming (stays `trace_id`).
 * Outcome capture (S18, audit I2) — the human verdict where a human touched agent output.
 * Set by --outcome on task-done / bead-close / bead-quarantine; read by the weekly
 * golden-candidate filer (weekly-measure.mjs), which files rejected|edited beads as
 * candidate golden tasks.
 *
 *   labels.outcome    'accepted' | 'edited' | 'rejected' | 'abandoned'
 */
const QUEUE_KIND_TTL_DAYS = { s: 2, m: 5, l: 10 };
const QUEUE_AUTONOMY = ['human_only', 'agent_eligible', 'either'];
// Lease TTL by claimer kind (ADR-0002 dead-claim safety valve): humans get a long renewable hold,
// agents a short one so a crashed worker frees its work quickly. queue-sweep reclaims expired leases.
const QUEUE_LEASE_MS = { human: 8 * 3_600_000, agent: 5 * 60_000 };

// S14: --checks arrives as a JSON string from day-runner; a malformed value is recorded as
// such rather than dropped (the shadow record must not silently vanish) or thrown (best-effort).
function safeParseChecks(raw) {
  try { return JSON.parse(raw); } catch { return { unparseable: String(raw).slice(0, 200) }; }
}

// S18: outcome capture (audit I2) — the human verdict on agent output. The enum is closed on
// purpose: free-text outcomes can't be aggregated by the weekly golden-candidate filer.
// Rejects loudly (exit 1) rather than recording a value the downstream query would never see.
const OUTCOME_VALUES = ['accepted', 'edited', 'rejected', 'abandoned'];
function validOutcome(raw) {
  if (raw === undefined) return undefined;
  if (!OUTCOME_VALUES.includes(raw)) {
    console.error(`--outcome must be one of ${OUTCOME_VALUES.join('|')} (got: ${raw})`);
    process.exit(1);
  }
  return raw;
}

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
            `Claude session: ${args.skill && args.skill !== 'none' ? args.skill : 'interactive'}`,
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
        await emitEvent(pool, {
          event_type: 'session-start',
          bead_id: id,
          summary: `session started: ${args.skill && args.skill !== 'none' ? args.skill : 'interactive'}`,
          payload: { session_id: args['session-id'] ?? '', skill: args.skill ?? '' },
        });
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
        if (args.skill) {
          labels.skill_invoked = args.skill;
        }

        const updateFields = ['labels = ?', 'updated_at = ?'];
        const updateParams = [JSON.stringify(labels), new Date().toISOString()];

        // Update title when skill is set (upgrades "interactive" → skill name)
        if (args.skill) {
          updateFields.push('title = ?');
          updateParams.push(`Claude session: ${args.skill}`);
        }

        updateParams.push(bead.id);
        await pool.execute(
          `UPDATE beads SET ${updateFields.join(', ')} WHERE id = ?`,
          updateParams,
        );
        await emitEvent(pool, {
          event_type: 'session-update',
          bead_id: bead.id,
          summary: `session updated${args.repos ? `: +${args.repos}` : ''}`,
          payload: { repos: args.repos ?? '', pr_count: args['pr-count'] ?? '', skill: args.skill ?? '' },
        });
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
        await emitEvent(pool, {
          event_type: 'session-close',
          bead_id: beads[0].id,
          summary: 'session closed',
        });
        await doltCommit(pool, `session:close ${beads[0].id}`);
        console.log(JSON.stringify({ id: beads[0].id, status: 'closed' }));
        break;
      }

      case 'task-done': {
        const id = `${args.prefix ?? 'hq'}-task-${crypto.randomBytes(4).toString('hex')}`;
        const now = new Date().toISOString();
        // S18: optional human verdict on the output this task produced (audit I2).
        const outcome = validOutcome(args.outcome);
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
            JSON.stringify({
              repo: args.repo ?? '',
              session_id: args['session-id'] ?? '',
              ...(outcome ? { outcome } : {}),
            }),
            JSON.stringify(refs),
            now, now, now,
          ],
        );
        await emitEvent(pool, {
          event_type: 'task-done',
          bead_id: id,
          summary: args.title ?? 'task completed',
          payload: {
            repo: args.repo ?? '',
            session_id: args['session-id'] ?? '',
            ...(outcome ? { outcome } : {}),
          },
        });
        await doltCommit(pool, `task:done ${id}`);
        console.log(JSON.stringify({ id, status: 'created' }));
        break;
      }

      case 'bead-close': {
        // S18: outcome capture (audit I2) — close an EXISTING bead where a human touched the
        // agent's output, recording the verdict. Distinct from task-done, which mints a new,
        // already-closed bead; bead-close flips one that is already on the board.
        const beadId = args['bead-id'];
        if (!beadId) { console.error('--bead-id required'); process.exit(1); }
        const outcome = validOutcome(args.outcome);

        const [rows] = await pool.execute('SELECT id, labels FROM beads WHERE id = ?', [beadId]);
        if (rows.length === 0) { console.error(`Bead not found: ${beadId}`); process.exit(1); }
        const labels = typeof rows[0].labels === 'string' ? JSON.parse(rows[0].labels) : (rows[0].labels ?? {});
        if (outcome) labels.outcome = outcome;

        const now = new Date().toISOString();
        await pool.execute(
          "UPDATE beads SET status = 'closed', closed_at = ?, updated_at = ?, labels = ? WHERE id = ?",
          [now, now, JSON.stringify(labels), beadId],
        );
        await emitEvent(pool, {
          event_type: 'bead-close',
          bead_id: beadId,
          summary: `closed${outcome ? ` (${outcome})` : ''}`,
          payload: { ...(outcome ? { outcome } : {}) },
        });
        await doltCommit(pool, `bead:close ${beadId}`);
        console.log(JSON.stringify({ id: beadId, status: 'closed', ...(outcome ? { outcome } : {}) }));
        break;
      }

      case 'bead-quarantine': {
        // S18 (audit I2, plan H5/F2): park a suspect bead WITHOUT deleting anything —
        // quarantine ≠ delete. Flips labels.queue to 'quarantined' (the same lane idiom
        // queue-sweep uses) so no queue lane offers it again; status, history, and every
        // other label stay intact. Optional --outcome records the human verdict,
        // --reason the why. Reversible by hand (queue-post --bead-id re-posts it).
        const beadId = args['bead-id'];
        if (!beadId) { console.error('--bead-id required'); process.exit(1); }
        const outcome = validOutcome(args.outcome);

        const [rows] = await pool.execute('SELECT id, labels FROM beads WHERE id = ?', [beadId]);
        if (rows.length === 0) { console.error(`Bead not found: ${beadId}`); process.exit(1); }
        const labels = typeof rows[0].labels === 'string' ? JSON.parse(rows[0].labels) : (rows[0].labels ?? {});

        const now = new Date().toISOString();
        labels.queue = 'quarantined';
        labels.quarantined_at = now;
        if (args.reason) labels.quarantine_reason = args.reason;
        if (outcome) labels.outcome = outcome;

        await pool.execute(
          'UPDATE beads SET labels = ?, updated_at = ? WHERE id = ?',
          [JSON.stringify(labels), now, beadId],
        );
        await emitEvent(pool, {
          event_type: 'bead-quarantine',
          bead_id: beadId,
          summary: `quarantined${args.reason ? `: ${args.reason}` : ''}${outcome ? ` (${outcome})` : ''}`,
          payload: {
            reason: args.reason ?? '',
            ...(outcome ? { outcome } : {}),
          },
        });
        await doltCommit(pool, `bead:quarantine ${beadId}`);
        console.log(JSON.stringify({ id: beadId, status: 'quarantined', ...(outcome ? { outcome } : {}) }));
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
              // S14 shadow verification record (day-runner) — optional JSON: {tests, success_criterion}
              ...(args.checks ? { checks: safeParseChecks(args.checks) } : {}),
              // S21 trace identity (shadow) — echoes the queue bead's trace_id when the runner carries it
              ...(args['trace-id'] ? { trace_id: args['trace-id'] } : {}),
            }),
            JSON.stringify(refs),
            now, now,
          ],
        );
        // Bump session pr_count in the SAME working set so the PR bead, the session update,
        // and the pr-created event all land in ONE DOLT_COMMIT (S1 C2 — no second commit).
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
          }
        }

        await emitEvent(pool, {
          event_type: 'pr-created',
          bead_id: id,
          summary: `PR #${args.pr ?? '?'} on ${args.repo ?? 'unknown'}`,
          payload: {
            repo: args.repo ?? '', pr_number: args.pr ?? '', session_id: args['session-id'] ?? '',
            ...(args.checks ? { checks: safeParseChecks(args.checks) } : {}),
            ...(args['trace-id'] ? { trace_id: args['trace-id'] } : {}),
          },
        });
        await doltCommit(pool, `pr:created ${id}`);

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
        await emitEvent(pool, {
          event_type: 'task-create',
          bead_id: id,
          summary: args.title ?? 'task created',
          payload: { repo: args.repo ?? '', convoy_id: args['convoy-id'] ?? '', session_id: args['session-id'] ?? '' },
        });
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

        await emitEvent(pool, {
          event_type: 'convoy-create',
          bead_id: id,
          summary: args.title ?? 'convoy created',
          payload: { session_bead_id: args['session-bead-id'] ?? '' },
        });
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
        await emitEvent(pool, {
          event_type: 'convoy-add-slot',
          bead_id: convoyId,
          summary: `slot added: ${beadId}`,
          payload: { slot_bead_id: beadId, agent_id: args['agent-id'] ?? '', slot_count: slots.length },
        });
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
        await emitEvent(pool, {
          event_type: 'convoy-update-slot',
          bead_id: convoyId,
          summary: `slot ${beadId} → ${slotStatus}`,
          payload: { slot_bead_id: beadId, slot_status: slotStatus },
        });
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
        await emitEvent(pool, {
          event_type: 'convoy-finalize',
          bead_id: convoyId,
          summary: `convoy → ${finalStatus}`,
          payload: { final_status: finalStatus, slot_count: slots.length },
        });
        await doltCommit(pool, `convoy:finalize ${convoyId} → ${finalStatus}`);
        console.log(JSON.stringify({ convoy_id: convoyId, final_status: finalStatus }));
        break;
      }

      case 'convoy-status': {
        const convoyId = args['convoy-id'];
        // If no --convoy-id, show all active convoys
        if (!convoyId) {
          const [rows] = await pool.execute(
            "SELECT id, title, status, labels, created_at, updated_at FROM beads WHERE type = 'convoy' AND status = 'live' ORDER BY created_at DESC",
          );
          if (rows.length === 0) {
            console.log('\n  No active convoys\n');
            break;
          }
          console.log('');
          for (const row of rows) {
            const labels = typeof row.labels === 'string' ? JSON.parse(row.labels) : row.labels;
            printConvoyStatus(row.id, row.title, labels);
          }
          break;
        }

        const [rows] = await pool.execute(
          'SELECT id, title, status, labels, created_at, updated_at, closed_at FROM beads WHERE id = ?',
          [convoyId],
        );
        if (rows.length === 0) { console.error('Convoy not found'); process.exit(1); }
        const row = rows[0];
        const labels = typeof row.labels === 'string' ? JSON.parse(row.labels) : row.labels;

        // Also fetch task bead titles for slot display
        const slots = JSON.parse(labels.slots || '[]');
        const beadIds = slots.map((s) => s.beadId);
        let taskTitles = {};
        if (beadIds.length > 0) {
          const placeholders = beadIds.map(() => '?').join(',');
          const [taskRows] = await pool.execute(
            `SELECT id, title FROM beads WHERE id IN (${placeholders})`,
            beadIds,
          );
          for (const t of taskRows) taskTitles[t.id] = t.title;
        }

        console.log('');
        printConvoyStatus(row.id, row.title, labels, taskTitles, row.status, row.closed_at);
        break;
      }

      case 'active-sessions': {
        const [rows] = await pool.execute(
          "SELECT id, title, labels, created_at FROM beads WHERE (type = 'session' OR type = 'agent') AND status = 'live' ORDER BY created_at DESC",
        );
        console.log(JSON.stringify({ sessions: rows }));
        break;
      }

      // ── Agent commands (A2/A3 bridge) ────────────────────────────────────

      case 'agent-create': {
        const role = args.role ?? 'worker';
        const app = args.app ?? 'core';
        const sessionId = args['session-id'] ?? '';
        const reportsTo = args['reports-to'] ?? '';
        const prefix = app.slice(0, 4).toLowerCase();

        // Check for an existing idle agent bead for this app+role
        const [existing] = await pool.execute(
          "SELECT id, labels FROM beads WHERE type = 'agent' AND status = 'live' AND JSON_EXTRACT(labels, '$.role') = ? AND JSON_EXTRACT(labels, '$.app') = ? AND JSON_EXTRACT(labels, '$.agent_status') = 'idle'",
          [role, app],
        );
        const existingBeads = existing;

        if (existingBeads.length > 0) {
          // Resume existing agent
          const bead = existingBeads[0];
          const labels = typeof bead.labels === 'string' ? JSON.parse(bead.labels) : bead.labels;
          labels.agent_status = 'active';
          labels.session_id = sessionId;
          const now = new Date().toISOString();
          await pool.execute(
            'UPDATE beads SET labels = ?, updated_at = ? WHERE id = ?',
            [JSON.stringify(labels), now, bead.id],
          );
          await emitEvent(pool, {
            event_type: 'agent-resume',
            bead_id: bead.id,
            // actor = the agent's own bead id (not 'claude-code') so liveness can GROUP BY actor (S2).
            actor: bead.id,
            summary: `${role} agent resumed: ${app}`,
            payload: { role, app, session_id: sessionId },
          });
          await doltCommit(pool, `agent:resume ${bead.id}`);
          console.log(JSON.stringify({ id: bead.id, status: 'resumed', role, app }));
        } else {
          // Create new agent bead
          const suffix = reportsTo ? `-${crypto.randomBytes(2).toString('hex')}` : '';
          const id = `${prefix}-agent-${role}${suffix}`;
          const now = new Date().toISOString();
          const labels = {
            role,
            app,
            agent_status: 'active',
            session_id: sessionId,
          };
          if (reportsTo) labels.reports_to = reportsTo;

          await pool.execute(
            `INSERT INTO beads (id, type, status, title, body, labels, actor, refs, created_at, updated_at)
             VALUES (?, 'agent', 'live', ?, '', ?, 'claude-code', '[]', ?, ?)`,
            [
              id,
              `${role} agent: ${app}`,
              JSON.stringify(labels),
              now,
              now,
            ],
          );
          await emitEvent(pool, {
            event_type: 'agent-create',
            bead_id: id,
            // actor = the agent's own bead id (not 'claude-code') so liveness can GROUP BY actor (S2).
            actor: id,
            summary: `${role} agent created: ${app}`,
            payload: { role, app, session_id: sessionId, reports_to: reportsTo || undefined },
          });
          await doltCommit(pool, `agent:create ${id}`);
          console.log(JSON.stringify({ id, status: 'created', role, app }));
        }
        break;
      }

      case 'agent-idle': {
        const agentId = args['agent-id'];
        if (!agentId) { console.error('--agent-id required'); process.exit(1); }

        const [rows] = await pool.execute(
          'SELECT id, labels FROM beads WHERE id = ? AND type = ?',
          [agentId, 'agent'],
        );
        const beads = rows;
        if (beads.length === 0) { console.error(`Agent bead not found: ${agentId}`); process.exit(1); }

        const bead = beads[0];
        const labels = typeof bead.labels === 'string' ? JSON.parse(bead.labels) : bead.labels;
        labels.agent_status = 'idle';
        labels.last_session = new Date().toISOString();

        const now = new Date().toISOString();
        await pool.execute(
          'UPDATE beads SET labels = ?, updated_at = ? WHERE id = ?',
          [JSON.stringify(labels), now, agentId],
        );
        await emitEvent(pool, {
          event_type: 'agent-idle',
          bead_id: agentId,
          // actor = the agent's own bead id (not 'claude-code') so liveness can GROUP BY actor (S2).
          actor: agentId,
          summary: 'agent idle',
        });
        await doltCommit(pool, `agent:idle ${agentId}`);
        console.log(JSON.stringify({ id: agentId, status: 'idle' }));
        break;
      }

      case 'agent-sling': {
        const agentId = args['agent-id'];
        const beadId = args['bead-id'];
        if (!agentId || !beadId) { console.error('--agent-id and --bead-id required'); process.exit(1); }

        const [rows] = await pool.execute(
          'SELECT id, labels FROM beads WHERE id = ? AND type = ?',
          [agentId, 'agent'],
        );
        const beads = rows;
        if (beads.length === 0) { console.error(`Agent bead not found: ${agentId}`); process.exit(1); }

        const bead = beads[0];
        const labels = typeof bead.labels === 'string' ? JSON.parse(bead.labels) : bead.labels;
        labels.hook = beadId;
        labels.hook_slung_at = new Date().toISOString();
        labels.hook_approval_status = 'none';

        const now = new Date().toISOString();
        await pool.execute(
          'UPDATE beads SET hook = ?, labels = ?, updated_at = ? WHERE id = ?',
          [beadId, JSON.stringify(labels), now, agentId],
        );
        await emitEvent(pool, {
          event_type: 'agent-sling',
          bead_id: agentId,
          // actor = the agent's own bead id (not 'claude-code') so liveness can GROUP BY actor (S2).
          actor: agentId,
          summary: `slung ${beadId}`,
          payload: { hook_bead_id: beadId },
        });
        await doltCommit(pool, `agent:sling ${beadId} → ${agentId}`);
        console.log(JSON.stringify({ agentId, beadId, status: 'slung' }));
        break;
      }

      case 'queue-post': {
        // Post a task to the unassigned queue (ADR-0002, coordination rollout S3). Either mint a
        // new posted task, or promote an existing one with --bead-id. Sets the reserved queue
        // labels (see RESERVED_QUEUE_LABELS at top); claiming is S4 (queue-claim). Read-only for
        // the cockpit — only this verb writes the queue.
        const ttlDays = QUEUE_KIND_TTL_DAYS[args.kind] ? args.kind : 'm';
        const kind = ttlDays; // 's' | 'm' | 'l'
        const autonomy = QUEUE_AUTONOMY.includes(args.autonomy) ? args.autonomy : 'human_only';
        const now = new Date();
        const nowIso = now.toISOString();
        const expiresAt = new Date(now.getTime() + QUEUE_KIND_TTL_DAYS[kind] * 86_400_000).toISOString();
        // Roadmap-dispatch labels (see RESERVED_QUEUE_LABELS): only set when provided, so
        // hand-posted tasks stay unchanged.
        const roadmapLabels = {};
        if (args['roadmap-ref']) roadmapLabels.roadmap_ref = args['roadmap-ref'];
        if (args.advances) roadmapLabels.advances = args.advances;
        if (args['autonomy-gate']) roadmapLabels.autonomy_gate = args['autonomy-gate'];
        if (args.why) roadmapLabels.why = args.why;
        // S21 trace identity (SHADOW): correlation id threaded queue → session → PR. Accept
        // --trace-id (roadmap-compile mints one for NEW posts) or mint here so every posted
        // task carries one. Label key stays `trace_id` (OTel gen_ai trace-correlation naming).
        const traceId = args['trace-id'] || crypto.randomUUID();

        if (args['bead-id']) {
          // Promote an existing task onto the queue.
          const beadId = args['bead-id'];
          const [rows] = await pool.execute('SELECT id, labels FROM beads WHERE id = ?', [beadId]);
          if (rows.length === 0) { console.error(`Bead not found: ${beadId}`); process.exit(1); }
          const labels = typeof rows[0].labels === 'string' ? JSON.parse(rows[0].labels) : (rows[0].labels ?? {});
          labels.queue = 'available';
          labels.kind = kind;
          labels.autonomy = autonomy;
          labels.posted_at = nowIso;
          labels.expires_at = expiresAt;
          Object.assign(labels, roadmapLabels);
          // Idempotence: an already-traced bead keeps its trace_id unless --trace-id overrides.
          labels.trace_id = args['trace-id'] || labels.trace_id || traceId;
          await pool.execute('UPDATE beads SET labels = ?, updated_at = ? WHERE id = ?', [JSON.stringify(labels), nowIso, beadId]);
          await emitEvent(pool, {
            event_type: 'queue-post',
            bead_id: beadId,
            summary: `posted ${beadId} to queue (${kind}/${autonomy})`,
            payload: { queue: 'available', kind, autonomy, expires_at: expiresAt, promoted: true, trace_id: labels.trace_id },
          });
          await doltCommit(pool, `queue:post ${beadId}`);
          console.log(JSON.stringify({ id: beadId, status: 'posted', queue: 'available', kind, autonomy }));
          break;
        }

        // Mint a new posted task — status='created', hook NULL (unassigned).
        const id = `${args.prefix ?? (args.repo ? args.repo.slice(0, 4) : 'hq')}-task-${crypto.randomBytes(4).toString('hex')}`;
        const labels = {
          queue: 'available',
          kind,
          autonomy,
          repo: args.repo ?? '',
          posted_at: nowIso,
          expires_at: expiresAt,
          trace_id: traceId,
          ...roadmapLabels,
        };
        await pool.execute(
          `INSERT INTO beads (id, type, status, title, body, labels, actor, refs, created_at, updated_at)
           VALUES (?, 'task', 'created', ?, '', ?, 'claude-code', '[]', ?, ?)`,
          [id, args.title ?? 'Unassigned task', JSON.stringify(labels), nowIso, nowIso],
        );
        await emitEvent(pool, {
          event_type: 'queue-post',
          bead_id: id,
          summary: args.title ?? 'posted to queue',
          payload: { queue: 'available', kind, autonomy, expires_at: expiresAt, repo: args.repo ?? '', trace_id: traceId },
        });
        await doltCommit(pool, `queue:post ${id}`);
        console.log(JSON.stringify({ id, status: 'posted', queue: 'available', kind, autonomy }));
        break;
      }

      case 'queue-claim': {
        // Claim an unassigned-queue task with a self-expiring lease (ADR-0002, coordination S4).
        // ONE atomic conditional UPDATE (compare-and-swap on the queue lane) — affectedRows===0
        // means the claim was lost (already claimed, expired, or autonomy-ineligible). The
        // queue=available marker is the authoritative gate (not status, since a promoted task is
        // 'live' not 'created'). Humans bypass the autonomy gate; agents need agent_eligible|either.
        const beadId = args['bead-id'];
        if (!beadId) { console.error('--bead-id required'); process.exit(1); }
        const isHuman = !args.agent; // default human unless --agent
        const kind = isHuman ? 'human' : 'agent';
        const claimer = args.claimer ?? kind;
        const now = new Date();
        const nowIso = now.toISOString();
        const leaseUntil = new Date(now.getTime() + QUEUE_LEASE_MS[kind]).toISOString();

        const [res] = await pool.execute(
          `UPDATE beads
              SET hook = ?, status = 'live',
                  labels = JSON_SET(labels, '$.queue', 'claimed', '$.claimed_at', ?,
                                    '$.claimed_by_kind', ?, '$.lease_until', ?),
                  updated_at = ?
            WHERE id = ?
              AND JSON_UNQUOTE(JSON_EXTRACT(labels, '$.queue')) = 'available'
              AND JSON_UNQUOTE(JSON_EXTRACT(labels, '$.expires_at')) > ?
              AND ( JSON_UNQUOTE(JSON_EXTRACT(labels, '$.autonomy')) IN ('agent_eligible', 'either')
                    OR ? = 1 )`,
          [claimer, nowIso, kind, leaseUntil, nowIso, beadId, nowIso, isHuman ? 1 : 0],
        );
        if (!res.affectedRows) {
          console.log(JSON.stringify({ id: beadId, status: 'lost' }));
          break;
        }
        await emitEvent(pool, {
          event_type: 'queue-claim',
          bead_id: beadId,
          actor: claimer,
          summary: `claimed by ${claimer} (${kind})`,
          payload: { claimer, kind, lease_until: leaseUntil },
        });
        await doltCommit(pool, `queue:claim ${beadId} → ${claimer}`);
        console.log(JSON.stringify({ id: beadId, status: 'claimed', hook: claimer, kind, lease_until: leaseUntil }));
        break;
      }

      case 'queue-renew': {
        // Cheap CAS bump of lease_until — only the current holder may renew (heartbeat).
        const beadId = args['bead-id'];
        if (!beadId) { console.error('--bead-id required'); process.exit(1); }
        const claimer = args.claimer;
        if (!claimer) { console.error('--claimer required'); process.exit(1); }
        const kind = args.agent ? 'agent' : 'human';
        const now = new Date();
        const nowIso = now.toISOString();
        const leaseUntil = new Date(now.getTime() + QUEUE_LEASE_MS[kind]).toISOString();

        const [res] = await pool.execute(
          `UPDATE beads SET labels = JSON_SET(labels, '$.lease_until', ?), updated_at = ?
            WHERE id = ? AND hook = ?
              AND JSON_UNQUOTE(JSON_EXTRACT(labels, '$.queue')) = 'claimed'`,
          [leaseUntil, nowIso, beadId, claimer],
        );
        if (!res.affectedRows) {
          console.log(JSON.stringify({ id: beadId, status: 'lost' }));
          break;
        }
        await emitEvent(pool, {
          event_type: 'queue-renew',
          bead_id: beadId,
          actor: claimer,
          summary: `lease renewed by ${claimer}`,
          payload: { lease_until: leaseUntil },
        });
        await doltCommit(pool, `queue:renew ${beadId}`);
        console.log(JSON.stringify({ id: beadId, status: 'renewed', lease_until: leaseUntil }));
        break;
      }

      case 'queue-sweep': {
        // Self-healing: return dead-lease claims to the pool, and flip rotted posts to expired.
        // The dead-claim safety valve — agent liveness is unreliable, so a crashed claimant must
        // not lock work forever (ADR-0002). Run from frame-standup / cron.
        const nowIso = new Date().toISOString();
        const [reclaim] = await pool.execute(
          `UPDATE beads SET hook = NULL, status = 'created',
                  labels = JSON_SET(labels, '$.queue', 'available')
            WHERE type = 'task'
              AND JSON_UNQUOTE(JSON_EXTRACT(labels, '$.queue')) = 'claimed'
              AND JSON_UNQUOTE(JSON_EXTRACT(labels, '$.lease_until')) < ?`,
          [nowIso],
        );
        const [expire] = await pool.execute(
          `UPDATE beads SET labels = JSON_SET(labels, '$.queue', 'expired')
            WHERE type = 'task'
              AND JSON_UNQUOTE(JSON_EXTRACT(labels, '$.queue')) = 'available'
              AND JSON_UNQUOTE(JSON_EXTRACT(labels, '$.expires_at')) < ?`,
          [nowIso],
        );
        const reclaimed = reclaim.affectedRows ?? 0;
        const expired = expire.affectedRows ?? 0;
        if (reclaimed + expired > 0) {
          await emitEvent(pool, {
            event_type: 'queue-sweep',
            bead_id: null,
            summary: `swept ${reclaimed} dead-lease → available, ${expired} → expired`,
            payload: { reclaimed, expired },
          });
          await doltCommit(pool, `queue:sweep ${reclaimed}+${expired}`);
        }
        console.log(JSON.stringify({ status: 'swept', reclaimed, expired }));
        break;
      }

      default:
        console.error(`Unknown command: ${command}`);
        console.error('Usage: bead-emit.mjs <session-start|session-update|session-close|task-done|bead-close|bead-quarantine|task-create|pr-created|convoy-create|convoy-add-slot|convoy-update-slot|convoy-finalize|queue-post|queue-claim|queue-renew|queue-sweep|active-sessions>');
        console.error('  task-done|bead-close|bead-quarantine accept --outcome=accepted|edited|rejected|abandoned (S18 outcome capture)');
        process.exit(1);
    }
  } finally {
    await pool.end();
  }
}

function printConvoyStatus(id, title, labels, taskTitles = {}, beadStatus = 'live', closedAt = null) {
  const slots = JSON.parse(labels.slots || '[]');
  const counts = { done: 0, active: 0, pending: 0, failed: 0 };
  for (const s of slots) counts[s.status] = (counts[s.status] || 0) + 1;
  const total = slots.length;
  const pct = total > 0 ? Math.round((counts.done / total) * 100) : 0;
  const barLen = 30;
  const filled = Math.round((counts.done / Math.max(total, 1)) * barLen);
  const active = Math.round((counts.active / Math.max(total, 1)) * barLen);
  const bar = '█'.repeat(filled) + '▓'.repeat(active) + '░'.repeat(Math.max(0, barLen - filled - active));

  const status = labels.convoy_status || 'unknown';
  const statusIcon = { forming: '○', active: '◑', completed: '●', failed: '✗' }[status] || '?';

  console.log(`  ${statusIcon}  ${title}`);
  console.log(`     ${id}${beadStatus === 'closed' ? ' (closed)' : ''}`);
  console.log(`     [${bar}] ${counts.done}/${total} done  ${pct}%`);
  if (counts.active > 0) console.log(`     ▶ ${counts.active} running`);
  if (counts.pending > 0) console.log(`     ⏳ ${counts.pending} pending`);
  if (counts.failed > 0) console.log(`     ✗ ${counts.failed} failed`);

  if (slots.length > 0 && Object.keys(taskTitles).length > 0) {
    console.log('     ───');
    for (const s of slots) {
      const icon = { done: '✓', active: '▶', pending: '·', failed: '✗' }[s.status] || '?';
      const name = taskTitles[s.beadId] || s.beadId;
      const agent = s.agentId ? ` (${s.agentId})` : '';
      console.log(`     ${icon}  ${name}${agent}`);
    }
  }
  console.log('');
}

async function doltCommit(pool, message) {
  try {
    await pool.execute("CALL DOLT_ADD('-A')");
    await pool.execute("CALL DOLT_COMMIT('-m', ?)", [message]);
  } catch { /* no changes */ }
}

/**
 * Append ONE row to bead_events in the current working set — never commits on its own.
 *
 * Invariant (S1 C2 — transaction-integrity): call this immediately BEFORE the verb's single
 * `doltCommit()`. `DOLT_ADD('-A')` then stages the bead mutation AND this event together, so
 * both land in the SAME `DOLT_COMMIT`. Calling DOLT_COMMIT here — or running emitEvent after
 * the verb's commit — would split the event into a second commit and break parity. Don't.
 *
 * Errors propagate (not swallowed): a bead committed without its event is a measurement gap,
 * and this is measure-first instrumentation — fail loud rather than commit a silent half-write.
 */
async function emitEvent(pool, { event_type, bead_id, actor = 'claude-code', summary = '', payload = null }) {
  await pool.execute(
    `INSERT INTO bead_events (event_type, bead_id, actor, summary, timestamp, payload)
     VALUES (?, ?, ?, ?, NOW(), ?)`,
    [event_type, bead_id, actor, summary, payload == null ? null : JSON.stringify(payload)],
  );
}

run().catch((err) => {
  console.error('bead-emit error:', err.message);
  process.exit(1);
});
