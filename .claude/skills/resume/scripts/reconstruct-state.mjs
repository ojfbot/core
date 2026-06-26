#!/usr/bin/env node
/**
 * reconstruct-state.mjs — evidence-tiered session-state reconstruction for /resume.
 *
 * The point of this script is to make it impossible for a resuming agent to confabulate
 * what a prior session "finished." Instead of narrating from unverified markdown, we
 * assemble a provenance ledger from four evidence tiers and tag every claim with where
 * it came from:
 *
 *   [git]  — commits, branches, working tree           GROUND TRUTH (local repo)
 *   [PR]   — gh pr list/view                            GROUND TRUTH (remote)
 *   [DOLT] — bead store (sessions/convoys)              SELF-REPORT (best-effort)
 *   [READ] — .handoff/ markdown beads (normalized)      SELF-REPORT (lowest tier)
 *
 * The two bead worlds share NO join key (markdown session_id is an ISO timestamp; Dolt
 * session_id is a Claude $SESSION_ID UUID). They are correlated ONLY by commit-SHA +
 * repo + time-window — never by id.
 *
 * Verdicts assigned to each claim:
 *   GROUND-TRUTH  a raw fact from git/PR (the substrate, not a claim)
 *   VERIFIED      a self-report corroborated by git/PR
 *   UNVERIFIED    a self-report with no corroborating ground truth (not contradicted)
 *   CONFLICT      a self-report contradicted by ground truth (e.g. "merged" but PR open)
 *   GAP           ground-truth work with NO self-report (the backfill target)
 *
 * Read-only. Never writes. Degrades tier-by-tier: a missing gh / Dolt / .handoff yields
 * an explicit "tier unavailable" note, never a crash and never a silent omission.
 *
 * Usage:
 *   node reconstruct-state.mjs [--repo PATH] [--days N] [--session ID] [--json]
 */

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));

function parseFlags(argv) {
  const f = { repo: process.cwd(), days: 14, session: null, json: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') f.json = true;
    else if (a === '--repo') f.repo = argv[++i];
    else if (a === '--days') f.days = parseInt(argv[++i], 10) || 14;
    else if (a === '--session') f.session = argv[++i];
  }
  return f;
}

/** Run a command, returning { ok, out } and never throwing. */
function tryRun(cmd, cmdArgs, opts = {}) {
  try {
    const out = execFileSync(cmd, cmdArgs, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 32 * 1024 * 1024,
      ...opts,
    });
    return { ok: true, out };
  } catch (e) {
    return { ok: false, out: '', err: (e && (e.stderr || e.message)) || String(e) };
  }
}

// ---------------------------------------------------------------------------
// [git] tier — ground truth, local
// ---------------------------------------------------------------------------
function gitTier(repo, sinceDays) {
  const git = (...a) => tryRun('git', ['-C', repo, ...a]);
  const isRepo = git('rev-parse', '--is-inside-work-tree').ok;
  if (!isRepo) return { available: false, reason: `not a git repo: ${repo}` };

  const branch = git('rev-parse', '--abbrev-ref', 'HEAD').out.trim();
  const head = git('rev-parse', 'HEAD').out.trim();
  const dirty = git('status', '--porcelain').out.trim();
  const since = `--since=${sinceDays} days ago`;

  // Recent commits across all local refs in the window.
  const logFmt = '%H%x1f%cI%x1f%an%x1f%s';
  const logRaw = git('log', '--all', since, `--pretty=format:${logFmt}`).out;
  const commits = logRaw
    ? logRaw.split('\n').filter(Boolean).map((l) => {
        const [sha, date, author, subject] = l.split('\x1f');
        return { sha, shortSha: sha.slice(0, 9), date, author, subject };
      })
    : [];

  // Feature branches not yet merged into main/origin-main (unlanded work).
  const branchesRaw = git('branch', '--format=%(refname:short)').out;
  const branches = branchesRaw ? branchesRaw.split('\n').map((b) => b.trim()).filter(Boolean) : [];
  const mainRef = git('rev-parse', '--verify', 'origin/main').ok ? 'origin/main'
    : git('rev-parse', '--verify', 'main').ok ? 'main' : null;
  const unmerged = [];
  if (mainRef) {
    for (const b of branches) {
      if (b === mainRef || b === 'main') continue;
      const merged = git('merge-base', '--is-ancestor', b, mainRef).ok;
      if (!merged) unmerged.push(b);
    }
  }

  return {
    available: true,
    repo,
    branch,
    head,
    headShort: head.slice(0, 9),
    dirty: dirty ? dirty.split('\n').length : 0,
    mainRef,
    commits,
    unmergedBranches: unmerged,
  };
}

