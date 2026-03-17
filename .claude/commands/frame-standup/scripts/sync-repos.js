#!/usr/bin/env node
/**
 * sync-repos.js — fetch origin + report status for all tracked ojfbot repos
 *
 * Usage: node sync-repos.js [--json]
 *   --json   Output raw JSON (default: human-readable table)
 *
 * Exit codes: 0 = all synced, 1 = one or more errors
 */
'use strict';

const { execSync } = require('child_process');
const path = require('path');

const REPOS = [
  'cv-builder',
  'shell',
  'blogengine',
  'TripPlanner',
  'mrplug',
  'purefoy',
  'daily-logger',
  'core',
  'lean-canvas',
];

const BASE = path.join(process.env.HOME, 'ojfbot');
const asJson = process.argv.includes('--json');

function run(cmd, opts = {}) {
  return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], ...opts }).trim();
}

let hasError = false;
const results = [];

for (const repo of REPOS) {
  const dir = path.join(BASE, repo);
  const row = { repo, branch: '?', status: '?', error: null };

  try {
    // Fetch — updates remote-tracking refs so we see the true remote state
    run(`git -C "${dir}" fetch origin --quiet`);

    // Branch + tracking status from status -sb
    const statusLine = run(`git -C "${dir}" status -sb`).split('\n')[0];
    // e.g. "## main...origin/main [ahead 2, behind 1]"
    const branchMatch = statusLine.match(/^## (.+?)(?:\.\.\.(.+?))?(?:\s+\[(.+?)\])?$/);
    row.branch = branchMatch ? branchMatch[1] : '?';
    const tracking = branchMatch && branchMatch[3] ? branchMatch[3] : 'up to date';

    // Check for uncommitted changes
    const dirty = run(`git -C "${dir}" status --porcelain`);

    // Pull fast-forward if behind and clean — keeps local branch current
    const isBehind = tracking.includes('behind') && !tracking.includes('ahead');
    if (isBehind && !dirty) {
      run(`git -C "${dir}" pull --ff-only --quiet`);
      row.status = 'pulled';
    } else if (dirty) {
      const count = dirty.split('\n').filter(Boolean).length;
      const behindNote = isBehind ? tracking + '; ' : '';
      row.status = `${behindNote}${count} uncommitted`;
    } else if (tracking.includes('ahead')) {
      row.status = tracking; // local has unpushed commits
    } else {
      row.status = 'clean';
    }
  } catch (e) {
    row.error = e.message.split('\n')[0].slice(0, 80);
    row.status = 'ERROR';
    hasError = true;
  }

  results.push(row);
}

if (asJson) {
  console.log(JSON.stringify(results, null, 2));
} else {
  const pad = (s, n) => String(s).padEnd(n);
  console.log(pad('REPO', 16) + pad('BRANCH', 40) + 'STATUS');
  console.log('-'.repeat(80));
  for (const r of results) {
    const status = r.error ? `ERROR: ${r.error}` : r.status;
    console.log(pad(r.repo, 16) + pad(r.branch, 40) + status);
  }
}

process.exit(hasError ? 1 : 0);
