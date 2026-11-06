#!/usr/bin/env node
// deviation-log.mjs — the independent deviation detector (Stop hook) for
// adr:harness-loop-instrumentation (H6).
//
// A DEVIATION is an agent-detected gap between the plan and the territory: the moment an
// edge case forced the work off the agreed plan. It is the single richest signal available
// in the loop, because it is *unprompted* — an unknown reporting itself, in flight, at no
// extra cost. Nothing else in the harness set has that property.
//
// TWO-SOURCE CONTRACT (same discipline as reconcile-skill-acted.mjs):
//   - self-report  ← the agent writes `## Deviations` bullets into implementation-notes.md,
//                    per the Layer-0 line in CLAUDE.md.
//   - independent  ← THIS hook parses that file itself and records what it finds. It never
//                    trusts a count the agent asserts; it reads the territory.
//
// ── THE ANTI-GOODHART RULE. READ THIS BEFORE "IMPROVING" ANYTHING HERE. ──
//
// Deviations-per-session is a DISCOVERY RATE, NOT A DEFECT RATE.
//
// Never target it downward. Never add a check that "warns" on high deviation counts, never
// rank repos by fewest deviations, never put it in a scorecard where low looks good. The
// instant this number becomes something to minimise, the cheapest way to minimise it is to
// stop writing deviations down — which destroys the most valuable signal in the system and
// leaves the metric looking excellent. A rising deviation count means the loop is working.
//
// (Skalse et al. 2022 on unhackable proxies; Gao et al. 2023 on reward-model
// overoptimisation. The general result is that a proxy optimised hard enough stops
// measuring the thing. This proxy is unusually easy to destroy, so it is fenced here.)
//
// THE EDGE — what makes this a loop rather than telemetry: a deviation appearing in ONE repo
// is an edge case. The SAME deviation appearing in THREE repos is a missing convention.
// Promote it to an ADR and it stops recurring. The recurrence count IS the ADR backlog,
// generated for free. Query it with `--recurrence`.
//
// SHADOW-FIRST (ADR-0086): observes and records, never gates. Always exits 0.
//
// Usage:
//   node scripts/hooks/deviation-log.mjs                 # Stop hook (session from stdin)
//   node scripts/hooks/deviation-log.mjs --repo-dir=DIR --session=SID
//   node scripts/hooks/deviation-log.mjs --json          # machine-readable, no persist
//   node scripts/hooks/deviation-log.mjs --recurrence    # the ADR backlog: deviations seen in ≥N repos

import { readFileSync, existsSync, appendFileSync, mkdirSync } from 'node:fs';
import { join, resolve, basename, dirname } from 'node:path';
import { homedir } from 'node:os';

export const NOTES_FILENAME = 'implementation-notes.md';

/** ~-expansion, matching the other hooks. */
const expand = (p) => (p && p.startsWith('~') ? p.replace('~', homedir()) : p);

/**
 * Extract deviation entries from an implementation-notes.md body. PURE.
 *
 * Accepts the `## Deviations` section (any heading depth) and returns one entry per
 * TOP-LEVEL list item. Wrapped prose lines AND more-deeply-indented sub-bullets both fold
 * into the entry they follow, so a deviation written with supporting detail stays ONE
 * deviation. Parsing stops at the next heading of the same or shallower depth.
 *
 * The indentation rule is load-bearing, not cosmetic. `^\s*` on the item regex used to match
 * indented sub-bullets as fresh entries, so a parent bullet with two detail lines recorded as
 * THREE deviations. That inflates the discovery-rate count and — worse — fragments
 * `recurrenceReport`, which groups by exact normalized text: a real cross-repo convention
 * candidate gets split into sub-fragments that each sit below the >=3-repo threshold and the
 * ADR backlog silently goes empty. Baseline indent is the FIRST item's indent, so a whole
 * section written at a uniform indent still parses as top-level entries.
 *
 * @param {string} markdown
 * @returns {string[]} normalized entry texts, in document order
 */
export function parseDeviations(markdown) {
  if (!markdown) return [];
  const lines = markdown.split(/\r?\n/);
  const entries = [];
  let depth = 0;
  let inSection = false;
  let current = null;
  let baseIndent = null; // indent of the first list item; deeper items are continuations

  const flush = () => {
    if (current === null) return;
    const text = current.replace(/\s+/g, ' ').trim();
    if (text) entries.push(text);
    current = null;
  };

  for (const line of lines) {
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      const thisDepth = heading[1].length;
      if (inSection && thisDepth <= depth) {
        flush();
        inSection = false;
        continue;
      }
      if (!inSection && /^deviations\b/i.test(heading[2].trim())) {
        inSection = true;
        depth = thisDepth;
        baseIndent = null; // each section establishes its own baseline
      }
      continue;
    }
    if (!inSection) continue;

    const item = /^(\s*)(?:[-*+]|\d+[.)])\s+(.*)$/.exec(line);
    if (item) {
      const indent = item[1].replace(/\t/g, '  ').length;
      if (baseIndent === null) baseIndent = indent;
      if (indent > baseIndent && current !== null) {
        current += ` ${item[2].trim()}`; // sub-bullet → detail of the entry above it
      } else {
        flush();
        baseIndent = Math.min(baseIndent, indent);
        current = item[2];
      }
    } else if (current !== null && line.trim()) {
      current += ` ${line.trim()}`;
    } else if (!line.trim()) {
      // A blank line inside a list separates loose items but does NOT end an entry whose
      // sub-bullets follow after it. Only a blank line at base level closes the entry.
      continue;
    }
  }
  flush();
  return entries;
}

