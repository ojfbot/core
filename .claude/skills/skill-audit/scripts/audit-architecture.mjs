#!/usr/bin/env node
// audit-architecture.mjs — deterministic skill-architecture audit (ADR: skill-architecture-taxonomy).
// Scores every skill against the deterministic (D) signals in
// ../knowledge/architecture-rubric.md, builds a category coverage map, lists
// drift and straddlers, and (unless --no-log) appends one summary line to
// ~/.claude/skill-architecture-audit.jsonl for the OPAV Observation layer.
//
// Judgment (J) signals are NOT computed here — they require an LLM pass; the
// /skill-audit skill layers those on top of this output.
//
// No external deps. Reads skill-catalog.json + each <skill>/SKILL.md.
//
// Usage:
//   node scripts/audit-architecture.mjs                 # full report, markdown, appends jsonl
//   node scripts/audit-architecture.mjs --coverage      # coverage map only
//   node scripts/audit-architecture.mjs --straddles     # straddle + drift lists only
//   node scripts/audit-architecture.mjs --scorecard=<name>   # one skill's D-signals
//   node scripts/audit-architecture.mjs --format=json   # raw JSON
//   node scripts/audit-architecture.mjs --no-log        # don't append to the jsonl
//   node scripts/audit-architecture.mjs --skills-dir=PATH --catalog=PATH

