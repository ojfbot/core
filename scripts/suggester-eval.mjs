#!/usr/bin/env node
/**
 * suggester-eval.mjs — the frozen suggester evaluator (rm:rm-l1-core#S8, PH2).
 *
 * Replays each gold prompt (decisions/opav/suggester-gold-v1.jsonl) through the
 * PRODUCTION scorer (`scoreCatalog`, exported by scripts/hooks/suggest-skills.mjs)
 * and scores the FULL pre-limit sorted set — rank metrics need what the live
 * `--limit=1` slice throws away.
 *
 * Metrics (chance-corrected headline — hit-rate flatters at N=62):
 *   kappa        — Cohen's kappa over predicted-top-1 vs expected, with
 *                  `no-match` as an explicit class. THE headline number.
 *   top1         — raw top-1 accuracy (reported, never the headline).
 *   precision/recall of "fires" — treating any suggestion as a fire:
 *                  precision = correct fires / fires; recall = expected-skill
 *                  rows whose skill was top-1 / expected-skill rows.
 *   recall@3     — expected skill anywhere in the top 3 (match-expected rows).
 *   mrr          — mean reciprocal rank of the expected skill over the full
 *                  scored set (match-expected rows; 0 when absent).
 *
 * Splits: `dev` and `holdout` are reported SEPARATELY. The holdout is FROZEN —
 * out-of-bounds for tuning (PH3 slices may cite dev only; see
 * decisions/opav/suggester-gold-v1-README.md). Label provenance
 * (CONFIRMED behavioral-evidence vs PROPOSED agent-judgment) is reported so the
 * baseline is honest about what backs it.
 *
 * Usage:
 *   node scripts/suggester-eval.mjs                 # human-readable report
 *   node scripts/suggester-eval.mjs --json          # machine-readable
 *   node scripts/suggester-eval.mjs --check         # deterministic self-test (fixture catalog)
 *   node scripts/suggester-eval.mjs --gold=PATH     # alternate gold file
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scoreCatalog, loadCatalog } from './hooks/suggest-skills.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_GOLD = resolve(HERE, '../decisions/opav/suggester-gold-v1.jsonl');
const NO_MATCH = 'no-match';

// ── Core evaluation (pure) ──────────────────────────────────────────────────

/** Predict for one prompt: full scored set + the top-1 class (or no-match). */
export function predictOne(prompt, catalog) {
  const scored = scoreCatalog({ query: prompt }, catalog);
  return { scored, top1: scored.length > 0 ? scored[0].name : NO_MATCH };
}

/** Cohen's kappa over paired class labels (chance-corrected agreement). */
export function cohensKappa(pairs) {
  const n = pairs.length;
  if (n === 0) return null;
  const classes = new Set();
  for (const [a, b] of pairs) { classes.add(a); classes.add(b); }
  let agree = 0;
  const margA = new Map(); // expected marginals
  const margB = new Map(); // predicted marginals
  for (const [a, b] of pairs) {
    if (a === b) agree++;
    margA.set(a, (margA.get(a) ?? 0) + 1);
    margB.set(b, (margB.get(b) ?? 0) + 1);
  }
  const po = agree / n;
  let pe = 0;
  for (const c of classes) pe += ((margA.get(c) ?? 0) / n) * ((margB.get(c) ?? 0) / n);
  if (pe === 1) return po === 1 ? 1 : 0; // degenerate single-class marginals
  return (po - pe) / (1 - pe);
}

/**
 * Evaluate gold rows against a catalog. Pure. Returns per-split metrics plus a
 * per-row breakdown (for the committed baseline and for debugging misses).
 */
export function evaluate(goldRows, catalog) {
  const rows = goldRows.map((g) => {
    const { scored, top1 } = predictOne(g.prompt, catalog);
    const expected = g.expected_skill;
    const rank = expected === NO_MATCH ? null : scored.findIndex((s) => s.name === expected) + 1 || null;
    return {
      gold_id: g.gold_id,
      split: g.split,
      label_status: g.label_status,
      expected,
      predicted: top1,
      correct: top1 === expected,
      rank, // 1-based rank of the expected skill in the full scored set (null if absent / no-match row)
      fired: top1 !== NO_MATCH,
      top3: scored.slice(0, 3).map((s) => s.name),
    };
  });

  const metricsFor = (subset) => {
    const n = subset.length;
    if (n === 0) return null;
    const kappa = cohensKappa(subset.map((r) => [r.expected, r.predicted]));
    const top1 = subset.filter((r) => r.correct).length / n;
    const fires = subset.filter((r) => r.fired);
    const correctFires = fires.filter((r) => r.correct).length;
    const matchExpected = subset.filter((r) => r.expected !== NO_MATCH);
    const recalled = matchExpected.filter((r) => r.predicted === r.expected).length;
    const recall3 = matchExpected.length
      ? matchExpected.filter((r) => r.top3.includes(r.expected)).length / matchExpected.length
      : null;
    const mrr = matchExpected.length
      ? matchExpected.reduce((acc, r) => acc + (r.rank ? 1 / r.rank : 0), 0) / matchExpected.length
      : null;
    return {
      n,
      kappa: round(kappa),
      top1: round(top1),
      fire_precision: fires.length ? round(correctFires / fires.length) : null,
      fire_precision_base: fires.length,
      recall: matchExpected.length ? round(recalled / matchExpected.length) : null,
      recall_base: matchExpected.length,
      recall_at_3: round(recall3),
      mrr: round(mrr),
    };
  };

  return {
    overall: metricsFor(rows),
    dev: metricsFor(rows.filter((r) => r.split === 'dev')),
    holdout: metricsFor(rows.filter((r) => r.split === 'holdout')),
    label_provenance: {
      confirmed: rows.filter((r) => r.label_status === 'CONFIRMED').length,
      proposed: rows.filter((r) => r.label_status === 'PROPOSED').length,
    },
    rows,
  };
}

