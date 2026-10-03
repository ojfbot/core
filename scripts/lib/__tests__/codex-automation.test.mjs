import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { inspectCodexAutomation } from '../codex-automation.mjs';

const id = 'selfco-vault-hygiene';
const thread = 'fixture-target-thread';
const rrule = 'FREQ=DAILY;BYHOUR=9;BYMINUTE=0';
const NOW = Date.parse('2026-10-03T14:00:00Z');
const loop = {
  slug: id, automation_id: id, trigger_ref: `~/.codex/automations/${id}/automation.toml`,
  rrule, cadence: 'daily',
};
let root;
let home;
let db;
let toml;

function sql(statement) { execFileSync('sqlite3', [db, statement]); }
function install(status = 'ACTIVE') {
  mkdirSync(path.dirname(toml), { recursive: true });
  writeFileSync(toml, `id = "${id}"\nkind = "heartbeat"\nstatus = "${status}"\nrrule = "${rrule}"\ntarget_thread_id = "${thread}"\n`);
  mkdirSync(path.dirname(db), { recursive: true });
  sql(`CREATE TABLE automations (id TEXT, kind TEXT, status TEXT, rrule TEXT, target_thread_id TEXT, next_run_at INTEGER, last_run_at INTEGER, created_at INTEGER); CREATE TABLE automation_runs (thread_id TEXT, automation_id TEXT, status TEXT, created_at INTEGER, updated_at INTEGER); INSERT INTO automations VALUES ('${id}', 'heartbeat', '${status}', '${rrule}', '${thread}', ${NOW + 60000}, NULL, ${NOW - 3600000});`);
}
function run(status, at = NOW - 60000) {
  sql(`INSERT INTO automation_runs VALUES ('run-1', '${id}', '${status}', ${at}, ${at + 1000});`);
}

beforeEach(() => {
  root = mkdtempSync(path.join(os.tmpdir(), 'codex-automation-'));
  home = path.join(root, 'home');
  db = path.join(home, '.codex', 'sqlite', 'codex-dev.db');
  toml = path.join(home, '.codex', 'automations', id, 'automation.toml');
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe('Codex automation receipt', () => {
  it.each(['--home', '--id'])('rejects a missing CLI value for %s before inspection', (flag) => {
    const script = new URL('../../codex-automation-status.mjs', import.meta.url);
    const result = spawnSync(process.execPath, [script.pathname, flag], { encoding: 'utf8' });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(`${flag} requires a value`);
    expect(result.stderr).not.toMatch(/TypeError|at file:/);
    expect(result.stdout).toBe('');
  });
  it.each(['NULL', `${NOW + 86400000}`])('warns on old empty run history independently of next_run_at: %s', (next) => {
    install();
    sql(`UPDATE automations SET created_at = ${NOW - 2 * 86400000}, next_run_at = ${next}`);
    expect(inspectCodexAutomation(loop, root, home, NOW)).toMatchObject({
      firing: 'never-fired', warning: expect.stringMatching(/no run history.*cadence/),
    });
  });

  it.each(['created_at', 'next_run_at', 'last_run_at'])('rejects malformed schedule timestamp %s', (field) => {
    install();
    sql(`UPDATE automations SET ${field} = 'not-a-date'`);
    expect(inspectCodexAutomation(loop, root, home, NOW)).toMatchObject({
      configured: 'unverifiable', firing: 'unknown', reason: expect.stringMatching(/timestamp/),
    });
  });

  it('does not disclose an absolute home in missing-file reasons', () => {
    expect(inspectCodexAutomation(loop, root, home, NOW).reason).not.toContain(home);
    install();
    rmSync(db);
    expect(inspectCodexAutomation(loop, root, home, NOW).reason).not.toContain(home);
  });
  it('reads literal TOML strings without mistaking prompt content for metadata', () => {
    install();
    writeFileSync(toml, readFileSync(toml, 'utf8').replaceAll('"', "'") + '\nprompt = """\nid = "private-prompt-content"\n"""\n');
    expect(inspectCodexAutomation(loop, root, home, NOW).configured).toBe('configured');
  });

  it('reports malformed TOML as unverifiable', () => {
    install();
    writeFileSync(toml, 'id = "unterminated\n');
    expect(inspectCodexAutomation(loop, root, home, NOW)).toMatchObject({
      configured: 'unverifiable', firing: 'unknown', reason: expect.stringMatching(/TOML/),
    });
  });

  it('reports a missing database column as unverifiable', () => {
    install();
    sql('ALTER TABLE automations DROP COLUMN rrule');
    expect(inspectCodexAutomation(loop, root, home, NOW)).toMatchObject({
      configured: 'unverifiable', firing: 'unknown', reason: expect.stringMatching(/schema/),
    });
  });
  it.each(['not-a-date', 1791035940, null])('reports malformed run timestamps as unverifiable: %s', (at) => {
    install();
    run('completed');
    sql(`UPDATE automation_runs SET created_at = ${at === null ? 'NULL' : `'${at}'`}`);
    expect(inspectCodexAutomation(loop, root, home, NOW)).toMatchObject({
      configured: 'unverifiable', firing: 'unknown', reason: expect.stringMatching(/timestamp/),
    });
  });
  it('distinguishes configured before first fire from a missed occurrence', () => {
    install();
    expect(inspectCodexAutomation(loop, root, home, NOW).firing).toBe('never-fired');
    expect(inspectCodexAutomation(loop, root, home, NOW + 2 * 3600000).firing).toBe('missed');
  });

  it('uses a scheduler run row for success or failure, independent of Selfco files', () => {
    install();
    run('completed');
    const success = inspectCodexAutomation(loop, root, home, NOW);
    expect(success.firing).toBe('succeeded');
    expect(success.receipt.threadId).toBe('run-1');
    expect(success.output).toBe('unverified');
    sql("UPDATE automation_runs SET status = 'failed' WHERE thread_id = 'run-1'");
    expect(inspectCodexAutomation(loop, root, home, NOW).firing).toBe('failed');
  });

  it('does not render a paused, missing, mismatched, or inaccessible automation live', () => {
    install('PAUSED');
    expect(inspectCodexAutomation(loop, root, home, NOW).configured).toBe('disabled');
    expect(inspectCodexAutomation({ ...loop, rrule: 'FREQ=HOURLY' }, root, home, NOW).configured).toBe('mismatch');
    rmSync(toml);
    expect(inspectCodexAutomation(loop, root, home, NOW).configured).toBe('missing');
    rmSync(db);
    install();
    rmSync(db);
    expect(inspectCodexAutomation(loop, root, home, NOW).configured).toBe('unverifiable');
  });
});
