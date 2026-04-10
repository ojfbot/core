#!/usr/bin/env node
/**
 * read-app-standup.js — read per-app standup extensions from all tracked repos
 *
 * Each repo can optionally contain .claude/standup.md with structured blockers,
 * priorities, and open work. This script reads all of them into a single JSON
 * array for /frame-standup consumption.
 *
 * Usage: node read-app-standup.js [--json]
 *   --json   Output raw JSON (default: human-readable summary)
 *
 * Output: Array of { repo, found, blockers[], priorities[], openWork[], context }
 *
 * Exit codes: 0 = success, 1 = unexpected error
 */
'use strict';

const fs = require('fs');
const path = require('path');

const REPOS = [
  'cv-builder',
  'shell',
  'blogengine',
  'TripPlanner',
  'mrplug',
  'purefoy',
  'daily-logger',
  'lean-canvas',
  'gastown-pilot',
  'core-reader',
  'seh-study',
  'frame-ui-components',
];

const BASE = path.join(process.env.HOME, 'ojfbot');
const asJson = process.argv.includes('--json');

/**
 * Parse a standup.md file into structured data.
 * Expects sections: ## Current blockers, ## This week's priorities,
 * ## Open work, ## Context for today
 */
function parseStandup(content) {
  const result = { blockers: [], priorities: [], openWork: [], context: '' };

  // Split by ## headings
  const sections = content.split(/^## /m).slice(1); // skip content before first ##

  for (const section of sections) {
    const lines = section.split('\n');
    const heading = lines[0].trim().toLowerCase();
    const body = lines.slice(1).join('\n').trim();

    if (heading.includes('blocker')) {
      result.blockers = parseListItems(body);
    } else if (heading.includes('priorit')) {
      result.priorities = parseListItems(body);
    } else if (heading.includes('open work')) {
      result.openWork = parseChecklistItems(body);
    } else if (heading.includes('context')) {
      result.context = body;
    }
  }

  return result;
}

/** Parse markdown list items (- item) into strings */
function parseListItems(text) {
  return text
    .split('\n')
    .map(l => l.replace(/^[-*]\s+/, '').trim())
    .filter(Boolean);
}

/** Parse markdown checklist items (- [ ] / - [x]) into { task, done } */
function parseChecklistItems(text) {
  return text
    .split('\n')
    .filter(l => /^[-*]\s+\[/.test(l.trim()))
    .map(l => {
      const done = /\[x\]/i.test(l);
      const task = l.replace(/^[-*]\s+\[.\]\s*/, '').trim();
      return { task, done };
    });
}

try {
  const results = [];

  for (const repo of REPOS) {
    const standupPath = path.join(BASE, repo, '.claude', 'standup.md');
    const row = { repo, found: false, blockers: [], priorities: [], openWork: [], context: '' };

    if (fs.existsSync(standupPath)) {
      const content = fs.readFileSync(standupPath, 'utf8');
      row.found = true;
      Object.assign(row, parseStandup(content));
    }

    results.push(row);
  }

  if (asJson) {
    console.log(JSON.stringify(results, null, 2));
  } else {
    const found = results.filter(r => r.found);
    const missing = results.filter(r => !r.found);

    console.log(`Standup extensions found: ${found.length}/${results.length}\n`);

    for (const r of found) {
      console.log(`── ${r.repo}`);
      if (r.blockers.length) {
        console.log(`  Blockers: ${r.blockers.length}`);
        for (const b of r.blockers) console.log(`    - ${b}`);
      }
      if (r.priorities.length) {
        console.log(`  Priorities: ${r.priorities.length}`);
        for (const p of r.priorities) console.log(`    - ${p}`);
      }
      if (r.openWork.length) {
        const done = r.openWork.filter(w => w.done).length;
        console.log(`  Open work: ${r.openWork.length} (${done} done)`);
      }
      if (r.context) {
        console.log(`  Context: ${r.context.slice(0, 100)}...`);
      }
      console.log();
    }

    if (missing.length) {
      console.log(`No standup.md: ${missing.map(r => r.repo).join(', ')}`);
    }
  }
} catch (e) {
  console.error('Error:', e.message);
  process.exit(1);
}
