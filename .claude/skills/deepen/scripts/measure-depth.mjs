#!/usr/bin/env node
// measure-depth.mjs — per-file depth heuristics for /deepen audits.
// No external deps. Reads .ts/.tsx files in --scope, computes:
//   - public exports per file
//   - average lines per public function
//   - import-to-export ratio
//   - single-caller leaf detection
//   - composite shallow score (0..1)
// Outputs JSON to stdout.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const args = parseArgs(process.argv.slice(2));
const scope = resolve(args.scope ?? ".");
const includeTests = args["include-tests"] === true;
const repoRoot = resolve(args.root ?? findRepoRoot(scope));

const DEFAULT_EXCLUDES = [
  /\/dist\//, /\/build\//, /\/node_modules\//, /\.d\.ts$/,
];
const TEST_EXCLUDES = [
  /\.test\.tsx?$/, /\.spec\.tsx?$/, /\/__tests__\//,
];

const tsFiles = collectFiles(scope, includeTests);
const fileMetrics = tsFiles.map((path) => analyzeFile(path));
const importGraph = buildImportGraph(fileMetrics);

for (const fm of fileMetrics) {
  fm.called_from = importGraph.get(fm.file) ?? [];
  fm.is_single_caller_leaf = fm.called_from.length === 1;
  fm.score = compositeScore(fm);
}

const candidates = fileMetrics
  .filter((fm) => fm.score >= 0.5)
  .sort((a, b) => b.score - a.score);

const summary = {
  scope: relative(repoRoot, scope) || ".",
  files_analyzed: fileMetrics.length,
  metrics: {
    avg_exports_per_file: avg(fileMetrics.map((f) => f.exports)),
    avg_lines_per_public_fn: avg(fileMetrics.map((f) => f.avg_lines_per_fn).filter((n) => n > 0)),
    avg_import_export_ratio: avg(fileMetrics.map((f) => f.import_ratio).filter(Number.isFinite)),
    single_caller_leaves: fileMetrics.filter((f) => f.is_single_caller_leaf).length,
    barrel_files: fileMetrics.filter((f) => f.is_barrel).length,
  },
  candidates: candidates.map((c) => ({
    file: relative(repoRoot, c.file),
    exports: c.exports,
    avg_lines_per_fn: c.avg_lines_per_fn,
    import_ratio: round(c.import_ratio),
    is_single_caller_leaf: c.is_single_caller_leaf,
    is_barrel: c.is_barrel,
    called_from: c.called_from.map((p) => relative(repoRoot, p)),
    score: round(c.score),
  })),
};

console.log(JSON.stringify(summary, null, 2));

// ── helpers ────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const out = {};
  for (const a of argv) {
    if (a.startsWith("--")) {
      const eq = a.indexOf("=");
      if (eq === -1) out[a.slice(2)] = true;
      else out[a.slice(2, eq)] = a.slice(eq + 1);
    }
  }
  return out;
}

function findRepoRoot(start) {
  let dir = start;
  for (let i = 0; i < 10; i++) {
    try {
      statSync(join(dir, ".git"));
      return dir;
    } catch {
      const parent = resolve(dir, "..");
      if (parent === dir) return start;
      dir = parent;
    }
  }
  return start;
}

function collectFiles(root, includeTests) {
  const out = [];
  const excludes = includeTests ? DEFAULT_EXCLUDES : [...DEFAULT_EXCLUDES, ...TEST_EXCLUDES];
  walk(root);
  return out;

  function walk(dir) {
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); }
    catch { return; }
    for (const e of entries) {
      const p = join(dir, e.name);
      if (excludes.some((re) => re.test(p))) continue;
      if (e.isDirectory()) walk(p);
      else if (e.isFile() && /\.tsx?$/.test(e.name)) out.push(p);
    }
  }
}

function analyzeFile(path) {
  const src = readFileSync(path, "utf8");
  const lines = src.split("\n");

  const importPaths = extractImports(src);
  const exports = countExports(src);
  const reExports = countReExports(src);
  const isBarrel = exports > 0 && reExports / exports >= 0.7;

  const fnLines = extractPublicFnLineCounts(src);
  const avgLinesPerFn = fnLines.length ? avg(fnLines) : 0;

  const importRatio = exports > 0 ? importPaths.length / exports : Infinity;

  return {
    file: path,
    exports,
    re_exports: reExports,
    is_barrel: isBarrel,
    avg_lines_per_fn: round(avgLinesPerFn),
    import_paths: importPaths,
    import_ratio: importRatio,
    total_lines: lines.length,
  };
}

function extractImports(src) {
  const re = /^\s*import\s+(?:[^"';]+from\s+)?["']([^"']+)["'];?/gm;
  const out = [];
  let m;
  while ((m = re.exec(src)) !== null) out.push(m[1]);
  return out;
}

function countExports(src) {
  // Count named exports (export const/let/var/function/class/type/interface/enum)
  // and `export { X, Y }` blocks. Skip `export default`.
  let count = 0;
  const namedDecl = /^\s*export\s+(?:async\s+)?(?:const|let|var|function|class|type|interface|enum)\s+\w/gm;
  count += (src.match(namedDecl) ?? []).length;

  const namedBlock = /^\s*export\s*\{([^}]+)\}/gm;
  let m;
  while ((m = namedBlock.exec(src)) !== null) {
    const names = m[1].split(",").map((s) => s.trim()).filter(Boolean);
    count += names.length;
  }
  return count;
}