const round = (x) => (x == null ? null : Math.round(x * 1000) / 1000);

// ── Self-test (--check): deterministic fixture catalog + prompts ────────────

const FIXTURE_CATALOG = {
  skills: [
    { name: 'adr', description: 'x', triggers: ['adr new', 'architecture decision record'] },
    { name: 'push-all', description: 'x', triggers: ['commit my changes', 'commit and push'] },
    { name: 'inactive-skill', status: 'deprecated', triggers: ['commit my changes'] },
  ],
};

const FIXTURE_GOLD = [
  { gold_id: 'F1', split: 'dev', label_status: 'CONFIRMED', prompt: 'adr new for the cache decision', expected_skill: 'adr' },
  { gold_id: 'F2', split: 'dev', label_status: 'CONFIRMED', prompt: 'please commit my changes and push', expected_skill: 'push-all' },
  { gold_id: 'F3', split: 'holdout', label_status: 'PROPOSED', prompt: 'proceed', expected_skill: 'no-match' },
  { gold_id: 'F4', split: 'holdout', label_status: 'PROPOSED', prompt: 'what a lovely morning', expected_skill: 'no-match' },
];

function selfTest() {
  const failures = [];
  const expect = (cond, msg) => { if (!cond) failures.push(msg); };
  const r = evaluate(FIXTURE_GOLD, FIXTURE_CATALOG);
  expect(r.rows[0].predicted === 'adr', `F1: want adr, got ${r.rows[0].predicted}`);
  expect(r.rows[1].predicted === 'push-all', `F2: want push-all, got ${r.rows[1].predicted}`);
  expect(r.rows[2].predicted === NO_MATCH, `F3: want no-match, got ${r.rows[2].predicted}`);
  expect(r.rows[3].predicted === NO_MATCH, `F4: want no-match, got ${r.rows[3].predicted}`);
  expect(r.overall.top1 === 1 && r.overall.kappa === 1, `perfect fixture: top1=${r.overall.top1} kappa=${r.overall.kappa}`);
  // inactive skills never fire even on an exact trigger
  expect(predictOne('commit my changes', { skills: [FIXTURE_CATALOG.skills[2]] }).top1 === NO_MATCH,
    'deprecated skill must not fire');
  // kappa punishes majority-class collapse: predicting the majority everywhere ≈ 0, not accuracy
  const collapsed = cohensKappa([['a', 'a'], ['a', 'a'], ['b', 'a'], ['c', 'a']]);
  expect(collapsed === 0, `majority-collapse kappa: want 0, got ${collapsed}`);
  // determinism: two runs identical
  const r2 = evaluate(FIXTURE_GOLD, FIXTURE_CATALOG);
  expect(JSON.stringify(r) === JSON.stringify(r2), 'evaluate must be deterministic');
  return failures;
}

// ── CLI ─────────────────────────────────────────────────────────────────────

function readJsonl(path) {
  return readFileSync(path, 'utf8')
    .split('\n')
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l));
}

function main() {
  const argv = process.argv.slice(2);
  const asJson = argv.includes('--json');
  const goldArg = argv.find((a) => a.startsWith('--gold='));
  const goldPath = goldArg ? goldArg.split('=')[1] : DEFAULT_GOLD;

  if (argv.includes('--check')) {
    const failures = selfTest();
    if (failures.length) {
      process.stderr.write('suggester-eval self-test FAILED:\n' + failures.map((f) => `  ✗ ${f}`).join('\n') + '\n');
      return 1;
    }
    process.stdout.write('suggester-eval self-test: prediction, no-match, lifecycle filter, kappa, determinism ✓\n');
    return 0;
  }

  const catalog = loadCatalog();
  if (!catalog?.skills) {
    process.stderr.write('skill-catalog.json not found\n');
    return 1;
  }
  const gold = readJsonl(goldPath);
  const result = evaluate(gold, catalog);
  const report = {
    at: new Date().toISOString(),
    gold: goldPath,
    catalog_active_skills: catalog.skills.filter((s) => s.status == null || s.status === 'active').length,
    headline: 'kappa (chance-corrected); hit-rate flatters at this catalog size',
    ...result,
  };

  if (asJson) {
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
    return 0;
  }

  const fmt = (m) =>
    m
      ? `n=${m.n} kappa=${m.kappa} top1=${m.top1} fire-precision=${m.fire_precision} (${m.fire_precision_base} fires) recall=${m.recall}/${m.recall_base} recall@3=${m.recall_at_3} mrr=${m.mrr}`
      : '(empty)';
  const L = [`# suggester-eval — ${report.at}`, ''];
  L.push(`gold: ${goldPath} (${gold.length} rows; labels: ${result.label_provenance.confirmed} CONFIRMED behavioral-evidence / ${result.label_provenance.proposed} PROPOSED agent-judgment)`);
  L.push(`catalog: ${report.catalog_active_skills} active skills`);
  L.push('');
  L.push(`overall : ${fmt(result.overall)}`);
  L.push(`dev     : ${fmt(result.dev)}`);
  L.push(`holdout : ${fmt(result.holdout)}   <- FROZEN, out-of-bounds for tuning`);
  L.push('');
  L.push('## Misses');
  for (const r of result.rows.filter((x) => !x.correct)) {
    L.push(`- ${r.gold_id} [${r.split}/${r.label_status}] expected=${r.expected} predicted=${r.predicted} rank=${r.rank ?? '-'} top3=[${r.top3.join(', ')}]`);
  }
  process.stdout.write(L.join('\n') + '\n');
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exitCode = main();
}
