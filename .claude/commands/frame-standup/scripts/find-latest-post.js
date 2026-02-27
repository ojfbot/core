#!/usr/bin/env node
/**
 * find-latest-post.js — locate the most recent daily-logger article
 *
 * Usage: node find-latest-post.js [--json]
 *   --json   Output raw JSON (default: human-readable)
 *
 * Output: date, filePath, title, url (derived Jekyll URL at log.jim.software)
 * Exit codes: 0 = found, 1 = error or no articles
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ARTICLES_DIR = path.join(process.env.HOME, 'ojfbot/daily-logger/_articles');
const BASE_URL = 'https://log.jim.software';
const asJson = process.argv.includes('--json');

try {
  const files = fs.readdirSync(ARTICLES_DIR)
    .filter(f => /^\d{4}-\d{2}-\d{2}\.md$/.test(f))
    .sort()
    .reverse();

  if (!files.length) {
    console.error('No articles found in', ARTICLES_DIR);
    process.exit(1);
  }

  const latest = files[0];
  const date = latest.replace('.md', '');
  const filePath = path.join(ARTICLES_DIR, latest);
  const content = fs.readFileSync(filePath, 'utf8');

  // Extract title from YAML frontmatter
  const titleMatch = content.match(/^title:\s*"?([^"\n]+)"?\s*$/m);
  const title = titleMatch ? titleMatch[1].trim() : date;

  // Derive Jekyll URL: /<year>/<month>/<day>/<slug>
  const [year, month, day] = date.split('-');
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60);
  const url = `${BASE_URL}/${year}/${month}/${day}/${slug}`;

  const result = { date, filePath, title, url };

  if (asJson) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`Date:  ${date}`);
    console.log(`Title: ${title}`);
    console.log(`File:  ${filePath}`);
    console.log(`URL:   ${url}`);
  }
} catch (e) {
  console.error('Error:', e.message);
  process.exit(1);
}
