#!/usr/bin/env node
/**
 * bead-lint.mjs — schema check + open-hook measurement + independent closure sweep for
 * the `.handoff/` bead ledger (rm:rm-l2-ojfbot#S32, closing TD-006).
 *
 * TD-006: the declared bead closure loop was self-report only — 28 open hooks against
 * 9 reports ever filed, 32% of beads non-conformant, and nothing measuring any of it.
 * This script is the measurement half. It is the bead-world twin of defects-lint.mjs
 * (adr:defect-ledger-and-closure-loop) with one deliberate difference: the sweep here is
 * PROPOSAL-ONLY. Closing a bead is a truth claim about whether work shipped, and that
 * claim stays with a human (rm:rm-l2-ojfbot#S33) — there is no --apply.
 *
 * Modes:
 *   (default)  validate schema across every reachable fleet repo; print open hooks
 *   --format=summary   one line, for the frame-standup heartbeat
 *   --check    CI mode. Shadow by default: always exit 0 (WARNs/ERRORs visible in logs).
 *              Enforcing before S33 backfills would red-wall every PR on day one.
 *   --strict   with --check: schema ERRORs exit 1 (the S33 promotion flips this on).
 *   --max-open-hook-age-days=N   with --check: open hooks older than N days exit 1.
 *   --sweep    probe each open hook's machine keys (github:owner/repo#N via gh,
 *              rm:<roadmap>#S<n> via roadmap slice status + status.jsonl) and classify:
 *                evidence-shipped   ground truth says the work merged/closed
 *                no-evidence        no probe found shipping evidence (may still be pending)
 *                probe-error        a probe could not run — NEVER a verdict either way
 *              Output is a proposal table for the S33 human pass. Writes nothing.
 *
 * Open-hook formula replicates .claude/skills/bead/scripts/orient.py exactly:
 * a brief is an open hook iff status=live AND no report in the same repo names it in
 * responding_to. Schema enums are the canonical ones from bead-schemas.md — drifted
 * values (status: open, date:, kind:) are exactly what gets flagged, per the drift list
 * normalize.py documents.
 *
 * Vantage scoping mirrors northstar-lint.yml: fleet repos unreachable from this checkout
 * downgrade to WARN — the gate never fails a PR over a checkout it cannot see.
 *
 * Usage: node bead-lint.mjs [--core PATH] [--check] [--strict] [--sweep]
 *                           [--format=summary] [--max-open-hook-age-days=N]
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  parseFM, repoRootOf, loadRegistry, loadRoadmapRegistry, loadAllRoadmaps, buildSliceIndex,
} from './lib/northstar-fm.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

const TYPES = new Set(['brief', 'report', 'decision', 'discovery']);
const STATUSES = new Set(['live', 'closed', 'superseded']);
// Slice statuses that count as shipping evidence for an rm: ref.
const SHIPPED_SLICE = new Set(['delivered', 'done', 'merged', 'shipped']);
// Forward-only machine-key convention starts at the S32 merge (deliverable item 5).
// Briefs created before this date are S33 backfill territory, not lint noise.
const HOOK_CONVENTION_START = Date.parse('2026-08-02T00:00:00Z');
const MACHINE_KEY_RE = /(?:github:[\w.-]+\/[\w.-]+#\d+|rm:[\w-]+#S\d+)/;
const PROBE_TIMEOUT_MS = 15_000;

function parseFlags(argv) {
  const f = {
    core: path.resolve(HERE, '..'),
    check: false, strict: false, sweep: false, format: 'report', maxAgeDays: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--check') f.check = true;
    else if (a === '--strict') f.strict = true;
    else if (a === '--sweep') f.sweep = true;
    else if (a === '--format=summary') f.format = 'summary';
    else if (a.startsWith('--max-open-hook-age-days=')) f.maxAgeDays = parseInt(a.split('=')[1], 10) || null;
    else if (a === '--core') f.core = argv[++i];
  }
  return f;
}

/**
 * Fleet repo roots: core + every distinct repo root the two registries reference, plus
 * any sibling directory of core that carries a .handoff/ — beads exist in repos that
 * never got a northstar (the cockpit's handoff adapter globs the same way), and a
 * fleet-wide ledger lint that only sees registered repos would under-count the debt.
 */
export function fleetRoots(core) {
  const roots = new Map([[path.resolve(core), 'core']]);
  const add = (root) => {
    if (root && !roots.has(path.resolve(root))) roots.set(path.resolve(root), path.basename(root));
  };
  for (const e of loadRegistry(core).entries) add(e.path ? repoRootOf(e.path, core) : null);
  for (const e of loadRoadmapRegistry(core).entries) add(e.path ? repoRootOf(e.path, core) : null);
  const parent = path.dirname(path.resolve(core));
  if (existsSync(parent)) {
    for (const name of readdirSync(parent)) {
      const sib = path.join(parent, name);
      try { if (existsSync(path.join(sib, '.handoff'))) add(sib); } catch { /* unreadable sibling */ }
    }
  }
  return roots;
}