// ---------------------------------------------------------------------------
// [PR] tier — ground truth, remote (best-effort via gh)
// ---------------------------------------------------------------------------
function prTier(repo) {
  const fields = 'number,title,state,headRefName,mergedAt,updatedAt,url,author';
  const r = tryRun('gh', ['pr', 'list', '--state', 'all', '--limit', '40', '--json', fields], { cwd: repo });
  if (!r.ok) return { available: false, reason: 'gh unavailable / not a GitHub repo / not authed' };
  let prs = [];
  try { prs = JSON.parse(r.out); } catch { return { available: false, reason: 'gh returned unparseable JSON' }; }
  const byNumber = new Map(prs.map((p) => [p.number, p]));
  const byBranch = new Map(prs.map((p) => [p.headRefName, p]));
  return { available: true, prs, byNumber, byBranch };
}

// ---------------------------------------------------------------------------
// [READ] tier — .handoff markdown beads, normalized (lowest trust)
// ---------------------------------------------------------------------------
function pickPython() {
  for (const py of ['python3', '/usr/bin/python3', 'python']) {
    if (tryRun(py, ['-c', 'import yaml']).ok) return py;
  }
  return null;
}

function readTier(repo) {
  const handoff = path.join(repo, '.handoff');
  if (!existsSync(handoff)) return { available: false, reason: 'no .handoff/ directory' };
  const normalize = path.join(HERE, '..', '..', 'bead', 'scripts', 'normalize.py');
  if (!existsSync(normalize)) return { available: false, reason: `normalize.py not found at ${normalize}` };
  const py = pickPython();
  if (!py) return { available: false, reason: 'no Python interpreter with PyYAML found' };
  const r = tryRun(py, [normalize, '--root', handoff, '--json']);
  if (!r.ok) return { available: false, reason: `normalize.py failed: ${r.err}` };
  let beads = [];
  try { beads = JSON.parse(r.out); } catch { return { available: false, reason: 'normalize.py returned unparseable JSON' }; }
  return { available: true, beads };
}

// ---------------------------------------------------------------------------
// [DOLT] tier — bead store self-report (best-effort; needs mysql2 + live Dolt)
// ---------------------------------------------------------------------------
function doltTier() {
  // Resolve core root from this script's real location: core/.claude/skills/resume/scripts → core
  const coreRoot = path.resolve(HERE, '..', '..', '..', '..');
  const beadEmit = path.join(coreRoot, 'scripts', 'hooks', 'bead-emit.mjs');
  if (!existsSync(beadEmit)) return { available: false, reason: `bead-emit.mjs not found at ${beadEmit}` };
  const r = tryRun('node', [beadEmit, 'active-sessions'], { cwd: coreRoot });
  if (!r.ok) {
    return { available: false, reason: 'Dolt unreachable or workspace deps absent (advisory)', detail: r.err?.split('\n')[0] };
  }
  return { available: true, raw: r.out.trim() };
}

