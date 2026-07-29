#!/usr/bin/env node
/**
 * defect-file.mjs — the FILING half of the defect loop.
 *
 * An agent that catches an artifact asserting something false files here, mid-work,
 * without leaving its task. It never decides whether the defect is real or closed —
 * `defects-lint.mjs --sweep` (the independent half) does that. See decisions/defects/README.md.
 *
 * FILING POLICY (operator decision, 2026-07-29):
 *   deterministic finding (engine-proven, carries a probe) → files at status: open
 *   LLM/judgement finding                                  → files at status: needs-confirmation
 * `--source=llm` selects the latter. A human or verifying agent promotes it.
 *
 * DEDUP IS DAY-ONE, NOT A FAST-FOLLOW. Re-filing an open report under a new slug is how a
 * ledger rots (the /techdebt scan-mode failure this ledger was built to avoid). Every file
 * checks claim+location against every non-terminal report before writing.
 *
 * ERRORS CARRY THE ADMISSIBLE SET. Rejections list the allowed values, never just "invalid".
 * Evidence: structured feedback containing failure location + observed value + admissible
 * alternatives improved LLM repair success by ~44pp, and the ablation isolates the
 * admissible-set as the active ingredient — formatting made ~zero difference
 * (arXiv 2607.14167). An agent that gets told "invalid class" cannot self-repair; one told
 * "invalid class 'bug'; allowed: false-assertion|dead-mechanism|..." can.
 *
 * Usage:
 *   node defect-file.mjs --slug=<s> --class=<c> --severity=<s> --location=<repo:path[:line]> \
 *     --claim="..." [--actual="..."] [--claim-probe="..."] [--truth-probe="..."] \
 *     [--disposition=<d>] [--filed-by=...] [--evidence=...] [--source=llm] [--dry-run]
 *   ...body on stdin (optional; a template is written if absent)
 *
 * Exit: 0 filed · 1 rejected (validation or dedup) · 2 usage error.
 */
import { existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { loadDefects } from './defects-lint.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

const ALLOWED = {
  class: ['false-assertion', 'dead-mechanism', 'schema-drift', 'phantom-reference'],
  severity: ['high', 'medium', 'low'],
  disposition: [
    'repair-doc', 'repair-mechanism', 'retire-mechanism', 'replicate-then-fix', 'needs-investigation',
  ],
};
const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;
const LOCATION_RE = /^[A-Za-z0-9_.-]+:[^\s]+$/; // <repo>:<path>[:<line>]
const NON_TERMINAL = new Set(['open', 'claimed', 'repaired', 'needs-confirmation']);

function usage(msg) {
  console.error(msg ? `error: ${msg}\n` : '');
  console.error(`file a defect report into decisions/defects/

  --slug=<kebab>            required · identity (ADR-0087); becomes dr-<slug>.md
  --class=<c>               required · one of: ${ALLOWED.class.join(' | ')}
  --severity=<s>            required · one of: ${ALLOWED.severity.join(' | ')}
  --location=<repo:path>    required · e.g. selfco:wiki/entities/core.md:31
  --claim="..."             required · the false assertion, verbatim
  --actual="..."            what is true instead, as of today
  --claim-probe="sh ..."    exit 0 while the false claim is STILL present. Required unless
                            --disposition=needs-investigation (a stub is honest; an
                            unverifiable claim dressed as a defect is not).
  --truth-probe="sh ..."    prints current reality; informational for the repairer
  --disposition=<d>         default repair-doc · one of: ${ALLOWED.disposition.join(' | ')}
  --filed-by=<who>          default agent:unknown
  --evidence=<ref>          session slug / PR / log reference
  --source=llm              file as needs-confirmation instead of open
  --core=<path>             core repo root (default: resolved from this script)
  --dry-run                 validate + dedup, print the file, write nothing
`);
  process.exit(2);
}

function parseFlags(argv) {
  const f = { core: path.resolve(HERE, '..'), disposition: 'repair-doc', filedBy: 'agent:unknown' };
  const map = {
    slug: 'slug', class: 'class', severity: 'severity', location: 'location', claim: 'claim',
    actual: 'actual', 'claim-probe': 'claimProbe', 'truth-probe': 'truthProbe',
    disposition: 'disposition', 'filed-by': 'filedBy', evidence: 'evidence',
    source: 'source', core: 'core',
  };
  for (const a of argv) {
    if (a === '--dry-run') { f.dryRun = true; continue; }
    if (a === '--help' || a === '-h') usage();
    const m = /^--([a-z-]+)=([\s\S]*)$/.exec(a);
    if (!m) usage(`unrecognised argument: ${a}`);
    const key = map[m[1]];
    if (!key) usage(`unknown flag --${m[1]}`);
    f[key] = m[2];
  }
  return f;
}

/** Validate. Every rejection names the observed value AND the admissible set. */
function validate(f) {
  const errs = [];
  for (const k of ['slug', 'class', 'severity', 'location', 'claim']) {
    if (!f[k]) errs.push(`missing --${k.replace(/([A-Z])/g, '-$1').toLowerCase()} (required)`);
  }
  if (f.slug && !SLUG_RE.test(f.slug)) {
    errs.push(`invalid --slug '${f.slug}'; must match ${SLUG_RE} (lowercase kebab-case)`);
  }
  if (f.location && !LOCATION_RE.test(f.location)) {
    errs.push(`invalid --location '${f.location}'; expected <repo>:<path>[:<line>], e.g. selfco:wiki/index.md:7`);
  }
  for (const k of ['class', 'severity', 'disposition']) {
    if (f[k] && !ALLOWED[k].includes(f[k])) {
      errs.push(`invalid --${k} '${f[k]}'; allowed: ${ALLOWED[k].join(' | ')}`);
    }
  }
  if (!f.claimProbe && f.disposition !== 'needs-investigation') {
    errs.push(
      "no --claim-probe: a report with no executable probe cannot be closed by anything but " +
      "opinion. Either supply one, or file with --disposition=needs-investigation " +
      `(allowed dispositions: ${ALLOWED.disposition.join(' | ')}).`,
    );
  }
  if (f.source && f.source !== 'llm') {
    errs.push(`invalid --source '${f.source}'; allowed: llm  (omit for a deterministic finding)`);
  }
  return errs;
}

/** Normalise for comparison — dedup must not be defeated by whitespace or case. */
const norm = (s) => String(s ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
/** Location without the :line suffix — the same false claim on a shifted line is the same defect. */
const locKey = (s) => norm(s).replace(/:\d+$/, '');

/** Returns the colliding report, or null. */
function findDuplicate(f, defects) {
  for (const d of defects) {
    if (!NON_TERMINAL.has(d.status)) continue;
    if (d.slug === f.slug) return { hit: d, why: 'slug already exists' };
    if (locKey(d.location) === locKey(f.location) && norm(d.claim) === norm(f.claim)) {
      return { hit: d, why: 'same claim at the same location' };
    }
  }
  return null;
}

const yamlStr = (s) => `"${String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

function render(f, body) {
  const status = f.source === 'llm' ? 'needs-confirmation' : 'open';
  const today = new Date().toISOString().slice(0, 10);
  const fm = [
    '---',
    'type: defect-report',
    `slug: ${f.slug}`,
    `class: ${f.class}`,
    `severity: ${f.severity}`,
    `status: ${status}`,
    `disposition: ${f.disposition}`,
    `location: ${yamlStr(f.location)}`,
    `claim: ${yamlStr(f.claim)}`,
    f.actual ? `actual: ${yamlStr(f.actual)}` : null,
    f.claimProbe ? `claim_probe: ${yamlStr(f.claimProbe)}` : null,
    f.truthProbe ? `truth_probe: ${yamlStr(f.truthProbe)}` : null,
    `filed: ${today}`,
    `filed_by: ${yamlStr(f.filedBy)}`,
    f.evidence ? `evidence: ${yamlStr(f.evidence)}` : null,
    '---',
  ].filter(Boolean).join('\n');

  const stub = body && body.trim() ? body.trim() : [
    `# ${f.claim}`,
    '',
    f.actual ? `**Actual:** ${f.actual}` : '_No `actual` supplied._',
    '',
    '## Why it matters',
    '',
    '_(unwritten — filed mid-work)_',
    '',
    '## Repair',
    '',
    '_(unwritten)_',
    status === 'needs-confirmation'
      ? '\n> Filed by an LLM finding. Confirm the claim is real before promoting to `open`.'
      : '',
  ].filter(Boolean).join('\n');

  return `${fm}\n\n${stub}\n`;
}