/** created_at, with normalize.py's fallback chain: created_at → date → derive from id. */
function createdAtOf(fm, file) {
  for (const k of ['created_at', 'date']) {
    const v = fm[k];
    if (v == null || v === '') continue;
    const t = Date.parse(String(v));
    if (!Number.isNaN(t)) return t;
  }
  const m = /^(\d{4})-?(\d{2})-?(\d{2})/.exec(String(fm.id ?? file));
  if (m) return Date.parse(`${m[1]}-${m[2]}-${m[3]}T00:00:00Z`);
  return null;
}

/**
 * Every machine key (github:/rm:) in the raw frontmatter block. Raw-text scan on
 * purpose: parseFM only list-parses registry keys, so `refs:` items would be dropped —
 * and a key anywhere in frontmatter (hook, refs, closes) is deliberate reference
 * material either way.
 */
function machineKeys(text) {
  const m = /^---\n([\s\S]*?)\n---/.exec(text);
  if (!m) return [];
  return [...new Set([...m[1].matchAll(new RegExp(MACHINE_KEY_RE.source, 'g'))].map((x) => x[0]))];
}

/**
 * Bead filenames git knows about in root's .handoff/, or null when root is not a git
 * checkout (or git itself is unavailable). Null means "no git vantage" — the caller
 * falls back to disk enumeration rather than treating everything as untracked.
 */
export function trackedBeadFiles(root) {
  try {
    const out = execFileSync('git', ['-C', root, 'ls-files', '.handoff'], {
      encoding: 'utf8', timeout: PROBE_TIMEOUT_MS, stdio: ['ignore', 'pipe', 'pipe'],
    });
    return new Set(out.split('\n').filter(Boolean).map((p) => path.basename(p)));
  } catch {
    return null;
  }
}

/**
 * Scan one repo's .handoff/. Returns { beads, errors, warns } — errors are schema
 * violations (gate under --strict), warns are drift/convention notices (never gate).
 *
 * Enumeration is git-vantage: only beads git tracks are counted and schema-checked,
 * because those are the only ones CI's fresh checkout can see. A file present on disk
 * but absent from git inflates the local count and vanishes in CI — the exact inverse
 * of the unreachable-repo case, scoped the same way: downgrade to WARN, never let the
 * two vantages disagree silently (bead:20260803-1200-brief-untracked-bead-ledger-vantage-gap).
 */
export function scanRepo(root, repoName) {
  const dir = path.join(root, '.handoff');
  const beads = []; const errors = []; const warns = [];
  if (!existsSync(dir)) return { beads, errors, warns, present: false };

  const tracked = trackedBeadFiles(root);
  if (tracked == null) warns.push(`${repoName}/.handoff: not a git checkout — enumerating from disk (vantage unverifiable)`);

  // README.md is directory documentation, not a bead.
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.md') && f.toLowerCase() !== 'readme.md').sort()) {
    if (tracked != null && !tracked.has(file)) {
      warns.push(`${repoName}/.handoff/${file}: present but untracked — invisible from CI's vantage; track it or triage it (not counted)`);
      continue;
    }
    const where = `${repoName}/.handoff/${file}`;
    let text;
    try { text = readFileSync(path.join(dir, file), 'utf8'); } catch (e) { errors.push(`${where}: unreadable (${e.message})`); continue; }
    const fm = parseFM(text);
    if (!fm) { errors.push(`${where}: no frontmatter block`); continue; }

    const stem = file.replace(/\.md$/, '');
    if (fm.id == null || fm.id === '') errors.push(`${where}: missing 'id'`);
    else if (String(fm.id) !== stem) errors.push(`${where}: id '${fm.id}' != filename stem '${stem}' (replay.py invariant)`);

    const type = fm.type ?? fm.kind;
    if (fm.type == null && fm.kind != null) warns.push(`${where}: uses 'kind:' instead of 'type:'`);
    if (type == null) errors.push(`${where}: missing 'type'`);
    else if (!TYPES.has(String(type))) errors.push(`${where}: invalid type '${type}'`);

    if (fm.status == null) errors.push(`${where}: missing 'status'`);
    else if (!STATUSES.has(String(fm.status))) errors.push(`${where}: status '${fm.status}' not in live|closed|superseded`);

    if (fm.created_at == null && fm.date != null) warns.push(`${where}: 'date:' instead of 'created_at:'`);
    else if (fm.created_at == null && fm.date == null) warns.push(`${where}: no created_at (derived from id for aging)`);

    const createdAt = createdAtOf(fm, file);
    const keys = machineKeys(text);

    if (String(type) === 'report') {
      if (fm.responding_to == null || fm.responding_to === '' || String(fm.responding_to) === 'null') {
        const backfilled = fm.labels && String(fm.labels.backfilled) === 'true';
        warns.push(`${where}: report with responding_to: null${backfilled ? ' (backfilled-unattributed — retires no hook)' : ' — retires no hook'}`);
      }
    }
    if (String(type) === 'brief' && createdAt != null && createdAt >= HOOK_CONVENTION_START && !keys.length) {
      warns.push(`${where}: brief without a machine key (github:owner/repo#N or rm:<roadmap>#S<n>) in hook:/refs: — unsweepable (forward-only convention, S32)`);
    }

    beads.push({ ...fm, _type: String(type ?? ''), _file: file, _where: where, _repo: repoName, _createdAt: createdAt, _keys: keys });
  }
  return { beads, errors, warns, present: true };
}