// ---------------------------------------------------------------------------
// Correlate self-reports against ground truth → the claim ledger
// ---------------------------------------------------------------------------
const PR_REF_RE = /github:[^#\s]+#(\d+)/i;
const MERGED_CLAIM_RE = /\b(merged|shipped|landed|deployed)\b/i;

function buildLedger(git, pr, read) {
  const rows = [];
  const windowMs = 36 * 3600 * 1000; // ±36h time-window for SHA-free correlation

  const referencedPRs = new Set();

  // --- self-reports from [READ] beads ---
  if (read.available) {
    for (const b of read.beads) {
      if (b._unparseable) {
        rows.push({ verdict: 'CONFLICT', tier: 'READ', claim: `unparseable bead ${b._path}`,
          evidence: (b._drift || []).join('; '), source: b._path });
        continue;
      }
      // Only report/decision beads make completion claims worth verifying.
      if (!['report', 'decision'].includes(b.type)) continue;
      const created = b.created_at ? Date.parse(b.created_at) : null;

      // (1) Explicit PR refs → check against [PR] ground truth.
      const prRefs = (b.refs || []).map((r) => (PR_REF_RE.exec(r) || [])[1]).filter(Boolean).map(Number);
      let matched = false;
      for (const n of prRefs) {
        referencedPRs.add(n);
        matched = true;
        if (!pr.available) {
          rows.push({ verdict: 'UNVERIFIED', tier: 'READ', claim: `${b.type}: "${b.title}" → PR #${n}`,
            evidence: 'PR tier unavailable; cannot confirm', source: b._path });
          continue;
        }
        const p = pr.byNumber.get(n);
        if (!p) {
          rows.push({ verdict: 'CONFLICT', tier: 'READ', claim: `${b.type}: "${b.title}" → PR #${n}`,
            evidence: `PR #${n} not found on remote`, source: b._path });
        } else if (p.state === 'MERGED') {
          rows.push({ verdict: 'VERIFIED', tier: 'READ', claim: `${b.type}: "${b.title}" → PR #${n}`,
            evidence: `[PR] #${n} MERGED ${p.mergedAt}`, source: b._path });
        } else {
          const asserts = MERGED_CLAIM_RE.test(b.title) || (b.status === 'closed');
          rows.push({ verdict: asserts ? 'CONFLICT' : 'UNVERIFIED', tier: 'READ',
            claim: `${b.type}: "${b.title}" → PR #${n} (bead status=${b.status})`,
            evidence: `[PR] #${n} is ${p.state}${asserts ? ' but bead implies done' : ''}`, source: b._path });
        }
      }
      if (matched) continue;

      // (2) No PR ref → correlate by time-window against [git] commits.
      if (git.available && created != null) {
        const near = git.commits.filter((c) => Math.abs(Date.parse(c.date) - created) <= windowMs);
        if (near.length) {
          rows.push({ verdict: 'VERIFIED', tier: 'READ', claim: `${b.type}: "${b.title}"`,
            evidence: `[git] ${near.length} commit(s) within ±36h (e.g. ${near[0].shortSha} "${near[0].subject}")`,
            source: b._path });
        } else {
          rows.push({ verdict: 'UNVERIFIED', tier: 'READ', claim: `${b.type}: "${b.title}"`,
            evidence: 'no commit within ±36h and no PR ref', source: b._path });
        }
      } else {
        rows.push({ verdict: 'UNVERIFIED', tier: 'READ', claim: `${b.type}: "${b.title}"`,
          evidence: created == null ? 'bead has no derivable timestamp' : 'git tier unavailable',
          source: b._path });
      }
    }
  }

  // --- GAPs: IN-FLIGHT ground-truth work nobody reported ---
  // Only OPEN PRs are pickup hazards. A merged PR with no bead is a backfill target
  // for /resume --verify (verify-session.mjs), not a pickup-time confabulation risk.
  if (pr.available) {
    for (const p of pr.prs) {
      if (p.state !== 'OPEN') continue;
      if (referencedPRs.has(p.number)) continue;
      rows.push({ verdict: 'GAP', tier: 'PR',
        claim: `OPEN PR #${p.number} "${p.title}"`,
        evidence: `[PR] in-flight; no .handoff bead references it`, source: p.headRefName });
    }
  }
  if (git.available) {
    for (const b of git.unmergedBranches) {
      rows.push({ verdict: 'GAP', tier: 'git', claim: `unmerged branch ${b}`,
        evidence: `[git] not an ancestor of ${git.mainRef}; verify intent before building on it`, source: b });
    }
  }

  return { rows, referencedPRs };
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------
const ORDER = { CONFLICT: 0, GAP: 1, UNVERIFIED: 2, VERIFIED: 3, 'GROUND-TRUTH': 4 };

function render(flags, git, pr, read, dolt, ledger) {
  const L = [];
  L.push(`# Session-state reconstruction — ${flags.repo}`);
  L.push('');
  L.push('Evidence tiers (ground truth → self-report):');
  L.push(`- [git]  ${git.available ? `OK — branch \`${git.branch}\` @ ${git.headShort}, ${git.commits.length} commits/${flags.days}d, ${git.dirty} dirty path(s)` : `UNAVAILABLE — ${git.reason}`}`);
  L.push(`- [PR]   ${pr.available ? `OK — ${pr.prs.length} PRs` : `UNAVAILABLE — ${pr.reason}`}`);
  L.push(`- [DOLT] ${dolt.available ? 'OK' : `UNAVAILABLE — ${dolt.reason}`}`);
  L.push(`- [READ] ${read.available ? `OK — ${read.beads.length} beads` : `UNAVAILABLE — ${read.reason}`}`);
  L.push('');

  const counts = ledger.reduce((m, r) => ((m[r.verdict] = (m[r.verdict] || 0) + 1), m), {});
  L.push(`**Claim ledger — ${ledger.length} rows** · ` +
    ['CONFLICT', 'GAP', 'UNVERIFIED', 'VERIFIED'].map((v) => `${v}:${counts[v] || 0}`).join(' · '));
  L.push('');

  // Cap each verdict group so the ledger never floods; the count above is never hidden.
  const CAP = 12;
  const shown = {};
  const sorted = [...ledger].sort((a, b) => (ORDER[a.verdict] - ORDER[b.verdict]));
  for (const r of sorted) {
    shown[r.verdict] = (shown[r.verdict] || 0) + 1;
    if (shown[r.verdict] === CAP + 1) {
      L.push(`- _… +${(counts[r.verdict] || 0) - CAP} more ${r.verdict} (use --json for all)_`);
      continue;
    }
    if (shown[r.verdict] > CAP) continue;
    L.push(`- **${r.verdict}** [${r.tier}] ${r.claim}`);
    L.push(`    ↳ ${r.evidence}  ·  \`${r.source}\``);
  }
  L.push('');

  L.push('## Anti-confabulation rules');
  L.push('- A **[READ]** claim is NEVER fact on its own — only VERIFIED rows (corroborated by [git]/[PR]) may be stated as done.');
  L.push('- **CONFLICT** and **GAP** rows MUST be surfaced to the user, not glossed.');
  L.push('- Act only on VERIFIED / GROUND-TRUTH. Everything else is "unverified" until checked.');
  if (dolt.available && dolt.raw) {
    L.push('');
    L.push('## [DOLT] active sessions (self-report)');
    L.push('```');
    L.push(dolt.raw);
    L.push('```');
  }
  return L.join('\n');
}

