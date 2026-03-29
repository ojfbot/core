#!/usr/bin/env node
// TD-001: Lint rule to catch string shorthand in vite-plugin-federation shared config.
// String shorthand (e.g. shared: ['react']) doesn't set singleton/requiredVersion,
// causing duplicate module loading. All configs must use explicit object form.
//
// Usage: node scripts/lint-federation-shared.js

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const SKIP = ['node_modules', '.pnpm', 'dist', '_site', '.claude/worktrees'];

function findViteConfigs(dir) {
  const results = [];
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory() && !SKIP.some(s => full.includes(s))) {
        results.push(...findViteConfigs(full));
      } else if (entry.isFile() && /^vite\.config\.(ts|js|mts|mjs)$/.test(entry.name)) {
        results.push(full);
      }
    }
  } catch {}
  return results;
}

const violations = [];

for (const file of findViteConfigs(ROOT)) {
  const src = fs.readFileSync(file, 'utf8');
  if (!src.includes('federation')) continue;

  const lines = src.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Detect shared: ['...'] array form
    if (/shared\s*:\s*\[/.test(line)) {
      violations.push({ file, line: i + 1, reason: 'shared uses array shorthand' });
    }
    // Detect string values inside shared object: 'pkg' or "pkg" without ':'
    // e.g. shared: { 'react', 'react-dom' }
    if (/shared\s*:\s*\{/.test(line)) {
      // Scan forward to find the closing brace
      for (let j = i; j < Math.min(i + 30, lines.length); j++) {
        // Match lines that are just a quoted string (possibly with comma) — no colon
        if (/^\s*['"][^'"]+['"]\s*,?\s*$/.test(lines[j]) && !lines[j].includes(':')) {
          violations.push({ file, line: j + 1, reason: 'shared entry is string shorthand (missing singleton/requiredVersion)' });
        }
        if (lines[j].includes('}') && j > i) break;
      }
    }
  }
}

if (violations.length === 0) {
  console.log('lint-federation-shared: OK — all federation shared configs use explicit object form');
  process.exit(0);
} else {
  console.error('lint-federation-shared: FAIL — string shorthand detected in federation shared config\n');
  for (const v of violations) {
    console.error(`  ${path.relative(ROOT, v.file)}:${v.line}  ${v.reason}`);
  }
  console.error('\nFix: use object form with singleton + requiredVersion for every shared entry.');
  console.error('See: shell/packages/shell-app/vite.config.ts for the correct pattern.');
  process.exit(1);
}
