#!/usr/bin/env node
/**
 * defects-lint.mjs — schema check + independent closure sweep for the defect ledger.
 *
 * The defect ledger (decisions/defects/) tracks BEHAVIORAL MISREPORTS: an artifact asserts
 * X, reality is not-X. This script is the INDEPENDENT half of the two-source contract that
 * every surviving loop in this fleet uses (see hooks/deviation-log.mjs,
 * reconcile-skill-acted.mjs): an agent files the report; this script decides its status by
 * running the report's own probes against reality. An agent never closes its own defect.
 *
 * That separation is the whole design. The bead-ledger closure loop (TD-006) was
 * self-report only — declared, never independently checked — and produced 28 open hooks
 * against 9 reports ever filed.
 *
 * Modes:
 *   (default)  validate frontmatter schema; print the open ledger
 *   --sweep    additionally run each non-terminal defect's probes and classify:
 *                still-broken       claim_probe exit 0  — the false claim is still there
 *                claim-gone         claim_probe exit !0 — repaired; eligible for close
 *                probe-error        the probe itself failed to run (never a close)
 *              Movement is appended to decisions/defects/defects-status.jsonl.
 *   --check    exit 1 on SCHEMA errors only (for CI). Sweep verdicts never gate.
 *   --apply    with --sweep, write status: verified-closed back to claim-gone files.
 *
 * SECURITY: --sweep executes the claim_probe/truth_probe shell strings from defect files.
 * Defect files are executable content. Operator-run against a local checkout by design;
 * deliberately not wired to CI on untrusted input. Review probes you did not write.
 *
 * Exit 0 in all modes except --check with schema errors. A measurement never blocks
 * (ADR-0086).
 *
 * Usage: node defects-lint.mjs [--core PATH] [--sweep] [--apply] [--check] [--format=summary]
 */
import { existsSync, readFileSync, readdirSync, appendFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parseFM } from './lib/northstar-fm.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

const CLASSES = new Set(['false-assertion', 'dead-mechanism', 'schema-drift', 'phantom-reference']);
const SEVERITIES = new Set(['high', 'medium', 'low']);
const STATUSES = new Set([
  'needs-confirmation', 'open', 'claimed', 'repaired', 'verified-closed', 'unreproducible',
]);
// LLM-sourced findings land here (decision #9). They are probed so a verifier has data,
// but are NEVER auto-closed — an unconfirmed finding closing itself would let a
// plausible-wrong report enter and leave the ledger without a human ever seeing it.
const UNCONFIRMED = new Set(['needs-confirmation']);
const DISPOSITIONS = new Set([
  'repair-doc', 'repair-mechanism', 'retire-mechanism', 'replicate-then-fix', 'needs-investigation',
]);
// Statuses the sweep still probes. Terminal ones are left alone.
const NON_TERMINAL = new Set(['needs-confirmation', 'open', 'claimed', 'repaired']);
const REQUIRED = ['slug', 'class', 'severity', 'status', 'disposition', 'location', 'claim', 'filed'];
const PROBE_TIMEOUT_MS = 30_000;

function parseFlags(argv) {
  const f = {
    core: path.resolve(HERE, '..'),
    sweep: false, apply: false, check: false, format: 'report',
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--sweep') f.sweep = true;
    else if (a === '--apply') f.apply = true;
    else if (a === '--check') f.check = true;
    else if (a === '--format=summary') f.format = 'summary';
    else if (a === '--core') f.core = argv[++i];
  }
  return f;
}

