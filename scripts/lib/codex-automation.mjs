import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { parse as parseToml } from 'smol-toml';

export const MISSED_GRACE_MS = 90 * 60 * 1000;
const CADENCE_MS = { daily: 86400000, weekly: 7 * 86400000 };

// Observed Codex schema uses epoch milliseconds, not seconds or date strings.
function isEpochMs(value) {
  return Number.isSafeInteger(value) && value >= Date.UTC(2000, 0, 1) && value < Date.UTC(2100, 0, 1);
}

function resolveRef(ref, core, home) {
  if (ref.startsWith('~/')) return path.join(home, ref.slice(2));
  return path.isAbsolute(ref) ? ref : path.resolve(core, ref);
}

function readTomlFields(file) {
  return parseToml(readFileSync(file, 'utf8'));
}

function sqliteRows(db, query) {
  return JSON.parse(execFileSync('sqlite3', ['-readonly', '-json', db, query], {
    encoding: 'utf8', timeout: 3000, stdio: ['ignore', 'pipe', 'ignore'],
  }) || '[]');
}

/** Read-only Codex scheduler projection. No prompt, inbox text, or private finding is selected. */
export function inspectCodexAutomation(loop, core, home = os.homedir(), now = Date.now()) {
  const id = String(loop.automation_id || loop.slug || '');
  const base = { id, scheduler: 'codex', source: 'Codex local automation database' };
  if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) {
    return { ...base, configured: 'unverifiable', firing: 'unknown', reason: 'invalid automation id' };
  }
  const expectedRef = `~/.codex/automations/${id}/automation.toml`;
  if (loop.trigger_ref !== expectedRef) {
    return { ...base, configured: 'mismatch', firing: 'unknown', reason: `trigger_ref must be ${expectedRef}` };
  }
  const file = resolveRef(loop.trigger_ref, core, home);
  if (!existsSync(file)) {
    return { ...base, configured: 'missing', firing: 'unknown', reason: `automation TOML absent: ${expectedRef}` };
  }
  let toml;
  try { toml = readTomlFields(file); }
  catch { return { ...base, configured: 'unverifiable', firing: 'unknown', reason: 'automation TOML unreadable or malformed' }; }
  if (toml.id !== id || toml.kind !== 'heartbeat' || toml.rrule !== loop.rrule ||
      (loop.target_thread_id && toml.target_thread_id !== loop.target_thread_id)) {
    return { ...base, configured: 'mismatch', firing: 'unknown', reason: 'automation TOML identity, kind, cadence, or target differs from registry' };
  }
  if (toml.status !== 'ACTIVE') {
    return { ...base, configured: 'disabled', firing: 'disabled', reason: `automation TOML status: ${toml.status || 'missing'}` };
  }
  // Observed local filename; alternate CODEX_HOME locations are not qualified by this adapter.
  const db = path.join(home, '.codex', 'sqlite', 'codex-dev.db');
  if (!existsSync(db)) {
    return { ...base, configured: 'unverifiable', firing: 'unknown', reason: 'Codex run database absent: ~/.codex/sqlite/codex-dev.db' };
  }
  let configRows;
  let runRows;
  try {
    const quotedId = `'${id}'`;
    configRows = sqliteRows(db, `SELECT id, kind, status, rrule, target_thread_id, next_run_at, last_run_at, created_at FROM automations WHERE id = ${quotedId}`);
    runRows = sqliteRows(db, `SELECT thread_id, status, created_at, updated_at FROM automation_runs WHERE automation_id = ${quotedId} ORDER BY created_at DESC LIMIT 1`);
  } catch {
    return { ...base, configured: 'unverifiable', firing: 'unknown', reason: 'Codex run database inaccessible or schema unavailable' };
  }
  const cfg = configRows[0];
  if (!cfg) return { ...base, configured: 'missing', firing: 'unknown', reason: 'automation absent from Codex database' };
  if (cfg.id !== id || cfg.kind !== toml.kind || cfg.rrule !== toml.rrule ||
      cfg.target_thread_id !== toml.target_thread_id) {
    return { ...base, configured: 'mismatch', firing: 'unknown', reason: 'Codex database and TOML disagree' };
  }
  if (cfg.status !== 'ACTIVE') {
    return { ...base, configured: 'disabled', firing: 'disabled', reason: `Codex database status: ${cfg.status}` };
  }
  if (!isEpochMs(cfg.created_at) ||
      (cfg.next_run_at !== null && !isEpochMs(cfg.next_run_at)) ||
      (cfg.last_run_at !== null && !isEpochMs(cfg.last_run_at))) {
    return { ...base, configured: 'unverifiable', firing: 'unknown', reason: 'invalid Codex schedule timestamp; expected epoch milliseconds' };
  }
  const schedule = {
    rrule: cfg.rrule,
    targetThreadId: cfg.target_thread_id,
    nextRunAt: cfg.next_run_at ? new Date(cfg.next_run_at).toISOString() : undefined,
  };
  const run = runRows[0];
  if (!run) {
    const missed = Number.isFinite(cfg.next_run_at) && now > cfg.next_run_at + MISSED_GRACE_MS;
    const oldEmptyHistory = CADENCE_MS[loop.cadence] && now > cfg.created_at + CADENCE_MS[loop.cadence] + MISSED_GRACE_MS;
    return { ...base, configured: 'configured', firing: missed ? 'missed' : 'never-fired', schedule,
      warning: oldEmptyHistory ? 'no run history after declared cadence plus grace; prior pauses and retention are unknown' : undefined,
      reason: missed ? 'scheduled occurrence overdue with no Codex run row' : 'no Codex run row yet' };
  }
  if (!isEpochMs(run.created_at) || !isEpochMs(run.updated_at) || run.updated_at < run.created_at) {
    return { ...base, configured: 'unverifiable', firing: 'unknown', reason: 'invalid Codex run timestamp; expected epoch milliseconds' };
  }
  // Provisional aliases, to be qualified against the first real run; unknown remains unknown.
  const status = String(run.status).toLowerCase();
  const firing = ['completed', 'complete', 'success', 'succeeded'].includes(status) ? 'succeeded'
    : ['failed', 'error', 'errored'].includes(status) ? 'failed'
      : ['pending', 'running', 'in_progress'].includes(status) ? 'running' : 'unknown';
  return { ...base, configured: 'configured', firing, schedule,
    receipt: { threadId: run.thread_id, status: run.status, observedAt: new Date(run.created_at).toISOString(),
      updatedAt: new Date(run.updated_at).toISOString() },
    output: 'unverified',
    reason: firing === 'unknown' ? `unrecognized Codex run status: ${run.status}` : undefined };
}