function main() {
  const flags = parseFlags(process.argv.slice(2));
  const git = gitTier(flags.repo, flags.days);
  const pr = prTier(flags.repo);
  const read = readTier(flags.repo);
  const dolt = doltTier();
  const { rows: ledger, referencedPRs } = buildLedger(git, pr, read);

  if (flags.json) {
    process.stdout.write(JSON.stringify({
      repo: flags.repo,
      tiers: {
        git: git.available ? { branch: git.branch, head: git.head, dirty: git.dirty, commits: git.commits, unmergedBranches: git.unmergedBranches } : { available: false, reason: git.reason },
        // Full PR list + which PRs already have a bead — consumed by verify-session.mjs for backfill.
        pr: pr.available ? { count: pr.prs.length, prs: pr.prs, referenced: [...referencedPRs] } : { available: false, reason: pr.reason },
        dolt: dolt.available ? { available: true } : { available: false, reason: dolt.reason },
        read: read.available ? { count: read.beads.length, beads: read.beads } : { available: false, reason: read.reason },
      },
      ledger,
    }, null, 2));
    process.stdout.write('\n');
    return 0;
  }

  process.stdout.write(render(flags, git, pr, read, dolt, ledger) + '\n');
  return 0;
}

// NB: set exitCode, don't process.exit() — stdout is async on a pipe and exit() truncates it.
process.exitCode = main();