/** orient.py's formula, per repo: live briefs no report names in responding_to. */
export function openHooks(beads, now = Date.now()) {
  const briefs = beads.filter((b) => b._type === 'brief' && b.status === 'live');
  const responded = new Set(beads.filter((b) => b._type === 'report').map((b) => String(b.responding_to)));
  return briefs
    .filter((b) => !responded.has(String(b.id)))
    .map((b) => ({ ...b, _ageDays: b._createdAt != null ? Math.floor((now - b._createdAt) / 86400000) : null }));
}

function runGh(args) {
  try {
    const out = execFileSync('gh', args, { encoding: 'utf8', timeout: PROBE_TIMEOUT_MS, stdio: ['ignore', 'pipe', 'pipe'] });
    return { ok: true, out: out.trim() };
  } catch (e) {
    return { ok: false, err: e.killed ? `timed out after ${PROBE_TIMEOUT_MS}ms` : String(e.stderr || e.message).trim().slice(0, 200) };
  }
}

/**
 * Probe one hook's machine keys against ground truth. PROPOSAL-ONLY: verdicts feed the
 * S33 human pass; nothing here writes a closure. A probe that cannot run is
 * probe-error, never a verdict — a checker that cannot run its own test must say so,
 * never guess in the direction of "shipped" (defects-lint.mjs, 2026-07-30 lesson).
 */
