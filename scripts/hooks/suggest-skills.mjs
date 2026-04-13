#!/usr/bin/env node
/**
 * suggest-skills.mjs — Skill suggestion engine
 *
 * Reusable engine for skill suggestions across both agent-to-agent workflows
 * (orchestration layers) and human-facing prompt matching (suggest-skill.sh).
 *
 * Usage:
 *   node suggest-skills.mjs --query "plan a new feature"
 *   node suggest-skills.mjs --tags "debug,api" --layer 3
 *   node suggest-skills.mjs --after "/plan-feature" --limit 2
 *   node suggest-skills.mjs --phase "debugging" --tags "trace" --format oneline
 *
 * Options:
 *   --query "text"        Match against triggers[] (word-overlap scoring)
 *   --tags "a,b,c"        Match against catalog tags[] (intersection scoring)
 *   --phase "phase"       Match against catalog phase field
 *   --layer 0|1|2|3       Filter by layer_affinity[] (new catalog field)
 *   --after "/skill"      Match against suggested_after[] (skill chaining)
 *   --limit N             Max suggestions (default: 3)
 *   --format json|oneline Output format (default: json)
 *
 * Scoring:
 *   +10 per suggested_after match (strongest — skill chaining)
 *    +5 if phase matches
 *    +3 per tag intersection
 *    +2 per trigger word that appears in query
 *
 * Reads skill-catalog.json from the skill-loader knowledge directory.
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Parse CLI args ──────────────────────────────────────────────────────────

function parseArgs(argv) {
  const result = {};
  for (const arg of argv) {
    const match = arg.match(/^--([^=]+)=(.+)$/);
    if (match) result[match[1]] = match[2];
  }
  return result;
}

const args = parseArgs(process.argv.slice(2));
const query = (args.query ?? '').toLowerCase();
const inputTags = args.tags ? args.tags.split(',').map(t => t.trim().toLowerCase()) : [];
const phase = (args.phase ?? '').toLowerCase();
const layer = args.layer != null ? parseInt(args.layer, 10) : null;
const afterSkill = (args.after ?? '').replace(/^\//, '').toLowerCase();
const limit = parseInt(args.limit ?? '3', 10);
const format = args.format ?? 'json';

// ── Load catalog ────────────────────────────────────────────────────────────

const catalogPaths = [
  resolve(__dirname, '../../.claude/skills/skill-loader/knowledge/skill-catalog.json'),
  resolve(process.env.CLAUDE_PROJECT_DIR ?? '.', '.claude/skills/skill-loader/knowledge/skill-catalog.json'),
];

let catalog = null;
for (const p of catalogPaths) {
  try {
    catalog = JSON.parse(readFileSync(p, 'utf8'));
    break;
  } catch { /* try next */ }
}

if (!catalog?.skills) {
  console.error('skill-catalog.json not found');
  process.exit(1);
}

// ── Tokenize query for word-overlap matching ────────────────────────────────

const stopWords = new Set([
  'i', 'me', 'my', 'we', 'our', 'you', 'your', 'the', 'a', 'an', 'is',
  'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do',
  'does', 'did', 'will', 'would', 'could', 'should', 'can', 'may', 'might',
  'shall', 'to', 'of', 'in', 'for', 'on', 'at', 'by', 'with', 'from',
  'up', 'out', 'it', 'its', 'this', 'that', 'these', 'those', 'and', 'or',
  'but', 'not', 'no', 'so', 'if', 'then', 'than', 'just', 'also', 'very',
  'too', 'some', 'any', 'all', 'each', 'every', 'need', 'want', 'let',
]);

function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 1 && !stopWords.has(w));
}

const queryWords = query ? tokenize(query) : [];

// ── Score each skill ────────────────────────────────────────────────────────

const scored = [];

for (const skill of catalog.skills) {
  // Layer filter: if --layer given and skill has layer_affinity, must match
  if (layer != null && skill.layer_affinity?.length > 0) {
    if (!skill.layer_affinity.includes(layer)) continue;
  }

  let score = 0;
  const reasons = [];

  // +10 per suggested_after match
  if (afterSkill && skill.suggested_after?.length > 0) {
    for (const after of skill.suggested_after) {
      if (after.replace(/^\//, '').toLowerCase() === afterSkill) {
        score += 10;
        reasons.push(`follows /${afterSkill}`);
      }
    }
  }

  // +5 if phase matches
  if (phase && skill.phase?.toLowerCase() === phase) {
    score += 5;
    reasons.push(`${phase} phase`);
  }

  // +3 per tag intersection
  if (inputTags.length > 0 && skill.tags) {
    const skillTags = skill.tags.map(t => t.toLowerCase());
    const overlap = inputTags.filter(t => skillTags.includes(t));
    if (overlap.length > 0) {
      score += overlap.length * 3;
      reasons.push(`tags [${overlap.join(', ')}]`);
    }
  }

  // +2 per trigger word overlap with query (word-level, not exact substring)
  if (queryWords.length > 0 && skill.triggers) {
    let bestTriggerScore = 0;
    let bestTrigger = '';

    for (const trigger of skill.triggers) {
      const triggerWords = tokenize(trigger);
      if (triggerWords.length === 0) continue;

      // Count how many trigger words appear in the query
      const matchedWords = triggerWords.filter(tw => queryWords.includes(tw));
      const triggerScore = matchedWords.length * 2;

      // Bonus: if ALL trigger words matched, add extra weight
      if (matchedWords.length === triggerWords.length && triggerWords.length > 0) {
        const fullMatchScore = triggerScore + 3;
        if (fullMatchScore > bestTriggerScore) {
          bestTriggerScore = fullMatchScore;
          bestTrigger = trigger;
        }
      } else if (triggerScore > bestTriggerScore) {
        bestTriggerScore = triggerScore;
        bestTrigger = trigger;
      }
    }

    if (bestTriggerScore > 0) {
      score += bestTriggerScore;
      reasons.push(`trigger '${bestTrigger}'`);
    }
  }

  if (score > 0) {
    scored.push({
      name: skill.name,
      score,
      reason: reasons.join(' + '),
      command: `/${skill.name}`,
      description: skill.description,
    });
  }
}

// ── Sort and limit ──────────────────────────────────────────────────────────

scored.sort((a, b) => b.score - a.score);
const results = scored.slice(0, limit);

// ── Output ──────────────────────────────────────────────────────────────────

if (format === 'oneline') {
  for (const r of results) {
    console.log(`${r.command} — ${r.reason}`);
  }
} else {
  console.log(JSON.stringify(results.map(({ name, reason, command }) => ({ name, reason, command }))));
}