async function readStdin() {
  if (process.stdin.isTTY) return '';
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  return Buffer.concat(chunks).toString('utf8');
}

async function main() {
  const f = parseFlags(process.argv.slice(2));

  const errs = validate(f);
  if (errs.length) {
    console.error('REJECTED — not filed:\n');
    errs.forEach((e) => console.error(`  ✗ ${e}`));
    console.error('\nFix the above and re-run. Nothing was written.');
    process.exit(1);
  }

  const { defects, errors: loadErrors } = loadDefects(f.core);
  if (loadErrors.length) {
    // Filing into a ledger that does not parse would compound the problem.
    console.error('REJECTED — the existing ledger has schema errors; fix them before filing:\n');
    loadErrors.forEach((e) => console.error(`  ✗ ${e}`));
    process.exit(1);
  }

  const dup = findDuplicate(f, defects);
  if (dup) {
    console.error(`REJECTED — duplicate: ${dup.why}\n`);
    console.error(`  existing: ${dup.hit.slug}  [${dup.hit.status}]  ${dup.hit.location}`);
    console.error(`            claim: ${dup.hit.claim}`);
    console.error('\nUpdate that report instead of filing a second one. Nothing was written.');
    process.exit(1);
  }

  const body = await readStdin();
  const out = render(f, body);
  const dir = path.join(f.core, 'decisions', 'defects');
  const file = path.join(dir, `dr-${f.slug}.md`);

  if (f.dryRun) {
    console.log(`--- DRY RUN: would write ${path.relative(f.core, file)} ---\n`);
    console.log(out);
    process.exit(0);
  }

  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  if (existsSync(file)) {
    // Belt and braces: dedup covers non-terminal reports; this catches a terminal one.
    console.error(`REJECTED — ${path.relative(f.core, file)} already exists (terminal status?). Nothing written.`);
    process.exit(1);
  }
  writeFileSync(file, out);

  const status = f.source === 'llm' ? 'needs-confirmation' : 'open';
  console.log(`FILED  ${path.relative(f.core, file)}  [${status}]`);
  if (status === 'needs-confirmation') {
    console.log('       LLM-sourced — a verifier must promote it to open before repair.');
  }
  console.log('       Status is decided by `defects-lint.mjs --sweep`, not by the filer.');
}

main();
