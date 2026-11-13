#!/usr/bin/env node
/**
 * env-files-check.mjs — keep secrets out of the public repository (adr:package-env-files).
 *
 *   node scripts/env-files-check.mjs           print findings, exit 0
 *   node scripts/env-files-check.mjs --check   CI: exit 1 on any ERROR; WARNs stay visible but pass
 *
 * Scans tracked files only (`git ls-files`). A tracked env file is reported by path and never opened.
 * Rules and messages live in scripts/lib/env-files.mjs.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scan } from './lib/env-files.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean);
const findings = scan({
  tracked,
  read: file => {
    try {
      return readFileSync(path.join(root, file), 'utf8');
    } catch {
      return '';
    }
  },
});
for (const f of findings) console.log(`${f.level} ${f.path}: ${f.message}`);
const errors = findings.filter(f => f.level === 'ERROR').length;
console.log(`env-files-check: ${errors} error(s), ${findings.length - errors} warning(s)`);
if (process.argv.includes('--check') && errors) process.exit(1);