/** Load every dr-*.md in the ledger. Returns {defects, errors}. */
export function loadDefects(core) {
  const dir = path.join(core, 'decisions', 'defects');
  const errors = [];
  const defects = [];
  if (!existsSync(dir)) return { defects, errors: [`ledger directory missing: ${dir}`], dir };

  for (const file of readdirSync(dir).filter((f) => f.startsWith('dr-') && f.endsWith('.md')).sort()) {
    const full = path.join(dir, file);
    const fm = parseFM(readFileSync(full, 'utf8'));
    const where = `defects/${file}`;
    if (!fm) { errors.push(`${where}: no frontmatter block`); continue; }

    for (const k of REQUIRED) {
      if (fm[k] == null || fm[k] === '') errors.push(`${where}: missing '${k}'`);
    }
    // The slug IS the identity (ADR-0087) — it must match the filename, or two surfaces
    // disagree about what this defect is called and cross-references break silently.
    const expectSlug = file.replace(/^dr-/, '').replace(/\.md$/, '');
    if (fm.slug && fm.slug !== expectSlug) {
      errors.push(`${where}: slug '${fm.slug}' does not match filename (expected '${expectSlug}')`);
    }
    if (fm.class && !CLASSES.has(fm.class)) errors.push(`${where}: invalid class '${fm.class}'`);
    if (fm.severity && !SEVERITIES.has(fm.severity)) errors.push(`${where}: invalid severity '${fm.severity}'`);
    if (fm.status && !STATUSES.has(fm.status)) errors.push(`${where}: invalid status '${fm.status}'`);
    if (fm.disposition && !DISPOSITIONS.has(fm.disposition)) {
      errors.push(`${where}: invalid disposition '${fm.disposition}'`);
    }
    // A report with no probe cannot be closed by anything but opinion. That is allowed
    // ONLY as an explicit stub — otherwise it is an unverifiable claim wearing a
    // defect's clothes, which is the thing this ledger exists to catch.
    if (!fm.claim_probe && fm.disposition !== 'needs-investigation') {
      errors.push(`${where}: no claim_probe and disposition is not 'needs-investigation' — unverifiable`);
    }
    defects.push({ ...fm, _file: file, _path: full });
  }
  return { defects, errors, dir };
}