function countReExports(src) {
  // export { X } from '...'  OR  export * from '...'
  const reExport = /^\s*export\s+(?:\*|\{[^}]+\})\s+from\s+["']/gm;
  return (src.match(reExport) ?? []).length;
}

function extractPublicFnLineCounts(src) {
  // Best-effort: find `export (async)? function name(...)` or `export const name = (async )?(... =>` blocks
  // Count lines from opening brace to matching brace.
  const counts = [];
  const fnRe = /^(\s*)export\s+(?:async\s+)?function\s+\w+[^{]*\{/gm;
  let m;
  while ((m = fnRe.exec(src)) !== null) {
    const startIdx = m.index + m[0].length - 1; // at the '{'
    const len = countBraceBlockLines(src, startIdx);
    if (len > 0) counts.push(len);
  }

  const arrowRe = /^(\s*)export\s+const\s+\w+\s*(?::\s*[^=]+)?=\s*(?:async\s*)?(?:\([^)]*\)|\w+)\s*=>\s*\{/gm;
  while ((m = arrowRe.exec(src)) !== null) {
    const startIdx = m.index + m[0].length - 1;
    const len = countBraceBlockLines(src, startIdx);
    if (len > 0) counts.push(len);
  }
  return counts;
}

function countBraceBlockLines(src, openIdx) {
  let depth = 0;
  let lines = 0;
  let inString = null;
  let inLineComment = false;
  let inBlockComment = false;
  for (let i = openIdx; i < src.length; i++) {
    const c = src[i];
    const next = src[i + 1];
    if (inLineComment) {
      if (c === "\n") { inLineComment = false; lines++; }
      continue;
    }
    if (inBlockComment) {
      if (c === "*" && next === "/") { inBlockComment = false; i++; }
      else if (c === "\n") lines++;
      continue;
    }
    if (inString) {
      if (c === "\\") { i++; continue; }
      if (c === inString) inString = null;
      else if (c === "\n") lines++;
      continue;
    }
    if (c === "/" && next === "/") { inLineComment = true; i++; continue; }
    if (c === "/" && next === "*") { inBlockComment = true; i++; continue; }
    if (c === '"' || c === "'" || c === "`") { inString = c; continue; }
    if (c === "\n") lines++;
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return lines; // exclude the opening line for "non-blank body" approximation
    }
  }
  return lines;
}

function buildImportGraph(fileMetrics) {
  // Map: target file path -> [list of files that import from it]
  const byPath = new Map(fileMetrics.map((f) => [f.file, f]));
  const byNoExt = new Map();
  for (const f of fileMetrics) byNoExt.set(stripExt(f.file), f);

  const graph = new Map();
  for (const f of fileMetrics) graph.set(f.file, []);

  for (const importer of fileMetrics) {
    const importerDir = importer.file.substring(0, importer.file.lastIndexOf("/"));
    for (const ip of importer.import_paths) {
      if (!ip.startsWith(".") && !ip.startsWith("/")) continue; // skip package imports
      const resolvedNoExt = stripExt(resolve(importerDir, ip));
      const target = byNoExt.get(resolvedNoExt) ??
                     byPath.get(resolvedNoExt + ".ts") ??
                     byPath.get(resolvedNoExt + ".tsx") ??
                     byPath.get(resolvedNoExt + "/index.ts") ??
                     byPath.get(resolvedNoExt + "/index.tsx");
      if (target) graph.get(target.file).push(importer.file);
    }
  }
  return graph;
}

function stripExt(p) {
  return p.replace(/\.(tsx?|jsx?)$/, "");
}

function compositeScore(fm) {
  // 0..1, higher = more shallow. Clamp each component, blend.
  if (fm.exports === 0) return 0; // empty / index-only

  const thinFn = fm.avg_lines_per_fn === 0 ? 0
                : fm.avg_lines_per_fn <= 5 ? 1
                : fm.avg_lines_per_fn <= 10 ? 0.6
                : fm.avg_lines_per_fn <= 20 ? 0.2
                : 0;
  const manyExports = fm.exports >= 16 ? 1
                    : fm.exports >= 8 ? 0.6
                    : fm.exports >= 5 ? 0.3
                    : 0;
  const highImportRatio = !Number.isFinite(fm.import_ratio) ? 0
                        : fm.import_ratio >= 5 ? 1
                        : fm.import_ratio >= 2 ? 0.5
                        : 0;
  const singleCaller = fm.is_single_caller_leaf ? 0.4 : 0;
  const barrelPenalty = fm.is_barrel ? -0.5 : 0; // barrels look shallow but are intentional

  const raw = (thinFn * 0.35) + (manyExports * 0.25) + (highImportRatio * 0.25) + singleCaller + barrelPenalty;
  return Math.max(0, Math.min(1, raw));
}

function avg(nums) {
  if (!nums.length) return 0;
  return nums.reduce((s, n) => s + n, 0) / nums.length;
}

function round(n) {
  return Math.round(n * 100) / 100;
}
