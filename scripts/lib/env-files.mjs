/**
 * env-files.mjs — the pure half of scripts/env-files-check.mjs (adr:package-env-files).
 *
 * Rules:
 *   ERROR  a tracked env file (`.env`, `.env.<anything>`) other than `.env.example`. It is never read.
 *   ERROR  a tracked `.env.example` line with a real-looking value, or a line that is not KEY=VALUE.
 *   WARN   a placeholder-like value (`sk-ant-...`): use blank or `<placeholder>` instead.
 *   WARN   the repository-level `.env.example`, which belongs to the package that reads it.
 *   WARN   an application package that reads its environment but has no `.env.example`.
 * Findings name keys and paths only. A value is never copied into a message.
 */
import path from 'node:path';

const KEY = /^[A-Za-z_][A-Za-z0-9_]*$/;
const PLACEHOLDER = /^<[^<>]*>$/;
const FAKE = /(\.\.\.|x{4,}|\b(your|example|changeme|replace|todo)\b)/i;
const READS_ENV = /\bprocess\.env\b|\bos\.environ\b|\bos\.getenv\b/;
const SOURCE = /^packages\/([^/]+)\/(?:src\/)?.*\.(?:[cm]?[jt]s|py)$/;
const TEST = /(^|\/)(__tests__|tests?)\/|\.test\.[cm]?[jt]s$|(^|\/)test_[^/]*\.py$/;

export function classifyEnvPath(file) {
  const base = path.posix.basename(file);
  if (base === '.env.example') return 'example';
  if (base === '.env' || base.startsWith('.env.')) return 'env';
  return null;
}

function unquote(value) {
  const v = value.trim();
  if (v.length >= 2 && v[0] === v[v.length - 1] && (v[0] === '"' || v[0] === "'")) return v.slice(1, -1);
  return v;
}

export function exampleFindings(file, text) {
  const findings = [];
  text.split(/\r?\n/).forEach((raw, index) => {
    const line = raw.trim();
    if (!line || line.startsWith('#')) return;
    const eq = line.indexOf('=');
    const key = eq > 0 ? line.slice(0, eq).trim() : '';
    if (!KEY.test(key)) {
      findings.push({ level: 'ERROR', path: file, message: `line ${index + 1} is not KEY=VALUE` });
      return;
    }
    const value = unquote(line.slice(eq + 1));
    if (value === '' || PLACEHOLDER.test(value)) return;
    if (FAKE.test(value)) {
      findings.push({ level: 'WARN', path: file, message: `${key} has a placeholder-like value; use blank or <placeholder>` });
    } else {
      findings.push({ level: 'ERROR', path: file, message: `${key} has a real-looking value; an example file holds blanks or <placeholders> only` });
    }
  });
  return findings;
}

/** `tracked`: repository-relative paths (git ls-files); `read(path)`: file text. */
export function scan({ tracked, read }) {
  const findings = [];
  const examples = new Set();
  const readers = new Set();
  for (const file of tracked) {
    const kind = classifyEnvPath(file);
    if (kind === 'env') {
      findings.push({ level: 'ERROR', path: file, message: 'env file is tracked; remove it from git and rotate any value it held' });
      continue;
    }
    if (kind === 'example') {
      examples.add(path.posix.dirname(file));
      if (file === '.env.example') {
        findings.push({ level: 'WARN', path: file, message: 'repository-level example: move its keys into the package that reads them' });
      }
      findings.push(...exampleFindings(file, read(file)));
      continue;
    }
    const match = SOURCE.exec(file);
    if (match && !TEST.test(file) && READS_ENV.test(read(file))) readers.add(match[1]);
  }
  for (const name of [...readers].sort()) {
    if (!examples.has(`packages/${name}`)) {
      findings.push({ level: 'WARN', path: `packages/${name}`, message: 'reads its environment but has no .env.example (migrate to a settings module)' });
    }
  }
  return findings;
}