/** Run a probe. Returns {code, out, err}. Never throws — a broken probe is a finding. */
function runProbe(cmd, cwd) {
  try {
    const out = execFileSync('sh', ['-c', cmd], {
      cwd, encoding: 'utf8', timeout: PROBE_TIMEOUT_MS, stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { code: 0, out: out.trim(), err: '' };
  } catch (e) {
    // Non-zero exit is a legitimate probe result, not a failure. Distinguish it from a
    // probe that could not run at all (spawn failure, timeout) — only the latter is an
    // error, and only the latter must never produce a close.
    if (typeof e.status === 'number') {
      return { code: e.status, out: String(e.stdout || '').trim(), err: String(e.stderr || '').trim() };
    }
    return { code: null, out: '', err: e.killed ? `probe timed out after ${PROBE_TIMEOUT_MS}ms` : String(e.message) };
  }
}

export function sweep(defects, cwd) {
  const results = [];
  for (const d of defects) {
    if (!NON_TERMINAL.has(d.status)) continue;
    if (!d.claim_probe) {
      results.push({ slug: d.slug, verdict: 'no-probe', detail: 'stub — needs-investigation', truth: null });
      continue;
    }
    const claim = runProbe(d.claim_probe, cwd);
    const truth = d.truth_probe ? runProbe(d.truth_probe, cwd) : null;

    let verdict;
    if (claim.code === null) verdict = 'probe-error';
    else if (claim.code === 0) verdict = 'still-broken';
    else verdict = 'claim-gone';

    // A truth_probe that exits non-zero, times out, or prints nothing is BROKEN, and must
    // say so. Rendering it as a blank line hides a dead probe behind a plausible-looking
    // report — the same silent-failure class this ledger exists to surface.
    let truthText = null;
    if (truth) {
      if (truth.code === null) truthText = `PROBE FAILED: ${truth.err}`;
      else if (truth.code !== 0) truthText = `PROBE EXIT ${truth.code}: ${truth.err || truth.out || '(no output)'}`;
      else if (truth.out === '') truthText = 'PROBE EMPTY: exited 0 with no output';
      else truthText = truth.out;
    }

    results.push({
      slug: d.slug, verdict,
      detail: verdict === 'probe-error' ? claim.err : `claim_probe exit ${claim.code}`,
      truth: truthText,
      truthOk: !truth || (truth.code === 0 && truth.out !== ''),
      _defect: d,
    });
  }
  return results;
}

function appendMovement(core, rows) {
  if (!rows.length) return;
  const file = path.join(core, 'decisions', 'defects', 'defects-status.jsonl');
  const stamp = new Date().toISOString().slice(0, 10);
  const lines = rows.map((r) => JSON.stringify({
    date: stamp,
    defect: r.slug,
    verdict: r.verdict,
    from: r._defect?.status ?? null,
    to: r.to ?? r._defect?.status ?? null,
    actor: 'defects-lint.mjs --sweep',
    source: 'independent-probe',
    evidence: r.truth != null ? `truth_probe: ${r.truth}` : r.detail,
  }));
  appendFileSync(file, lines.join('\n') + '\n');
}

/** Rewrite a defect file's status: line in place. Only ever called under --apply. */
function applyClose(d) {
  const text = readFileSync(d._path, 'utf8');
  const next = text.replace(/^status:\s*\S+\s*$/m, 'status: verified-closed');
  if (next === text) return false;
  writeFileSync(d._path, next);
  return true;
}

function main() {
  const flags = parseFlags(process.argv.slice(2));
  const { defects, errors } = loadDefects(flags.core);
  const open = defects.filter((d) => NON_TERMINAL.has(d.status));

  if (flags.format === 'summary') {
    const bySev = (s) => open.filter((d) => d.severity === s).length;
    console.log(
      `defects: ${open.length} open (${bySev('high')} high / ${bySev('medium')} med / ${bySev('low')} low) · ` +
      `${defects.length} total · ${errors.length} schema errors`,
    );
    process.exit(flags.check && errors.length ? 1 : 0);
  }

  const L = [`# defects-lint — ${flags.core}`, ''];
  L.push(`${defects.length} report(s) · ${open.length} open · ${errors.length} schema error(s)`, '');

  if (errors.length) {
    L.push('## Schema errors');
    errors.forEach((e) => L.push(`- ✗ ${e}`));
    L.push('');
  }

  if (open.length) {
    L.push('## Open');
    const rank = { high: 0, medium: 1, low: 2 };
    for (const d of open.sort((a, b) => (rank[a.severity] ?? 9) - (rank[b.severity] ?? 9))) {
      L.push(`- [${d.severity}] ${d.slug} — ${d.location}`);
      L.push(`      ${d.disposition} · ${d.class} · filed ${d.filed}`);
    }
    L.push('');
  }

  let sweepRows = [];
  if (flags.sweep) {
    sweepRows = sweep(open, flags.core);
    L.push('## Sweep (independent probe)');
    const order = { 'still-broken': 0, 'claim-gone': 1, 'probe-error': 2, 'no-probe': 3 };
    for (const r of sweepRows.sort((a, b) => order[a.verdict] - order[b.verdict])) {
      const mark = { 'still-broken': '✗', 'claim-gone': '✓', 'probe-error': '!', 'no-probe': '·' }[r.verdict];
      L.push(`- ${mark} ${r.verdict.padEnd(13)} ${r.slug}`);
      if (r.truth != null) L.push(`      truth: ${r.truth}`);
      if (r.verdict === 'probe-error') L.push(`      ${r.detail}`);
    }
    L.push('');

    const brokenTruth = sweepRows.filter((r) => r.truthOk === false);
    if (brokenTruth.length) {
      L.push(`⚠ ${brokenTruth.length} truth_probe(s) broken — fix these before trusting the verdicts above:`);
      brokenTruth.forEach((r) => L.push(`      ${r.slug}`));
      L.push('');
    }

    const unconfirmedGone = sweepRows.filter(
      (r) => r.verdict === 'claim-gone' && UNCONFIRMED.has(r._defect?.status),
    );
    if (unconfirmedGone.length) {
      L.push(`${unconfirmedGone.length} needs-confirmation report(s) show claim-gone — a verifier must`);
      L.push('  promote or reject them; --apply will not close an unconfirmed finding.');
      unconfirmedGone.forEach((r) => L.push(`      ${r.slug}`));
      L.push('');
    }

    const closable = sweepRows.filter(
      (r) => r.verdict === 'claim-gone' && !UNCONFIRMED.has(r._defect?.status),
    );
    if (flags.apply) {
      for (const r of closable) { if (applyClose(r._defect)) r.to = 'verified-closed'; }
      L.push(`Applied: ${closable.length} defect(s) → verified-closed`, '');
    } else if (closable.length) {
      L.push(`${closable.length} defect(s) eligible to close — rerun with --apply`, '');
    }
    appendMovement(flags.core, sweepRows);
  }

  console.log(L.join('\n'));
  // Schema errors gate under --check; sweep verdicts never do. An open defect is a
  // measurement, and a measurement never blocks.
  process.exit(flags.check && errors.length ? 1 : 0);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main();
}