/**
 * A stable identity for one deviation. Repo-scoped ON PURPOSE: the same deviation text in a
 * different repo is a DIFFERENT record, because cross-repo recurrence is the signal we are
 * trying to accumulate. Deduping globally on text would erase exactly what we want to count.
 * PURE.
 */
export function deviationKey(repo, text) {
  return `${repo}\u0000${text.toLowerCase().replace(/\s+/g, ' ').trim()}`;
}

/**
 * Which parsed deviations are new relative to what has already been recorded. PURE.
 * @param {{repo:string, entries:string[], recorded:Set<string>}} args
 */
export function newDeviations({ repo, entries, recorded }) {
  const seen = new Set();
  const out = [];
  for (const text of entries) {
    const key = deviationKey(repo, text);
    if (recorded.has(key) || seen.has(key)) continue;
    seen.add(key);
    out.push({ key, text });
  }
  return out;
}

/**
 * Group recorded deviations by normalized text across repos. PURE.
 * Entries present in >= minRepos distinct repos are convention candidates, not edge cases.
 */
export function recurrenceReport(records, { minRepos = 3 } = {}) {
  const byText = new Map();
  for (const r of records) {
    if (!r?.text || !r?.repo) continue;
    const norm = r.text.toLowerCase().replace(/\s+/g, ' ').trim();
    if (!byText.has(norm)) byText.set(norm, { text: r.text, repos: new Set(), count: 0 });
    const e = byText.get(norm);
    e.repos.add(r.repo);
    e.count += 1;
  }
  return [...byText.values()]
    .map((e) => ({ text: e.text, repos: [...e.repos].sort(), repoCount: e.repos.size, count: e.count }))
    .filter((e) => e.repoCount >= minRepos)
    .sort((a, b) => b.repoCount - a.repoCount || b.count - a.count);
}

// ─────────────────────────── I/O boundary ───────────────────────────

function readJsonl(path) {
  if (!existsSync(path)) return [];
  const out = [];
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try {
      out.push(JSON.parse(line));
    } catch {
      /* a torn last line never kills the pass */
    }
  }
  return out;
}

function parseArgs(argv) {
  const args = {};
  for (const a of argv.slice(2)) {
    const m = /^--([^=]+)(?:=(.*))?$/.exec(a);
    if (m) args[m[1]] = m[2] ?? true;
  }
  return args;
}

async function readStdin() {
  if (process.stdin.isTTY) return '';
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  return Buffer.concat(chunks).toString('utf8');
}

/** Walk up from `start` looking for implementation-notes.md; returns its path or null. */
export function findNotes(start, { levels = 4 } = {}) {
  let dir = resolve(start);
  for (let i = 0; i < levels; i += 1) {
    const candidate = join(dir, NOTES_FILENAME);
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

async function main() {
  const args = parseArgs(process.argv);
  const ledgerRoot = expand(args['ledger-root'] ?? '~/.local/state/ojfbot/tracking');
  const outPath = expand(args.out ?? join(ledgerRoot, 'deviations.jsonl'));

  if (args.recurrence) {
    const report = recurrenceReport(readJsonl(outPath), {
      minRepos: Number(args['min-repos'] ?? 3),
    });
    if (args.json) console.log(JSON.stringify(report, null, 2));
    else if (!report.length) console.log('[deviation-log] no deviation recurs across the threshold yet.');
    else {
      console.log('[deviation-log] convention candidates (recurring across repos → open an ADR):');
      for (const e of report) console.log(`  ${e.repoCount} repos [${e.repos.join(', ')}] — ${e.text}`);
    }
    return;
  }

  let sessionId = args.session ?? '';
  if (!sessionId) {
    try {
      sessionId = JSON.parse(await readStdin())?.session_id ?? '';
    } catch {
      /* no session identity — still record; the deviation matters more than the join */
    }
  }

  const repoDir = resolve(expand(args['repo-dir'] ?? process.cwd()));
  const notesPath = args.notes ? expand(args.notes) : findNotes(repoDir);
  if (!notesPath) return; // no notes file — nothing to observe, not an error

  const repo = basename(resolve(dirname(notesPath)));
  const entries = parseDeviations(readFileSync(notesPath, 'utf8'));
  const recorded = new Set(readJsonl(outPath).map((r) => r.key).filter(Boolean));
  const fresh = newDeviations({ repo, entries, recorded });

  if (args.json) {
    console.log(JSON.stringify({ repo, notesPath, total: entries.length, new: fresh.length, entries: fresh }, null, 2));
    return;
  }
  if (!fresh.length) return;

  const ts = new Date().toISOString();
  mkdirSync(dirname(outPath), { recursive: true });
  const rows = fresh
    .map((d) =>
      JSON.stringify({
        ts,
        event: 'harness:deviation',
        mode: 'shadow',
        harness: 'deviation-log',
        repo,
        session_id: sessionId || null,
        artifact_ref: notesPath,
        key: d.key,
        text: d.text,
      }),
    )
    .join('\n');
  appendFileSync(outPath, `${rows}\n`);
  console.error(`[deviation-log] +${fresh.length} deviation(s) recorded for ${repo} (discovery rate — never minimise)`);
}

const invokedDirectly = process.argv[1] && resolve(process.argv[1]).endsWith('deviation-log.mjs');
if (invokedDirectly) {
  main().catch((err) => {
    // A measurement never blocks a session. Report and exit clean.
    console.error(`[deviation-log] non-fatal: ${err?.message ?? err}`);
  });
}
