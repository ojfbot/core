#!/usr/bin/env node
/**
 * find-latest-post.js — locate the most recent daily-logger article
 *
 * Reads from origin/main (via git show) so it always sees the latest published
 * article regardless of which branch the local daily-logger checkout is on.
 * Falls back to local filesystem if the git read fails.
 *
 * Usage: node find-latest-post.js [--json]
 *   --json   Output raw JSON (default: human-readable)
 *
 * Output: date, filePath, title, url (derived Jekyll URL at log.jim.software)
 *   filePath — absolute path if local, or "git:origin/main:_articles/<file>" if remote-only
 * Exit codes: 0 = found, 1 = error or no articles
 */
'use strict';

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const REPO_DIR = path.join(process.env.HOME, 'ojfbot/daily-logger');
const ARTICLES_DIR = path.join(REPO_DIR, '_articles');
const BASE_URL = 'https://log.jim.software';
const asJson = process.argv.includes('--json');

function run(cmd, opts = {}) {
  return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], ...opts }).trim();
}

function deriveUrl(date, title) {
  const [year, month, day] = date.split('-');
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60);
  return `${BASE_URL}/${year}/${month}/${day}/${slug}`;
}

function extractTitle(content, fallback) {
  const m = content.match(/^title:\s*"?([^"\n]+)"?\s*$/m);
  return m ? m[1].trim() : fallback;
}

try {
  // --- Strategy 1: list articles from origin/main via git ls-tree ---
  let latestDate = null;
  let content = null;
  let filePath = null;
  let onOriginMain = false;

  try {
    const lsOut = run(`git -C "${REPO_DIR}" ls-tree --name-only origin/main _articles/`);
    const remoteFiles = lsOut
      .split('\n')
      .map(f => path.basename(f))
      .filter(f => /^\d{4}-\d{2}-\d{2}\.md$/.test(f))
      .sort()
      .reverse();

    if (remoteFiles.length) {
      const latest = remoteFiles[0];
      latestDate = latest.replace('.md', '');
      content = run(`git -C "${REPO_DIR}" show origin/main:_articles/${latest}`);
      filePath = path.join(ARTICLES_DIR, latest);
      // Prefer local file path if it exists on disk, otherwise signal remote-only
      if (!fs.existsSync(filePath)) {
        filePath = `git:origin/main:_articles/${latest}`;
        onOriginMain = true;
      }
    }
  } catch (_) {
    // git unavailable or repo not found — fall through to local filesystem
  }

  // --- Strategy 2: fall back to local filesystem ---
  if (!latestDate) {
    const localFiles = fs.readdirSync(ARTICLES_DIR)
      .filter(f => /^\d{4}-\d{2}-\d{2}\.md$/.test(f))
      .sort()
      .reverse();

    if (!localFiles.length) {
      console.error('No articles found in', ARTICLES_DIR, '(local) or origin/main');
      process.exit(1);
    }

    const latest = localFiles[0];
    latestDate = latest.replace('.md', '');
    filePath = path.join(ARTICLES_DIR, latest);
    content = fs.readFileSync(filePath, 'utf8');
  }

  const title = extractTitle(content, latestDate);
  const url = deriveUrl(latestDate, title);

  const result = { date: latestDate, filePath, title, url, onOriginMain };

  if (asJson) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`Date:  ${latestDate}`);
    console.log(`Title: ${title}`);
    console.log(`File:  ${filePath}`);
    console.log(`URL:   ${url}`);
  }
} catch (e) {
  console.error('Error:', e.message);
  process.exit(1);
}
