#!/usr/bin/env node
/**
 * fleet-map-d5.mjs — CLI for the generated D5 diagram.
 *
 *   node scripts/fleet-map-d5.mjs                 # print the section to stdout (default)
 *   node scripts/fleet-map-d5.mjs --json          # print stats + warnings as JSON
 *   node scripts/fleet-map-d5.mjs --append        # append to ~/selfco/diagrams/fleet-map.md
 *   node scripts/fleet-map-d5.mjs --append --out <path>
 *
 * Append follows the standing file's update discipline: new diagrams are APPENDED with a dated
 * heading (never a rewrite of the existing D1–D8). Refuses if the target file does not exist —
 * this generator maintains one section of a standing file, it does not create the file.
 *
 * Logic and the golden test live in `scripts/lib/fleet-map-d5.mjs`.
 */
import { existsSync, readFileSync, appendFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildD5, renderSection } from './lib/fleet-map-d5.mjs';

const CORE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_OUT = path.join(os.homedir(), 'selfco', 'diagrams', 'fleet-map.md');

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const valueOf = (f) => {
  const i = argv.indexOf(f);
  return i >= 0 ? argv[i + 1] : undefined;
};

const built = buildD5(CORE_ROOT, { today: valueOf('--today') });
for (const w of built.warnings) process.stderr.write(`! ${w}\n`);

if (has('--json')) {
  process.stdout.write(`${JSON.stringify({ stats: built.stats, warnings: built.warnings }, null, 2)}\n`);
  process.exit(0);
}

const section = renderSection(built);

if (!has('--append')) {
  process.stdout.write(section);
  process.exit(0);
}

const out = valueOf('--out') || DEFAULT_OUT;
if (!existsSync(out)) {
  process.stderr.write(`fleet-map-d5: standing file not found at ${out} — nothing to append to.\n`);
  process.exit(1);
}
const existing = readFileSync(out, 'utf8');
if (existing.includes(`## ${built.stats.today} · D5 regenerated from the registry`)) {
  process.stderr.write(`fleet-map-d5: a D5 section for ${built.stats.today} is already in ${out} — not appending twice.\n`);
  process.exit(1);
}
appendFileSync(out, `\n---\n\n${section}`);
process.stdout.write(`fleet-map-d5: appended D5 (${built.stats.nodes} nodes) to ${out}\n`);
