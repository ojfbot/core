#!/usr/bin/env node
/**
 * read-api-context.js — read daily-logger structured JSON API
 *
 * Aggregates data from the daily-logger api/ directory into a single context
 * object for frame-standup consumption. Falls back gracefully when the API
 * files are unavailable.
 *
 * Usage: node read-api-context.js [--json]
 *   --json   Output raw JSON (default: human-readable summary)
 *
 * Output fields:
 *   apiAvailable        — true if api/entries.json was readable
 *   latestEntry         — newest article metadata (date, title, summary, status,
 *                         activityType, tags, reposActive, commitCount, decisions, actions)
 *   openActions         — full open action backlog from actions.json
 *   recentlyClosedActions — done-actions.json entries closed in last 7 days
 *   repoStats           — per-repo statistics from repos.json
 *   staleDays           — number of days since the latest entry (0 = today)
 *
 * Exit codes: 0 = success (apiAvailable may be false), 1 = unexpected error
 */
'use strict';

const fs = require('fs');
const path = require('path');

const API_DIR = path.join(process.env.HOME, 'ojfbot/daily-logger/api');
const asJson = process.argv.includes('--json');

function readJson(filename) {
  const filePath = path.join(API_DIR, filename);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function daysBetween(dateStr, now) {
  const d = new Date(dateStr + 'T00:00:00Z');
  const diff = now - d.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

try {
  const entries = readJson('entries.json');

  if (!entries || !entries.length) {
    const result = { apiAvailable: false };
    if (asJson) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log('API not available — api/entries.json missing or empty');
    }
    process.exit(0);
  }

  const now = new Date();
  const latest = entries[0];

  // Open actions backlog
  const openActions = readJson('actions.json') || [];

  // Recently closed actions (last 7 days)
  const allDone = readJson('done-actions.json') || [];
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const recentlyClosedActions = allDone.filter(a => {
    if (!a.closedDate) return false;
    return new Date(a.closedDate + 'T00:00:00Z') >= sevenDaysAgo;
  });

  // Repo stats
  const repoStats = readJson('repos.json') || [];

  // Staleness
  const staleDays = daysBetween(latest.date, now.getTime());

  const result = {
    apiAvailable: true,
    latestEntry: {
      date: latest.date,
      title: latest.title,
      summary: latest.summary,
      status: latest.status || 'accepted',
      activityType: latest.activityType || 'build',
      tags: latest.tags || [],
      reposActive: latest.reposActive || [],
      commitCount: latest.commitCount || 0,
      decisions: latest.decisions || [],
      actions: latest.actions || [],
    },
    openActions,
    recentlyClosedActions,
    repoStats,
    staleDays,
  };

  if (asJson) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    const e = result.latestEntry;
    console.log(`Latest entry: ${e.date} — "${e.title}"`);
    console.log(`Status: ${e.status} · Activity: ${e.activityType} · Commits: ${e.commitCount}`);
    console.log(`Repos active: ${e.reposActive.join(', ')}`);
    console.log(`Staleness: ${staleDays} day(s)`);
    console.log();
    console.log(`Open actions: ${openActions.length}`);
    for (const a of openActions) {
      console.log(`  ${a.command} · ${a.repo} — ${a.description.slice(0, 80)}...`);
    }
    console.log();
    console.log(`Recently closed (7d): ${recentlyClosedActions.length}`);
    console.log(`Decisions in latest: ${e.decisions.length}`);
    console.log(`Tags: ${e.tags.map(t => typeof t === 'string' ? t : t.name).join(', ')}`);
  }
} catch (e) {
  console.error('Error:', e.message);
  process.exit(1);
}