export function probeHook(hook, sliceIndex, statusLines) {
  const evidence = []; const probeErrors = [];
  for (const key of hook._keys) {
    const gh = /^github:([\w.-]+\/[\w.-]+)#(\d+)$/.exec(key);
    if (gh) {
      const [, ownerRepo, num] = gh;
      const pr = runGh(['pr', 'view', num, '--repo', ownerRepo, '--json', 'state,mergedAt', '--jq', '.state']);
      if (pr.ok) {
        if (pr.out === 'MERGED') evidence.push(`${key} merged`);
        continue;
      }
      const issue = runGh(['issue', 'view', num, '--repo', ownerRepo, '--json', 'state', '--jq', '.state']);
      if (issue.ok) {
        if (issue.out === 'CLOSED') evidence.push(`${key} closed`);
        continue;
      }
      probeErrors.push(`${key}: gh unreachable (${issue.err})`);
      continue;
    }
    const rm = /^rm:([\w-]+#S\d+)$/.exec(key) ? key : null;
    if (rm) {
      const entry = sliceIndex.get(key);
      if (entry && SHIPPED_SLICE.has(String(entry.slice.status))) evidence.push(`${key} status: ${entry.slice.status}`);
      else if (!entry) {
        if (statusLines.some((l) => l.includes(key))) evidence.push(`${key} appears in status.jsonl movement`);
      }
    }
  }
  if (evidence.length) return { verdict: 'evidence-shipped', detail: evidence.join(' · ') };
  if (probeErrors.length) return { verdict: 'probe-error', detail: probeErrors.join(' · ') };
  return { verdict: 'no-evidence', detail: hook._keys.length ? `probed ${hook._keys.length} key(s), nothing shipped` : 'no machine key to probe (S33 normalizes hook:)' };
}

function main() {
  const flags = parseFlags(process.argv.slice(2));
  const now = Date.now();
  const roots = fleetRoots(flags.core);

  const perRepo = []; const allErrors = []; const allWarns = []; const unreachable = [];
  for (const [root, name] of roots) {
    if (!existsSync(root)) { unreachable.push(name); continue; }
    const scan = scanRepo(root, name);
    if (!scan.present) continue;
    const hooks = openHooks(scan.beads, now);
    perRepo.push({ name, beads: scan.beads, hooks });
    allErrors.push(...scan.errors);
    allWarns.push(...scan.warns);
  }

  const totalBeads = perRepo.reduce((n, r) => n + r.beads.length, 0);
  const totalHooks = perRepo.reduce((n, r) => n + r.hooks.length, 0);
  const ages = perRepo.flatMap((r) => r.hooks.map((h) => h._ageDays)).filter((a) => a != null);
  const maxAge = ages.length ? Math.max(...ages) : 0;
  const ageViolations = flags.maxAgeDays != null
    ? perRepo.flatMap((r) => r.hooks.filter((h) => h._ageDays != null && h._ageDays > flags.maxAgeDays))
    : [];

  const gate = flags.check && ((flags.strict && allErrors.length > 0) || ageViolations.length > 0);

  if (flags.format === 'summary') {
    console.log(
      `beads: ${totalHooks} open hooks across ${perRepo.length} repos (oldest ${maxAge}d) · ` +
      `${totalBeads} beads · ${allErrors.length} schema errors · ${allWarns.length} warns` +
      (unreachable.length ? ` · ${unreachable.length} repos unreachable (vantage)` : ''),
    );
    process.exit(gate ? 1 : 0);
  }

  const L = [`# bead-lint — ${flags.core}`, ''];
  L.push(`${totalBeads} bead(s) across ${perRepo.length} repo(s) · ${totalHooks} open hook(s) (oldest ${maxAge}d) · ${allErrors.length} schema error(s) · ${allWarns.length} warn(s)`, '');

  if (unreachable.length) {
    L.push(`vantage: ${unreachable.length} registered repo(s) not on disk from this checkout (WARN, never gates): ${unreachable.join(', ')}`, '');
  }
  if (allErrors.length) {
    L.push(`## Schema errors${flags.strict ? '' : ' (shadow — gate with --strict at the S33 promotion)'}`);
    allErrors.forEach((e) => L.push(`- ✗ ${e}`));
    L.push('');
  }
  if (allWarns.length) {
    L.push('## Warns (drift + convention — never gate)');
    allWarns.forEach((w) => L.push(`- ! ${w}`));
    L.push('');
  }

  L.push('## Open hooks by repo');
  for (const r of perRepo.filter((r) => r.hooks.length).sort((a, b) => b.hooks.length - a.hooks.length)) {
    L.push(`- **${r.name}**: ${r.hooks.length}`);
    for (const h of r.hooks.sort((a, b) => (b._ageDays ?? 0) - (a._ageDays ?? 0))) {
      L.push(`    - [${h._ageDays != null ? `${h._ageDays}d` : 'age?'}] ${h._file} — ${h.title ?? '(untitled)'}`);
    }
  }
  L.push('');

  if (ageViolations.length) {
    L.push(`✗ ${ageViolations.length} open hook(s) older than --max-open-hook-age-days=${flags.maxAgeDays} — gating`, '');
  }

  if (flags.sweep) {
    const { roadmaps } = loadAllRoadmaps(flags.core);
    const sliceIndex = buildSliceIndex(roadmaps);
    const statusFile = path.join(flags.core, 'decisions', 'northstar', 'status.jsonl');
    const statusLines = existsSync(statusFile) ? readFileSync(statusFile, 'utf8').split('\n') : [];

    L.push('## Sweep (independent probe — PROPOSAL-ONLY; closure is S33\'s human act)');
    const order = { 'evidence-shipped': 0, 'probe-error': 1, 'no-evidence': 2 };
    const rows = perRepo.flatMap((r) => r.hooks.map((h) => ({ repo: r.name, hook: h, ...probeHook(h, sliceIndex, statusLines) })));
    for (const row of rows.sort((a, b) => order[a.verdict] - order[b.verdict])) {
      const mark = { 'evidence-shipped': '✓', 'probe-error': '!', 'no-evidence': '·' }[row.verdict];
      L.push(`- ${mark} ${row.verdict.padEnd(16)} ${row.repo}/${row.hook._file}`);
      L.push(`      ${row.detail}`);
    }
    const shipped = rows.filter((r) => r.verdict === 'evidence-shipped').length;
    L.push('');
    L.push(`${shipped} hook(s) show shipping evidence — for each: run /resume --verify in the repo to`);
    L.push('backfill the report bead, then flip the brief to closed. This sweep wrote nothing.');
    L.push('');
  }

  console.log(L.join('\n'));
  process.exit(gate ? 1 : 0);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main();
}