import { existsSync, readFileSync, readdirSync, statSync, appendFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const args = parseArgs(process.argv.slice(2));

// Default: this script lives in .../skills/skill-audit/scripts/ → skills dir is two up.
const skillsDir = expandHome(args["skills-dir"] ?? resolve(__dirname, "..", ".."));
const catalogPath = expandHome(
  args.catalog ?? join(skillsDir, "skill-loader", "knowledge", "skill-catalog.json")
);
const auditLogPath = expandHome(args["audit-log"] ?? "~/.claude/skill-architecture-audit.jsonl");
const format = args.format ?? "markdown";
const WORD_THRESHOLD = Number(args["word-threshold"] ?? 400);
// Shadow-signal thresholds (D8–D11, observe-only; decisions/adopt-stack/pocock-writing-great-skills.md)
const SPRAWL_THRESHOLD = Number(args["sprawl-threshold"] ?? 800);
const NEGATION_RE = /\b(never|do not|don't|avoid|must not)\b/gi;

const CATEGORIES = [
  "library-api-reference",
  "product-verification",
  "data-analysis",
  "business-automation",
  "code-scaffolding",
  "code-quality-review",
  "cicd-deployment",
  "runbooks",
  "infrastructure-ops",
  "methodology-meta",
];

const DETERMINISTIC_RE = /\b(measure|measures|count|counts|scan|scans|compute|computes|tally|tallies|metric|metrics|deterministic)\b/i;

// ── load ─────────────────────────────────────────────────────────────────────

const catalog = readJson(catalogPath);
const catalogSkills = new Map((catalog?.skills ?? []).map((s) => [s.name, s]));
const diskSkills = listSkillDirs(skillsDir);

const rows = [];
for (const name of diskSkills) {
  const skillDir = join(skillsDir, name);
  const skillMdPath = join(skillDir, "SKILL.md");
  const md = existsSync(skillMdPath) ? readFileSync(skillMdPath, "utf8") : "";
  const fm = frontmatter(md);
  const body = stripFrontmatter(md);
  const entry = catalogSkills.get(name) ?? null;

  const hasKnowledge = isDir(join(skillDir, "knowledge"));
  const hasScripts = isDir(join(skillDir, "scripts"));
  const wordCount = body.trim() ? body.trim().split(/\s+/).length : 0;

  const D1 = !!entry;
  const D2 = !!entry?.category && CATEGORIES.includes(entry.category);
  const D3 = /^#{1,4}\s+gotchas\b/im.test(body);
  const D4 = hasKnowledge || wordCount < WORD_THRESHOLD;
  const D5 = looksModelFacing(fm.description ?? "");
  const D6soft = !(DETERMINISTIC_RE.test(body) && !hasScripts); // pass unless deterministic-language && no scripts
  const D7 = !(entry?.straddle === true);

  // Shadow signals D8–D11 — measured + logged, excluded from fails/verdict until
  // RIDM promotion (ADR-0086). See architecture-rubric.md "Shadow deterministic signals".
  const negationCount = (body.match(NEGATION_RE) ?? []).length;
  const descWords = (fm.description ?? "").trim() ? (fm.description ?? "").trim().split(/\s+/).length : 0;
  const triggerCount = Array.isArray(entry?.triggers) ? entry.triggers.length : 0;
  const shadow = {
    D8_sprawl: wordCount >= SPRAWL_THRESHOLD,
    D9_negation_count: negationCount,
    D9_negation_per_100w: wordCount ? Number(((negationCount * 100) / wordCount).toFixed(2)) : 0,
    D10_desc_words: descWords,
    D10_trigger_count: triggerCount,
    D11_dup_lines: duplicateLineCount(body),
  };

  const fails = [];
  if (!D1) fails.push("D1");
  if (!D2) fails.push("D2");
  if (!D3) fails.push("D3");
  if (!D4) fails.push("D4");
  if (!D5) fails.push("D5");
  if (!D7) fails.push("D7");

  let verdict;
  if (entry?.straddle === true || fails.length >= 3) verdict = "Refactor candidate";
  else if (fails.length >= 1) verdict = "Needs work";
  else verdict = "Aligned";

  rows.push({
    name,
    category: entry?.category ?? null,
    straddle: entry?.straddle === true,
    word_count: wordCount,
    has_knowledge: hasKnowledge,
    has_scripts: hasScripts,
    signals: { D1, D2, D3, D4, D5, D6_soft: D6soft, D7 },
    shadow,
    fails,
    verdict,
  });
}

rows.sort((a, b) => a.name.localeCompare(b.name));

const drift = rows.filter((r) => !r.signals.D1).map((r) => r.name);
const orphanCatalog = [...catalogSkills.keys()].filter((n) => !diskSkills.includes(n));
const straddles = rows.filter((r) => r.straddle).map((r) => r.name);
const missingGotchas = rows.filter((r) => !r.signals.D3).map((r) => r.name);
const uncategorized = rows.filter((r) => !r.signals.D2).map((r) => r.name);

const coverage = {};
for (const c of CATEGORIES) coverage[c] = 0;
for (const r of rows) if (r.category && coverage[r.category] != null) coverage[r.category]++;
const gaps = CATEGORIES.filter((c) => coverage[c] === 0);
const thin = CATEGORIES.filter((c) => coverage[c] === 1);

const summary = {
  ts: new Date().toISOString(),
  event: "skill-architecture-audit",
  skills_on_disk: diskSkills.length,
  skills_in_catalog: catalogSkills.size,
  drift_count: drift.length,
  uncategorized_count: uncategorized.length,
  missing_gotchas_count: missingGotchas.length,
  straddle_count: straddles.length,
  coverage_gaps: gaps,
  coverage_thin: thin,
  verdicts: {
    aligned: rows.filter((r) => r.verdict === "Aligned").length,
    needs_work: rows.filter((r) => r.verdict === "Needs work").length,
    refactor: rows.filter((r) => r.verdict === "Refactor candidate").length,
  },
  // Additive shadow aggregates (observe-only; not part of the verdict roll-up).
  shadow: {
    sprawl_count: rows.filter((r) => r.shadow.D8_sprawl).length,
    total_body_words: rows.reduce((n, r) => n + r.word_count, 0),
    total_desc_words: rows.reduce((n, r) => n + r.shadow.D10_desc_words, 0),
    total_negations: rows.reduce((n, r) => n + r.shadow.D9_negation_count, 0),
    dup_line_skills: rows.filter((r) => r.shadow.D11_dup_lines > 0).length,
  },
};

const report = {
  generated_at: summary.ts,
  sources: { skills_dir: skillsDir, catalog: catalogPath },
  summary,
  coverage,
  gaps,
  thin,
  drift,
  orphan_catalog: orphanCatalog,
  straddles,
  missing_gotchas: missingGotchas,
  uncategorized,
  rows,
};

// ── output ─────────────────────────────────────────────────────────────────

if (!args["no-log"]) {
  try { appendFileSync(auditLogPath, JSON.stringify(summary) + "\n"); }
  catch (e) { process.stderr.write(`warn: could not append audit log: ${e.message}\n`); }
}

if (format === "json") {
  console.log(JSON.stringify(args.scorecard ? scorecard(args.scorecard) : report, null, 2));
} else if (args.scorecard) {
  console.log(renderScorecard(args.scorecard));
} else if (args.coverage) {
  console.log(renderCoverage(report));
} else if (args.straddles) {
  console.log(renderStraddles(report));
} else {
  console.log(renderFull(report));
}

// ── helpers ──────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const out = {};
  for (const a of argv) {
    if (!a.startsWith("--")) continue;
    const eq = a.indexOf("=");
    if (eq === -1) out[a.slice(2)] = true;
    else out[a.slice(2, eq)] = a.slice(eq + 1);
  }
  return out;
}

function expandHome(p) {
  if (!p) return p;
  return p.startsWith("~") ? resolve(homedir(), p.slice(2)) : resolve(p);
}

function readJson(path) {
  if (!path || !existsSync(path)) return null;
  try { return JSON.parse(readFileSync(path, "utf8")); } catch { return null; }
}

function isDir(p) { return existsSync(p) && statSync(p).isDirectory(); }

function listSkillDirs(dir) {
  if (!isDir(dir)) return [];
  return readdirSync(dir)
    .filter((n) => !n.startsWith("."))
    .filter((n) => isDir(join(dir, n)) && existsSync(join(dir, n, "SKILL.md")))
    .sort();
}

// Parse YAML-ish frontmatter, including folded/literal block scalars
// (`key: >` or `key: |` with the value on subsequent indented lines).
function frontmatter(md) {
  const m = md.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return {};
  const out = {};
  const lines = m[1].split(/\r?\n/);
  let curKey = null;
  let blockParts = null; // collecting a block scalar
  const flush = () => {
    if (curKey && blockParts) out[curKey] = blockParts.join(" ").trim();
    blockParts = null;
  };
  for (const line of lines) {
    const top = line.match(/^([A-Za-z][\w-]*):\s?(.*)$/);
    if (top && !line.startsWith(" ")) {
      flush();
      curKey = top[1];
      const val = top[2];
      if (val === ">" || val === "|" || val === ">-" || val === "|-" || val === "") {
        blockParts = []; // value continues on indented lines
      } else {
        out[curKey] = val.replace(/^["']|["']$/g, "");
        curKey = null;
      }
    } else if (blockParts !== null && /^\s+\S/.test(line)) {
      blockParts.push(line.trim());
    }
  }
  flush();
  return out;
}

function stripFrontmatter(md) {
  return md.replace(/^---\n[\s\S]*?\n---\n?/, "");
}

// D11 proxy: count of distinct normalized non-trivial lines (> 6 words) that
// appear 2+ times in the body — duplication, not leading-word repetition.
function duplicateLineCount(body) {
  const seen = new Map();
  for (const raw of body.split(/\r?\n/)) {
    const norm = raw.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
    if (norm.split(" ").length <= 6) continue;
    seen.set(norm, (seen.get(norm) ?? 0) + 1);
  }
  return [...seen.values()].filter((n) => n >= 2).length;
}

// A description is "model-facing" if it reads as a trigger condition rather than
// a human blurb: MANDATORY directive, "when user asks to", quoted trigger phrases,
// or "Use this skill when".
function looksModelFacing(desc) {
  if (!desc) return false;
  return /MANDATORY|when user asks|use this skill when|triggers? (on|include)|load this skill|"[^"]+"/i.test(desc);
}

function scorecard(name) {
  return report.rows.find((r) => r.name === name) ?? { error: `no skill '${name}'` };
}

function sigStr(s) {
  return Object.entries(s).map(([k, v]) => `${k}:${v ? "✓" : "✗"}`).join(" ");
}

function renderScorecard(name) {
  const r = scorecard(name);
  if (r.error) return r.error;
  const lines = [];
  lines.push(`# Scorecard: ${r.name}`);
  lines.push("");
  lines.push(`- Category: ${r.category ?? "(uncategorized)"}${r.straddle ? " — STRADDLE" : ""}`);
  lines.push(`- SKILL.md words: ${r.word_count} · knowledge/: ${r.has_knowledge} · scripts/: ${r.has_scripts}`);
  lines.push(`- Signals: ${sigStr(r.signals)}`);
  lines.push(`- Shadow (observe-only): sprawl:${r.shadow.D8_sprawl ? "⚠" : "ok"} · negations:${r.shadow.D9_negation_count} (${r.shadow.D9_negation_per_100w}/100w) · desc:${r.shadow.D10_desc_words}w/${r.shadow.D10_trigger_count} triggers · dup-lines:${r.shadow.D11_dup_lines}`);
  lines.push(`- Fails: ${r.fails.length ? r.fails.join(", ") : "none"}`);
  lines.push(`- Verdict: **${r.verdict}**`);
  return lines.join("\n");
}

function renderCoverage(r) {
  const lines = ["# Skill category coverage", ""];
  lines.push("| Category | Count |");
  lines.push("|----------|------:|");
  for (const c of CATEGORIES) {
    const flag = r.coverage[c] === 0 ? " ⚠️ GAP" : r.coverage[c] === 1 ? " ⚠️ thin" : "";
    lines.push(`| ${c}${flag} | ${r.coverage[c]} |`);
  }
  lines.push("");
  if (r.gaps.length) lines.push(`**Absent (0):** ${r.gaps.join(", ")}`);
  if (r.thin.length) lines.push(`**Thin (1):** ${r.thin.join(", ")}`);
  return lines.join("\n");
}

function renderStraddles(r) {
  const lines = ["# Straddles & drift", ""];
  lines.push(`**Straddlers (do too much):** ${r.straddles.length ? r.straddles.join(", ") : "none"}`);
  lines.push(`**Drift (on disk, not in catalog):** ${r.drift.length ? r.drift.join(", ") : "none"}`);
  lines.push(`**Orphan catalog (in catalog, not on disk):** ${r.orphan_catalog.length ? r.orphan_catalog.join(", ") : "none"}`);
  lines.push(`**Uncategorized:** ${r.uncategorized.length ? r.uncategorized.join(", ") : "none"}`);
  lines.push(`**Missing Gotchas section:** ${r.missing_gotchas.length}/${r.rows.length}`);
  return lines.join("\n");
}

function renderFull(r) {
  const lines = [];
  lines.push("# Skill architecture audit (deterministic signals)");
  lines.push("");
  lines.push(`Generated: ${r.generated_at}`);
  lines.push(`Skills on disk: ${r.summary.skills_on_disk} · in catalog: ${r.summary.skills_in_catalog}`);
  lines.push(`Verdicts — Aligned: ${r.summary.verdicts.aligned} · Needs work: ${r.summary.verdicts.needs_work} · Refactor: ${r.summary.verdicts.refactor}`);
  lines.push("");
  lines.push(renderCoverage(r));
  lines.push("");
  lines.push(renderStraddles(r));
  lines.push("");
  lines.push("## Per-skill (deterministic)");
  lines.push("");
  lines.push("| Skill | Category | Verdict | Fails | Words | Neg/100w | Desc w | Dup |");
  lines.push("|-------|----------|---------|-------|------:|---------:|-------:|----:|");
  for (const row of r.rows) {
    const s = row.shadow;
    lines.push(`| \`${row.name}\` | ${row.category ?? "—"}${row.straddle ? " ⚠" : ""} | ${row.verdict} | ${row.fails.join(",") || "—"} | ${row.word_count}${s.D8_sprawl ? " ⚠" : ""} | ${s.D9_negation_per_100w} | ${s.D10_desc_words} | ${s.D11_dup_lines} |`);
  }
  lines.push("");
  lines.push("## Shadow aggregates (observe-only, D8–D11)");
  lines.push("");
  const sh = r.summary.shadow;
  lines.push(`Sprawl (body ≥ threshold): ${sh.sprawl_count} skills · total body words: ${sh.total_body_words} · total description words (context load): ${sh.total_desc_words} · total negations: ${sh.total_negations} · skills with dup lines: ${sh.dup_line_skills}`);
  lines.push("");
  lines.push("_D1 cataloged · D2 categorized · D3 Gotchas · D4 progressive-disclosure · D5 model-facing desc · D6 scripts(soft) · D7 single-category. Shadow D8 sprawl · D9 negation density · D10 description load · D11 dup lines are observe-only (not in the verdict). Judgment signals (J1–J8) are layered by the /skill-audit skill._");
  return lines.join("\n");
}
