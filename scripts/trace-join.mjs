#!/usr/bin/env node
/**
 * trace-join.mjs — S21 trace-identity join demo (H1 exit-gate evidence).
 *
 * Usage: node scripts/trace-join.mjs <trace_id>
 *
 * READ-ONLY: queries the Dolt bead store for every bead and bead_event carrying
 * <trace_id> (labels.trace_id / payload.trace_id) and prints the join chain
 *
 *   queue-post → claim → session → PR
 *
 * proving one slice is traceable prompt → PR end-to-end. SHADOW discipline: this
 * script is the only consumer of trace_id, and it only reads — a missing link is
 * reported, never an error. Field name follows OTel gen_ai trace-correlation
 * vocabulary (stays `trace_id`).
 */
import mysql from 'mysql2/promise';

const DOLT_PORT = parseInt(process.env.DOLT_PORT ?? '3307', 10);
const DB = '.beads-dolt';

const traceId = process.argv[2];
if (!traceId) {
  console.error('Usage: node scripts/trace-join.mjs <trace_id>');
  process.exit(1);
}

function labelsOf(row) {
  return typeof row.labels === 'string' ? JSON.parse(row.labels) : (row.labels ?? {});
}

async function main() {
  const pool = mysql.createPool({
    host: '127.0.0.1', port: DOLT_PORT, user: 'root', database: DB, connectionLimit: 1,
  });

  let beads, events;
  try {
    [beads] = await pool.query(
      `SELECT id, type, status, title, hook, labels, refs, created_at
         FROM beads
        WHERE JSON_UNQUOTE(JSON_EXTRACT(labels, '$.trace_id')) = ?
        ORDER BY created_at`,
      [traceId],
    );
    [events] = await pool.query(
      `SELECT event_type, bead_id, actor, summary, timestamp
         FROM bead_events
        WHERE JSON_UNQUOTE(JSON_EXTRACT(payload, '$.trace_id')) = ?
        ORDER BY timestamp`,
      [traceId],
    );
  } catch (err) {
    console.error(`trace-join: cannot reach the Dolt bead store on 127.0.0.1:${DOLT_PORT} (${err.message}).`);
    console.error('Start it (dolt sql-server) or set DOLT_PORT, then re-run.');
    await pool.end().catch(() => {});
    process.exit(1);
  }

  const queueBead = beads.find((b) => b.type === 'task') ?? null;
  const prBeads = beads.filter((b) => b.type === 'pr');

  console.log(`# trace-join ${traceId}`);
  console.log('');

  if (!queueBead && !prBeads.length && !events.length) {
    console.log('No bead or bead_event carries this trace_id.');
    await pool.end();
    process.exit(1);
  }

  // 1. queue-post
  if (queueBead) {
    const l = labelsOf(queueBead);
    console.log(`1. queue-post  ${queueBead.id} — "${queueBead.title}"`);
    console.log(`               posted_at=${l.posted_at ?? '?'}${l.roadmap_ref ? ` roadmap_ref=${l.roadmap_ref}` : ''}${l.repo ? ` repo=${l.repo}` : ''}`);
  } else {
    console.log('1. queue-post  — no queue bead carries this trace_id');
  }

  // 2. claim
  const l = queueBead ? labelsOf(queueBead) : {};
  if (queueBead && (l.queue === 'claimed' || l.claimed_at)) {
    console.log(`2. claim       hook=${queueBead.hook ?? '?'} claimed_at=${l.claimed_at ?? '?'} (${l.claimed_by_kind ?? '?'})`);
  } else {
    console.log(`2. claim       — not claimed${queueBead ? ` (queue=${l.queue ?? 'unset'})` : ''}`);
  }

  // 3. session — joined via the pr bead's session_id / refs (session beads don't carry
  //    trace_id themselves; the day-runner threads it through TRACE_ID in the session env).
  let sessionLine = '3. session     — no session joined via a traced PR bead yet';
  for (const pr of prBeads) {
    const pl = labelsOf(pr);
    if (!pl.session_id) continue;
    const [sess] = await pool.query(
      "SELECT id, title, status FROM beads WHERE type = 'session' AND JSON_UNQUOTE(JSON_EXTRACT(labels, '$.session_id')) = ? LIMIT 1",
      [pl.session_id],
    );
    if (sess.length) {
      sessionLine = `3. session     ${sess[0].id} — "${sess[0].title}" (session_id=${pl.session_id}, ${sess[0].status})`;
      break;
    }
    sessionLine = `3. session     session_id=${pl.session_id} (no session bead found for it)`;
  }
  console.log(sessionLine);

  // 4. PR
  if (prBeads.length) {
    for (const pr of prBeads) {
      const pl = labelsOf(pr);
      const url = pl.repo && pl.pr_number ? `https://github.com/ojfbot/${pl.repo}/pull/${pl.pr_number}` : '(repo/pr unknown)';
      console.log(`4. pr          ${pr.id} — PR #${pl.pr_number ?? '?'} on ${pl.repo ?? '?'} → ${url}`);
    }
  } else {
    console.log('4. pr          — no pr bead carries this trace_id yet');
  }

  console.log('');
  console.log(`bead_events carrying this trace_id: ${events.length}`);
  for (const e of events) {
    console.log(`  - ${e.event_type} ${e.bead_id ?? ''} @ ${e.timestamp instanceof Date ? e.timestamp.toISOString() : e.timestamp} — ${e.summary}`);
  }

  await pool.end();
}

main().catch((err) => { console.error('trace-join error:', err.message); process.exit(1); });
