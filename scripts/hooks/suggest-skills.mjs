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
 *
 * IMPORTANT (rm:rm-l1-core#S8): the scoring loop is exported as `scoreCatalog`
 * so the eval harness (scripts/suggester-eval.mjs) replays gold prompts through
 * the EXACT production scorer and receives the FULL pre-limit sorted scored set
 * (rank metrics need what the `--limit` slice throws away). The CLI behavior is
 * unchanged — the limit is applied only in the CLI path below.
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Tokenize for word-overlap matching ──────────────────────────────────────

const stopWords = new Set([
  'i', 'me', 'my', 'we', 'our', 'you', 'your', 'the', 'a', 'an', 'is',
  'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do',
  'does', 'did', 'will', 'would', 'could', 'should', 'can', 'may', 'might',
  'shall', 'to', 'of', 'in', 'for', 'on', 'at', 'by', 'with', 'from',
  'up', 'out', 'it', 'its', 'this', 'that', 'these', 'those', 'and', 'or',
  'but', 'not', 'no', 'so', 'if', 'then', 'than', 'just', 'also', 'very',
  'too', 'some', 'any', 'all', 'each', 'every', 'need', 'want', 'let',
]);

export function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 1 && !stopWords.has(w));
}

// ── Catalog loading ─────────────────────────────────────────────────────────

/** Load skill-catalog.json (repo-relative first, then $CLAUDE_PROJECT_DIR). */
export function loadCatalog() {
  const catalogPaths = [
    resolve(__dirname, '../../.claude/skills/skill-loader/knowledge/skill-catalog.json'),
    resolve(process.env.CLAUDE_PROJECT_DIR ?? '.', '.claude/skills/skill-loader/knowledge/skill-catalog.json'),
  ];
  for (const p of catalogPaths) {
    try {
      return JSON.parse(readFileSync(p, 'utf8'));
    } catch { /* try next */ }
  }
  return null;
}

// ── Scoring (the production scorer — exported for the S8 eval harness) ──────

/**
 * Score every active catalog skill against the inputs and return the FULL
 * sorted scored set (descending score; no limit applied — that's the caller's
 * concern). Pure over its inputs; deterministic (stable sort, catalog order
 * breaks ties).
 *
 * @param {{query?:string, tags?:string[], phase?:string, layer?:number|null, after?:string}} inputs
 * @param {{skills:object[]}} catalog
 * @returns {{name:string, score:number, reason:string, command:string, description:string}[]}
 */
export function scoreCatalog(inputs, catalog) {
  const query = (inputs.query ?? '').toLowerCase();
  const inputTags = (inputs.tags ?? []).map(t => t.trim().toLowerCase()).filter(Boolean);
  const phase = (inputs.phase ?? '').toLowerCase();
  const layer = inputs.layer ?? null;
  const afterSkill = (inputs.after ?? '').replace(/^\//, '').toLowerCase();
  const queryWords = query ? tokenize(query) : [];

  const scored = [];

  for (const skill of catalog.skills) {
    // Lifecycle filter: only `active` skills are auto-suggested.
    // Absence of the `status` field ≡ active. See naming-guide.md "Skill lifecycle".
    if (skill.status != null && skill.status !== 'active') continue;

    // Layer filter: if layer given and skill has layer_affinity, must match
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

  scored.sort((a, b) => b.score - a.score);
  return scored;
}

// ── CLI ─────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const result = {};
  for (const arg of argv) {
    const match = arg.match(/^--([^=]+)=(.+)$/);
    if (match) result[match[1]] = match[2];
  }
  return result;
}

function cliMain() {
  const args = parseArgs(process.argv.slice(2));
  const catalog = loadCatalog();
  if (!catalog?.skills) {
    console.error('skill-catalog.json not found');
    process.exit(1);
  }

  const scored = scoreCatalog(
    {
      query: args.query ?? '',
      tags: args.tags ? args.tags.split(',') : [],
      phase: args.phase ?? '',
      layer: args.layer != null ? parseInt(args.layer, 10) : null,
      after: args.after ?? '',
    },
    catalog,
  );

  const limit = parseInt(args.limit ?? '3', 10);
  const format = args.format ?? 'json';
  const results = scored.slice(0, limit);

  if (format === 'oneline') {
    for (const r of results) {
      console.log(`${r.command} — ${r.reason}`);
    }
  } else {
    console.log(JSON.stringify(results.map(({ name, reason, command }) => ({ name, reason, command }))));
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  cliMain();
}
